import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { DbService } from "../system/dbService";
import type { DarkMessageKind } from "../../constant/market/darkMessage";

export interface DarkMessageRequest extends RowDataPacket {
  request_id: string;
  guild_id: string;
  source_channel_id: string;
  buyer_id: string;
  operator_id: string;
  product: DarkMessageKind;
  status: "issued" | "sending" | "delivered" | "failed";
  recipient_id: string | null;
  delivery_channel_id: string | null;
  delivery_message_id: string | null;
}

// 開示時に参照する送信元は購入者。本文・元音声URLはDBやログに複製しない。
export class DarkMessageStore {
  private static async execute(sql: string, values: string[]) {
    const connection = await DbService.getConnection();
    try { return await connection.execute<ResultSetHeader>(sql, values); }
    finally { connection.release(); }
  }

  static async create(id: string, guildId: string, channelId: string, buyerId: string, operatorId: string, product: DarkMessageKind) {
    await this.execute(`INSERT INTO dark_message_requests
      (request_id, guild_id, source_channel_id, buyer_id, operator_id, product)
      VALUES (?, ?, ?, ?, ?, ?)`, [id, guildId, channelId, buyerId, operatorId, product]);
  }

  static async get(id: string): Promise<DarkMessageRequest | undefined> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<DarkMessageRequest[]>(
        "SELECT * FROM dark_message_requests WHERE request_id = ?", [id]);
      return rows[0];
    } finally { connection.release(); }
  }

  static async claim(id: string, buyerId: string, guildId: string, sourceChannelId: string, recipientId: string): Promise<boolean> {
    const [result] = await this.execute(`UPDATE dark_message_requests SET status = 'sending', recipient_id = ?
      WHERE request_id = ? AND buyer_id = ? AND guild_id = ? AND source_channel_id = ? AND status = 'issued'`,
      [recipientId, id, buyerId, guildId, sourceChannelId]);
    return result.affectedRows === 1;
  }

  static async recordChannel(id: string, channelId: string) {
    await this.execute("UPDATE dark_message_requests SET delivery_channel_id = ? WHERE request_id = ? AND status = 'sending'", [channelId, id]);
  }

  static async recordMessage(id: string, messageId: string) {
    await this.execute("UPDATE dark_message_requests SET delivery_message_id = ? WHERE request_id = ? AND status = 'sending'", [messageId, id]);
  }

  static async complete(id: string) {
    await this.execute("UPDATE dark_message_requests SET status = 'delivered', delivered_at = NOW() WHERE request_id = ? AND status = 'sending'", [id]);
  }

  static async fail(id: string) {
    await this.execute("UPDATE dark_message_requests SET status = 'failed' WHERE request_id = ? AND status IN ('issued', 'sending')", [id]);
  }
}
