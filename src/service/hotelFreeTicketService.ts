import { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  HOTEL_FREE_TICKET_TYPE,
  HOTEL_MESSAGES,
  HotelFreeTicketType,
} from "../constant/hotel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { DbService } from "./dbService";

type TicketRow = RowDataPacket & {
  ticket_type: HotelFreeTicketType;
  quantity: number;
};

export class HotelFreeTicketService {
  static getTicketType(commandId: string): HotelFreeTicketType | undefined {
    if (commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRET) {
      return HOTEL_FREE_TICKET_TYPE.SECRET;
    }
    if (commandId === PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM) {
      return HOTEL_FREE_TICKET_TYPE.FREEDOM;
    }
    return undefined;
  }

  static async hasTicket(userId: string, commandId: string): Promise<boolean> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) return false;
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<TicketRow[]>(
        "SELECT quantity FROM hotel_free_tickets WHERE user_id = ? AND ticket_type = ?",
        [userId, ticketType],
      );
      return Number(rows[0]?.quantity ?? 0) > 0;
    } finally {
      connection.release();
    }
  }

  static async getTicketQuantities(
    userId: string,
  ): Promise<Record<HotelFreeTicketType, number>> {
    const quantities: Record<HotelFreeTicketType, number> = {
      [HOTEL_FREE_TICKET_TYPE.SECRET]: 0,
      [HOTEL_FREE_TICKET_TYPE.FREEDOM]: 0,
    };
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<TicketRow[]>(
        `SELECT ticket_type, quantity
         FROM hotel_free_tickets
         WHERE user_id = ? AND quantity > 0`,
        [userId],
      );
      for (const row of rows) {
        if (row.ticket_type in quantities) {
          quantities[row.ticket_type] = Number(row.quantity);
        }
      }
      return quantities;
    } finally {
      connection.release();
    }
  }

  /** 市場ガチャのトランザクション中で無料券を付与する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: HotelFreeTicketType,
    quantity: number,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO hotel_free_tickets (user_id, ticket_type, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, ticketType, quantity],
    );
  }

  /** 使用直前に1枚だけ消費する。 */
  static async consume(userId: string, commandId: string): Promise<void> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);

    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<TicketRow[]>(
        `SELECT quantity FROM hotel_free_tickets
         WHERE user_id = ? AND ticket_type = ? FOR UPDATE`,
        [userId, ticketType],
      );
      if (Number(rows[0]?.quantity ?? 0) < 1) {
        throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);
      }
      await connection.execute(
        "UPDATE hotel_free_tickets SET quantity = quantity - 1 WHERE user_id = ? AND ticket_type = ?",
        [userId, ticketType],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
