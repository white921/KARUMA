import type { RowDataPacket } from "mysql2/promise";
import { ITEM_DEFINITIONS } from "../../constant/inventory/item";
import type { ItemKey } from "../../type/inventory/item";
import { DbService } from "../system/dbService";
import { ItemService } from "./itemService";
import { MAX_TICKET_QUANTITY } from "../../constant/inventory/ticketGrant";

export class TicketGrantService {
  static async grant(operationId: string, userId: string, itemKey: ItemKey, quantity: number, operatorUserId: string, reason: string) {
    if (!ITEM_DEFINITIONS.some(item => item.key === itemKey)) throw new Error("チケットの種類が不正です。");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_TICKET_QUANTITY) throw new Error("枚数は1以上の整数で指定してください。");
    if (!reason.trim() || reason.length > 256) throw new Error("理由は1〜256文字で入力してください。");
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
      if (!accounts.length) throw new Error("対象ユーザーの口座がありません。先に口座を開設してください。");
      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM ticket_grants WHERE operation_id = ? FOR UPDATE", [operationId]);
      if (existing[0]) {
        const row = existing[0];
        if (String(row.user_id) !== userId || row.item_key !== itemKey || Number(row.quantity) !== quantity ||
            String(row.operator_user_id) !== operatorUserId || row.reason !== reason) throw new Error("操作IDが一致しません。");
        await connection.commit();
        return Number(row.quantity_after);
      }
      const [subAccounts] = await connection.execute<RowDataPacket[]>(
        "SELECT sub_user_id FROM sub_accounts WHERE sub_user_id = ?", [userId]);
      if (subAccounts.length) throw new Error("サブ垢には付与できません。メイン垢を指定してください。");
      const [inventory] = await connection.execute<RowDataPacket[]>(
        `SELECT u.quantity FROM item_users u JOIN items i ON i.id = u.item_id
         WHERE u.user_id = ? AND i.item_key = ? FOR UPDATE`, [userId, itemKey]);
      const after = Number(inventory[0]?.quantity ?? 0) + quantity;
      if (after > MAX_TICKET_QUANTITY) throw new Error("チケットの所持上限を超えます。");
      await ItemService.grant(connection, userId, itemKey, quantity);
      await connection.execute(
        `INSERT INTO ticket_grants (operation_id, user_id, operator_user_id, item_key, quantity, quantity_after, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [operationId, userId, operatorUserId, itemKey, quantity, after, reason]);
      await connection.commit();
      return after;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
}
