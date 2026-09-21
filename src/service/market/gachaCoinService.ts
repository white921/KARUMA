import type { ChatInputCommandInteraction } from "discord.js";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GACHA_COIN_MAX, GACHA_COIN_OPERATOR_ROLE_IDS, getGachaCoinReward } from "../../constant/market/gachaCoin";
import { hasOperatorRole } from "../../util/shared/operatorPermission";
import { ItemService } from "../inventory/itemService";
import { DbService } from "../system/dbService";

export function canManageGachaCoins(member: unknown): boolean {
  return hasOperatorRole(member, GACHA_COIN_OPERATOR_ROLE_IDS);
}

async function transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await DbService.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// 全更新で口座→残高→確認情報の順にロックし、並行操作を直列化する。
async function lockBalance(connection: PoolConnection, userId: string, requireUnfrozen = false): Promise<number> {
  const [accounts] = await connection.execute<RowDataPacket[]>(
    "SELECT is_frozen FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
  if (!accounts[0]) throw new Error("対象ユーザーの口座がありません。先に口座を開設してください。");
  if (requireUnfrozen && Number(accounts[0].is_frozen)) throw new Error("口座が凍結されているため交換できません。");
  await connection.execute(`INSERT INTO gacha_coin_balances (user_id, coins) VALUES (?, 0)
    ON DUPLICATE KEY UPDATE coins = coins`, [userId]);
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT coins FROM gacha_coin_balances WHERE user_id = ? FOR UPDATE", [userId]);
  return Number(rows[0].coins);
}

export class GachaCoinService {
  static async assertOperator(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) throw new Error("サーバー内でのみ使用できます。");
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    if (!canManageGachaCoins(member)) throw new Error("商人・市場支配人・システム支配人・英傑・皇帝のみ実行できます。");
  }

  static async getBalance(userId: string): Promise<number> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT coins FROM gacha_coin_balances WHERE user_id = ?", [userId]);
      return Number(rows[0]?.coins ?? 0);
    } finally { connection.release(); }
  }

  static async adjust(operationId: string, userId: string, amount: number, operatorUserId: string, reason: string): Promise<number> {
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > GACHA_COIN_MAX)
      throw new Error("枚数は1以上の整数で指定してください。");
    if (reason.length > 256) throw new Error("理由は256文字以内で指定してください。");
    return transaction(async (connection) => {
      const balance = await lockBalance(connection, userId);
      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM gacha_coin_transactions WHERE operation_id = ? FOR UPDATE", [operationId]);
      if (existing[0]) {
        const row = existing[0];
        if (String(row.user_id) !== userId || Number(row.amount) !== amount || String(row.operator_user_id) !== operatorUserId)
          throw new Error("操作IDが一致しません。");
        return Number(row.balance_after);
      }
      const after = balance + amount;
      if (after < 0) throw new Error(`ガチャコインが不足しています。所持: ${balance}枚`);
      if (after > GACHA_COIN_MAX) throw new Error("ガチャコインの所持上限を超えます。");
      await connection.execute("UPDATE gacha_coin_balances SET coins = ? WHERE user_id = ?", [after, userId]);
      await connection.execute(`INSERT INTO gacha_coin_transactions
        (operation_id, user_id, operator_user_id, transaction_type, amount, balance_after, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [operationId, userId, operatorUserId, amount > 0 ? "grant" : "deduct", amount, after, reason]);
      return after;
    });
  }

  static async createRequest(requestId: string, userId: string, rewardKey: string): Promise<number> {
    const reward = getGachaCoinReward(rewardKey);
    return transaction(async (connection) => {
      const balance = await lockBalance(connection, userId, true);
      if (balance < reward.cost) throw new Error(`ガチャコインが不足しています。必要: ${reward.cost}枚 / 所持: ${balance}枚`);
      await connection.execute(`INSERT INTO gacha_coin_exchange_requests
        (request_id, user_id, reward_key, cost, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [requestId, userId, reward.key, reward.cost]);
      return balance;
    });
  }

  static async redeem(requestId: string, userId: string) {
    return transaction(async (connection) => {
      const balance = await lockBalance(connection, userId, true);
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT *, expires_at <= NOW() AS expired FROM gacha_coin_exchange_requests WHERE request_id = ? FOR UPDATE", [requestId]);
      const request = rows[0];
      if (!request || String(request.user_id) !== userId) throw new Error("この交換確認は使用できません。");
      const reward = getGachaCoinReward(request.reward_key);
      if (request.status === "completed") return { reward, balance, alreadyCompleted: true };
      if (request.status !== "pending" || Number(request.expired)) throw new Error("キャンセル済み、または確認の有効期限が切れています。パネルからやり直してください。");
      if (Number(request.cost) !== reward.cost) throw new Error("交換レートが変更されました。パネルからやり直してください。");
      if (balance < reward.cost) throw new Error(`ガチャコインが不足しています。必要: ${reward.cost}枚 / 所持: ${balance}枚`);
      const after = balance - reward.cost;
      await connection.execute("UPDATE gacha_coin_balances SET coins = ? WHERE user_id = ?", [after, userId]);
      await ItemService.grant(connection, userId, reward.itemKey, 1);
      await connection.execute(`INSERT INTO gacha_coin_transactions
        (operation_id, user_id, transaction_type, amount, balance_after, item_key)
        VALUES (?, ?, 'exchange', ?, ?, ?)`, [`exchange:${requestId}`, userId, -reward.cost, after, reward.itemKey]);
      await connection.execute("UPDATE gacha_coin_exchange_requests SET status = 'completed' WHERE request_id = ?", [requestId]);
      return { reward, balance: after, alreadyCompleted: false };
    });
  }

  static async cancel(requestId: string, userId: string): Promise<void> {
    await transaction(async (connection) => {
      await lockBalance(connection, userId);
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id, status FROM gacha_coin_exchange_requests WHERE request_id = ? FOR UPDATE", [requestId]);
      if (!rows[0] || String(rows[0].user_id) !== userId) throw new Error("この交換確認は使用できません。");
      if (rows[0].status === "completed") throw new Error("すでに交換済みです。");
      await connection.execute("UPDATE gacha_coin_exchange_requests SET status = 'cancelled' WHERE request_id = ?", [requestId]);
    });
  }
}
