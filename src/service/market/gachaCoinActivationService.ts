import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { GACHA_COIN_MAX } from "../../constant/market/gachaCoin";
import { GACHA_COIN_ACTIVATION_EPOCH, GACHA_COIN_HISTORY_OVERRIDES, GACHA_COIN_ROLLOUT_KEY } from "../../constant/market/gachaCoinActivation";
import { DbService } from "../system/dbService";

type Rollout = RowDataPacket & { activation_epoch: number; status: string; due: number };

function validateRollout(rollout?: Rollout): asserts rollout is Rollout {
  if (!rollout || Number(rollout.activation_epoch) !== GACHA_COIN_ACTIVATION_EPOCH)
    throw new Error("ガチャコインの開始日時設定が一致しません。");
}

/** 呼び出し元はロールアウト→口座→抽選履歴の順でロックする。 */
async function credit(connection: PoolConnection, userId: string, amount: number, operationId: string, type: "gacha_draw" | "history", reason: string) {
  const [accounts] = await connection.execute<RowDataPacket[]>("SELECT user_id FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
  if (!accounts[0]) throw new Error(`ガチャコイン付与先の口座がありません: ${userId}`);
  await connection.execute(`INSERT INTO gacha_coin_balances (user_id, coins) VALUES (?, 0)
    ON DUPLICATE KEY UPDATE coins = coins`, [userId]);
  const [balances] = await connection.execute<RowDataPacket[]>("SELECT coins FROM gacha_coin_balances WHERE user_id = ? FOR UPDATE", [userId]);
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT user_id, amount, transaction_type FROM gacha_coin_transactions WHERE operation_id = ? FOR UPDATE", [operationId]);
  if (existing[0]) {
    if (String(existing[0].user_id) !== userId || Number(existing[0].amount) !== amount || existing[0].transaction_type !== type)
      throw new Error("ガチャコインの付与履歴が一致しません。");
    return { credited: false, balance: Number(balances[0].coins) };
  }
  const balance = Number(balances[0].coins) + amount;
  if (!Number.isSafeInteger(amount) || amount <= 0 || balance > GACHA_COIN_MAX) throw new Error("ガチャコインの付与枚数または残高上限が不正です。");
  await connection.execute("UPDATE gacha_coin_balances SET coins = ? WHERE user_id = ?", [balance, userId]);
  await connection.execute(`INSERT INTO gacha_coin_transactions
    (operation_id, user_id, transaction_type, amount, balance_after, reason) VALUES (?, ?, ?, ?, ?, ?)`,
    [operationId, userId, type, amount, balance, reason]);
  return { credited: true, balance };
}

export class GachaCoinActivationService {
  /** 既に進行中の抽選を過去分集計が追い越さないよう、抽選開始時に共有ロックする。 */
  static async lockDrawGate(connection: PoolConnection): Promise<void> {
    const [rows] = await connection.execute<Rollout[]>(
      "SELECT activation_epoch, status FROM gacha_coin_rollouts WHERE rollout_key = ? FOR SHARE", [GACHA_COIN_ROLLOUT_KEY]);
    validateRollout(rows[0]);
  }

  /** 抽選・支払いと同一トランザクション内で基本分を含む合計枚数を付与。開始前の抽選には付与しない。 */
  static async grantForDraw(connection: PoolConnection, userId: string, drawId: number, totalCoins = 1): Promise<number | undefined> {
    const [draws] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id, UNIX_TIMESTAMP(created_at) AS draw_epoch FROM market_gacha_draws WHERE id = ?", [drawId]);
    if (!draws[0] || String(draws[0].user_id) !== userId) throw new Error("コイン付与対象のガチャ履歴が一致しません。");
    if (Number(draws[0].draw_epoch) < GACHA_COIN_ACTIVATION_EPOCH) return undefined;
    const result = await credit(connection, userId, totalCoins, `gacha:${drawId}`, "gacha_draw", `市場ガチャ抽選ID: ${drawId}`);
    return result.balance;
  }

  /** 日時到来後に一度だけ実行。抽選を排他ロックで待たせ、既存残高へ一括加算する。 */
  static async activateDueHistory() {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<Rollout[]>(
        `SELECT activation_epoch, status, UNIX_TIMESTAMP() >= activation_epoch AS due
         FROM gacha_coin_rollouts WHERE rollout_key = ? FOR UPDATE`, [GACHA_COIN_ROLLOUT_KEY]);
      const rollout = rows[0];
      validateRollout(rollout);
      if (rollout.status === "completed" || !Number(rollout.due)) {
        await connection.commit();
        return { activated: false, status: rollout.status };
      }
      if (rollout.status !== "pending") throw new Error("ガチャコインの開始状態が不正です。");
      // 排他ロック取得時点で旧抽選は全て確定済み。新抽選はこのトランザクションの完了を待つ。
      const [history] = await connection.execute<RowDataPacket[]>(
        `SELECT user_id, COUNT(*) AS draws FROM market_gacha_draws
         WHERE created_at < FROM_UNIXTIME(?) GROUP BY user_id`, [GACHA_COIN_ACTIVATION_EPOCH]);
      const totals = new Map(history.map(row => [String(row.user_id), Number(row.draws)]));
      for (const [userId, amount] of Object.entries(GACHA_COIN_HISTORY_OVERRIDES)) totals.set(userId, amount);
      let creditedUsers = 0;
      let creditedCoins = 0;
      for (const [userId, amount] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
        const result = await credit(connection, userId, amount, `gc260922:${userId}`, "history",
          userId in GACHA_COIN_HISTORY_OVERRIDES ? "過去分: 綾目の旧25回+現5回、合計30枚" : "2026-09-22 00:00 JSTより前のガチャ履歴分");
        if (result.credited) { creditedUsers++; creditedCoins += amount; }
      }
      const historicalDraws = history.reduce((sum, row) => sum + Number(row.draws), 0);
      await connection.execute(`UPDATE gacha_coin_rollouts SET status = 'completed', historical_draw_count = ?,
        credited_user_count = ?, credited_coin_count = ?, completed_at = CURRENT_TIMESTAMP WHERE rollout_key = ?`,
        [historicalDraws, creditedUsers, creditedCoins, GACHA_COIN_ROLLOUT_KEY]);
      await connection.commit();
      return { activated: true, status: "completed", historicalDraws, creditedUsers, creditedCoins };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  static async runScheduledActivation(): Promise<void> {
    try {
      const result = await this.activateDueHistory();
      if (result.activated) console.info("[GachaCoinActivation] 過去分付与完了", result);
    } catch (error) {
      // 未完了のまま維持し、次の毎分チェックまたは再起動時に再試行する。
      console.error("[GachaCoinActivation] 過去分付与失敗、次回再試行", error);
    }
  }
}
