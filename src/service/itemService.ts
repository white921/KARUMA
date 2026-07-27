import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { ItemKey } from "../constant/item";
import { DbService } from "./dbService";

type ItemQuantityRow = RowDataPacket & {
  item_key: ItemKey;
  quantity: number;
};

type ItemInventoryRow = ItemQuantityRow & {
  item_id: number;
};

export class ItemService {
  static async getQuantities(
    userId: string,
    itemKeys: readonly ItemKey[],
  ): Promise<Map<ItemKey, number>> {
    if (itemKeys.length === 0) return new Map();

    const placeholders = itemKeys.map(() => "?").join(", ");
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<ItemQuantityRow[]>(
        `SELECT items.item_key, item_users.quantity
         FROM item_users
         INNER JOIN items ON items.id = item_users.item_id
         WHERE item_users.user_id = ?
           AND items.item_key IN (${placeholders})
           AND item_users.quantity > 0`,
        [userId, ...itemKeys],
      );
      return new Map(
        rows.map((row) => [row.item_key, Number(row.quantity)]),
      );
    } finally {
      connection.release();
    }
  }

  static async hasItem(userId: string, itemKey: ItemKey): Promise<boolean> {
    return ((await this.getQuantities(userId, [itemKey])).get(itemKey) ?? 0) > 0;
  }

  /** 呼び出し元のトランザクション中でアイテムを付与する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    itemKey: ItemKey,
    quantity: number,
  ): Promise<void> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO item_users (user_id, item_id, quantity)
       SELECT ?, id, ? FROM items WHERE item_key = ?
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, quantity, itemKey],
    );
    if (result.affectedRows === 0) {
      throw new Error(`未登録のアイテムです: ${itemKey}`);
    }
  }

  /** 呼び出し元のトランザクション中で1個消費する。 */
  static async consume(
    connection: PoolConnection,
    userId: string,
    itemKey: ItemKey,
  ): Promise<boolean> {
    const [rows] = await connection.execute<ItemInventoryRow[]>(
      `SELECT items.id AS item_id, items.item_key, item_users.quantity
       FROM item_users
       INNER JOIN items ON items.id = item_users.item_id
       WHERE item_users.user_id = ? AND items.item_key = ?
       FOR UPDATE`,
      [userId, itemKey],
    );
    const item = rows[0];
    if (!item || Number(item.quantity) < 1) return false;

    await connection.execute(
      `UPDATE item_users
       SET quantity = quantity - 1
       WHERE user_id = ? AND item_id = ?`,
      [userId, item.item_id],
    );
    return true;
  }

  /** 単独の消費処理用。 */
  static async consumeOne(userId: string, itemKey: ItemKey): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const consumed = await this.consume(connection, userId, itemKey);
      if (!consumed) {
        await connection.rollback();
        return false;
      }
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
