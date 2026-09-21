import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DARK_DISCLOSURE_PRICE, DARK_MESSAGE_PRODUCTS } from "../../constant/market/darkMessage";
import { ACTION_TYPES } from "../../constant/currency/action";
import { BOT_ID } from "../../constant/shared/id";
import { DbService } from "../system/dbService";
import { DarkMessageStore, type DarkMessageRequest } from "./darkMessageStore";

export interface DisclosureContext { requestId: string; userId: string; guildId: string; channelId: string; }
export interface DarkDisclosure extends RowDataPacket {
  request_id: string; payer_id: string; amount: number; after_wallet: number;
}

export function assertDisclosureRecipient(request: DarkMessageRequest | undefined, context: DisclosureContext): asserts request is DarkMessageRequest {
  if (!request || request.guild_id !== context.guildId || request.delivery_channel_id !== context.channelId ||
      request.recipient_id !== context.userId || context.userId === BOT_ID)
    throw new Error("このメッセージの受取人本人だけが開示できます。");
  if (request.status !== "delivered" || !request.delivery_message_id)
    throw new Error("配送が完了していないため開示できません。運営へお問い合わせください。");
}

function validateWallet(account: RowDataPacket | undefined): number {
  if (!account) throw new Error("口座が見つかりません。");
  if (Number(account.is_frozen)) throw new Error("口座が凍結されているため開示できません。");
  const wallet = Number(account.wallet);
  if (!Number.isSafeInteger(wallet) || wallet < DARK_DISCLOSURE_PRICE) throw new Error("残高が不足しています。開示には35,000 LIA必要です。");
  return wallet;
}

export class DarkDisclosureStore {
  static async get(requestId: string): Promise<DarkDisclosure | undefined> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<DarkDisclosure[]>("SELECT * FROM dark_message_disclosures WHERE request_id = ?", [requestId]);
      return rows[0];
    } finally { connection.release(); }
  }

  static async prepare(confirmationId: string, context: DisclosureContext): Promise<number> {
    assertDisclosureRecipient(await DarkMessageStore.get(context.requestId), context);
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT wallet, is_frozen FROM accounts WHERE user_id = ?", [context.userId]);
      const wallet = validateWallet(rows[0]);
      await connection.execute(`INSERT INTO dark_message_disclosure_confirmations
        (confirmation_id, request_id, user_id, amount, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [confirmationId, context.requestId, context.userId, DARK_DISCLOSURE_PRICE]);
      return wallet;
    } finally { connection.release(); }
  }

  static async cancel(confirmationId: string, context: DisclosureContext) {
    assertDisclosureRecipient(await DarkMessageStore.get(context.requestId), context);
    const connection = await DbService.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(`UPDATE dark_message_disclosure_confirmations SET status = 'cancelled'
        WHERE confirmation_id = ? AND request_id = ? AND user_id = ? AND status = 'pending'`,
        [confirmationId, context.requestId, context.userId]);
      if (result.affectedRows !== 1) throw new Error("この確認はすでに確定またはキャンセルされています。");
    } finally { connection.release(); }
  }

  static async purchase(confirmationId: string, context: DisclosureContext) {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      // 既存の市場購入と同じ口座→Bot口座の順。課金・履歴・開示記録は1トランザクション。
      const [accounts] = await connection.execute<RowDataPacket[]>("SELECT wallet, is_frozen FROM accounts WHERE user_id = ? FOR UPDATE", [context.userId]);
      const [bots] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [BOT_ID]);
      const [requests] = await connection.execute<DarkMessageRequest[]>("SELECT * FROM dark_message_requests WHERE request_id = ? FOR UPDATE", [context.requestId]);
      const request = requests[0];
      assertDisclosureRecipient(request, context);
      const [previous] = await connection.execute<DarkDisclosure[]>("SELECT * FROM dark_message_disclosures WHERE request_id = ? FOR UPDATE", [context.requestId]);
      if (previous[0]) {
        await connection.commit();
        return { request, afterWallet: Number(previous[0].after_wallet), alreadyPaid: true };
      }
      const [confirmations] = await connection.execute<RowDataPacket[]>(`SELECT *, expires_at <= NOW() AS expired
        FROM dark_message_disclosure_confirmations WHERE confirmation_id = ? FOR UPDATE`, [confirmationId]);
      const confirmation = confirmations[0];
      if (!confirmation || confirmation.request_id !== context.requestId || confirmation.user_id !== context.userId ||
          confirmation.status !== "pending" || Number(confirmation.expired) || Number(confirmation.amount) !== DARK_DISCLOSURE_PRICE)
        throw new Error("確認が無効、キャンセル済み、または期限切れです。開示ボタンからやり直してください。");
      const afterWallet = validateWallet(accounts[0]) - DARK_DISCLOSURE_PRICE;
      const botAfterWallet = Number(bots[0]?.wallet) + DARK_DISCLOSURE_PRICE;
      if (!bots[0] || !Number.isSafeInteger(botAfterWallet) || botAfterWallet > 2_147_483_647)
        throw new Error("システム口座を確認できません。運営へお問い合わせください。");
      await connection.execute("UPDATE accounts SET wallet = wallet - ? WHERE user_id = ?", [DARK_DISCLOSURE_PRICE, context.userId]);
      await connection.execute("UPDATE accounts SET wallet = wallet + ? WHERE user_id = ?", [DARK_DISCLOSURE_PRICE, BOT_ID]);
      const [action] = await connection.execute<ResultSetHeader>(`INSERT INTO actions
        (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ACTION_TYPES.DARK_SHOP_PURCHASE, DARK_DISCLOSURE_PRICE, context.userId, BOT_ID, afterWallet, botAfterWallet,
          `匿名開示（${DARK_MESSAGE_PRODUCTS[request.product].title}）`]);
      await connection.execute(`INSERT INTO dark_message_disclosures
        (request_id, confirmation_id, payer_id, amount, after_wallet, action_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [context.requestId, confirmationId, context.userId, DARK_DISCLOSURE_PRICE, afterWallet, action.insertId]);
      await connection.execute("UPDATE dark_message_disclosure_confirmations SET status = 'completed' WHERE confirmation_id = ?", [confirmationId]);
      await connection.commit();
      return { request, afterWallet, alreadyPaid: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
}
