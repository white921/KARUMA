import { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  GAME_FREE_TICKET_TYPE,
  GameFreeTicketType,
} from "../constant/gameTicket";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { GAME_MESSAGES } from "../constant/game";
import { DbService } from "./dbService";

type TicketRow = RowDataPacket & {
  ticket_type: GameFreeTicketType;
  quantity: number;
};

export class GameFreeTicketService {
  static getTicketType(commandId: string): GameFreeTicketType | undefined {
    if (commandId === PANEL_COMMAND_NAMES.GAME_SHORT) {
      return GAME_FREE_TICKET_TYPE.SHORT;
    }
    return undefined;
  }

  static async hasTicket(userId: string, commandId: string): Promise<boolean> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) return false;

    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<TicketRow[]>(
        "SELECT quantity FROM game_free_tickets WHERE user_id = ? AND ticket_type = ?",
        [userId, ticketType],
      );
      return Number(rows[0]?.quantity ?? 0) > 0;
    } finally {
      connection.release();
    }
  }

  static async getTicketQuantities(
    userId: string,
  ): Promise<Record<GameFreeTicketType, number>> {
    const quantities: Record<GameFreeTicketType, number> = {
      [GAME_FREE_TICKET_TYPE.SHORT]: 0,
    };
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<TicketRow[]>(
        `SELECT ticket_type, quantity
         FROM game_free_tickets
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

  /** 付与処理を行うトランザクション内で使用する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: GameFreeTicketType,
    quantity: number,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO game_free_tickets (user_id, ticket_type, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, ticketType, quantity],
    );
  }

  /** 確定時に6時間プラン用の券を1枚消費する。 */
  static async consume(userId: string, commandId: string): Promise<void> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);

    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<TicketRow[]>(
        `SELECT quantity FROM game_free_tickets
         WHERE user_id = ? AND ticket_type = ? FOR UPDATE`,
        [userId, ticketType],
      );
      if (Number(rows[0]?.quantity ?? 0) < 1) {
        throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);
      }
      await connection.execute(
        "UPDATE game_free_tickets SET quantity = quantity - 1 WHERE user_id = ? AND ticket_type = ?",
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
