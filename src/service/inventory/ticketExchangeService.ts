import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { ACTION_TYPES } from "../../constant/currency/action";
import { BOT_ID } from "../../constant/shared/id";
import { getTicketExchangeRate, parseTicketExchangeQuantity } from "../../constant/inventory/ticketExchange";
import type { ItemInventoryRow } from "../../type/inventory/item";
import { DbService } from "../system/dbService";
import { ItemService } from "./itemService";

import type { ExchangeRequest, TicketExchangeResult } from "../../type/inventory/ticketExchange";

export class TicketExchangeService {
  static async createRequest(requestId: string, userId: string, itemKey: string, quantity: number) {
    const rate = getTicketExchangeRate(itemKey);
    parseTicketExchangeQuantity(String(quantity));
    const owned = (await ItemService.getQuantities(userId, [rate.itemKey])).get(rate.itemKey) ?? 0;
    if (owned < quantity) throw new Error(`チケットが不足しています。所持数: ${owned}枚`);
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO ticket_exchange_requests
         (request_id, user_id, item_key, quantity, unit_price, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))`,
        [requestId, userId, itemKey, quantity, rate.unitPrice],
      );
    } finally {
      connection.release();
    }
    return { rate, quantity, amount: quantity * rate.unitPrice, owned };
  }

  static async cancel(requestId: string, userId: string): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE ticket_exchange_requests SET status = 'cancelled'
         WHERE request_id = ? AND user_id = ? AND status = 'pending'`,
        [requestId, userId],
      );
      if (result.affectedRows !== 1) throw new Error("この換金は既に確定またはキャンセルされています。");
    } finally {
      connection.release();
    }
  }

  static async redeem(requestId: string, userId: string): Promise<TicketExchangeResult> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      // 同一ユーザーの別リクエストも直列化。既存の購入処理と同じく口座→所持品の順。
      const [accounts] = await connection.execute<RowDataPacket[]>(
        "SELECT wallet, is_frozen FROM accounts WHERE user_id = ? FOR UPDATE", [userId],
      );
      const account = accounts[0];
      if (!account || userId === BOT_ID) throw new Error("換金用の口座情報が見つかりません。");
      const [requests] = await connection.execute<ExchangeRequest[]>(
        `SELECT *, expires_at <= CURRENT_TIMESTAMP AS expired FROM ticket_exchange_requests
         WHERE request_id = ? AND user_id = ? FOR UPDATE`, [requestId, userId],
      );
      const request = requests[0];
      if (!request) throw new Error("換金の確認情報が見つかりません。最初からやり直してください。");
      const rate = getTicketExchangeRate(request.item_key);
      const quantity = parseTicketExchangeQuantity(String(request.quantity));
      const amount = quantity * Number(request.unit_price);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("換金額が不正です。");
      if (request.status === "completed") {
        await connection.commit();
        return { label: rate.label, quantity, amount, afterWallet: Number(request.after_wallet),
          afterQuantity: Number(request.after_quantity), alreadyCompleted: true };
      }
      if (request.status !== "pending" || Number(request.expired)) {
        throw new Error("この確認はキャンセル済み、または有効期限（10分）切れです。最初からやり直してください。");
      }
      if (Number(account.is_frozen)) throw new Error("口座が凍結されているため換金できません。");
      const afterWallet = Number(account.wallet) + amount;
      if (!Number.isSafeInteger(afterWallet) || afterWallet > 2_147_483_647) {
        throw new Error("換金後の残高が上限を超えます。枚数を減らしてください。");
      }
      const [items] = await connection.execute<ItemInventoryRow[]>(
        `SELECT items.id AS item_id, items.item_key, item_users.quantity
         FROM item_users INNER JOIN items ON items.id = item_users.item_id
         WHERE item_users.user_id = ? AND items.item_key = ? FOR UPDATE`,
        [userId, rate.itemKey],
      );
      const item = items[0];
      if (!item || Number(item.quantity) < quantity) throw new Error("チケットが不足しています。所持数を確認してください。");
      const afterQuantity = Number(item.quantity) - quantity;
      const [consumed] = await connection.execute<ResultSetHeader>(
        "UPDATE item_users SET quantity = quantity - ? WHERE user_id = ? AND item_id = ? AND quantity >= ?",
        [quantity, userId, item.item_id, quantity],
      );
      if (consumed.affectedRows !== 1) throw new Error("チケットの消費に失敗しました。");
      const [credited] = await connection.execute<ResultSetHeader>(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, userId],
      );
      if (credited.affectedRows !== 1) throw new Error("換金額の入金に失敗しました。");
      // 換金額は報酬として発行。Bot口座の残高は減額しない。
      const [bots] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ?", [BOT_ID]);
      if (!bots[0]) throw new Error("システム口座が見つかりません。");
      await connection.execute(
        `INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ACTION_TYPES.TICKET_EXCHANGE, amount, BOT_ID, userId, Number(bots[0].wallet), afterWallet,
          `${rate.label} ${quantity}枚換金（1枚 ${request.unit_price} LIA）`],
      );
      await connection.execute(
        `UPDATE ticket_exchange_requests SET status = 'completed', after_wallet = ?, after_quantity = ?
         WHERE request_id = ?`, [afterWallet, afterQuantity, requestId],
      );
      await connection.commit();
      return { label: rate.label, quantity, amount, afterWallet, afterQuantity, alreadyCompleted: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
