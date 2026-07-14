import { PoolConnection, RowDataPacket } from "mysql2/promise";

import { DbService } from "./dbService";
import { ShopTicketType } from "../constant/shopTicket";

type ShopTicketRow = RowDataPacket & {
  ticket_type: ShopTicketType;
  quantity: number;
};

export type OwnedShopTicket = {
  type: ShopTicketType;
  quantity: number;
};

export class ShopTicketService {
  /** 市場ガチャのトランザクション中でショップチケットを付与する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: ShopTicketType,
    quantity = 1,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO shop_tickets (user_id, ticket_type, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, ticketType, quantity],
    );
  }

  static async getOwnedTickets(userId: string): Promise<OwnedShopTicket[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<ShopTicketRow[]>(
        `SELECT ticket_type, quantity
         FROM shop_tickets
         WHERE user_id = ? AND quantity > 0`,
        [userId],
      );
      return rows.map((row) => ({
        type: row.ticket_type,
        quantity: Number(row.quantity),
      }));
    } finally {
      connection.release();
    }
  }

  /** 呼び出し元のトランザクション中で1枚だけ消費する。 */
  static async consume(
    connection: PoolConnection,
    userId: string,
    ticketType: ShopTicketType,
  ): Promise<void> {
    const [rows] = await connection.execute<ShopTicketRow[]>(
      `SELECT quantity
       FROM shop_tickets
       WHERE user_id = ? AND ticket_type = ?
       FOR UPDATE`,
      [userId, ticketType],
    );
    if (Number(rows[0]?.quantity ?? 0) < 1) {
      throw new Error("選択したショップチケットを所持していません。");
    }
    await connection.execute(
      `UPDATE shop_tickets
       SET quantity = quantity - 1
       WHERE user_id = ? AND ticket_type = ?`,
      [userId, ticketType],
    );
  }
}
