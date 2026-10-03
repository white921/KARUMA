import { createHash } from "node:crypto";
import { Client, EmbedBuilder } from "discord.js";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { DbService } from "../system/dbService";
import { dailyReportText, latestReportDay, parseDailyReport, utcDayBounds, type HighLowDailyReport } from "./highLowDailyReport";

const REPORTS = "levelia_game_high_low_daily_reports";
const STATE = "levelia_game_high_low_daily_state";
// Includes exactly 01:00 JST and recovers missed work after restart/outage.
export const HIGH_LOW_DAILY_CRON = "*/5 * * * *";

export class HighLowDailyService {
  private static running: Promise<void> | null = null;
  private static migrationWarning = false;

  static async readHistory(connection: PoolConnection, userId: string): Promise<HighLowDailyReport[]> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, DATE_FORMAT(report_date, '%Y-%m-%d') AS day, user_id,
       wager_total, payout_total, net_amount FROM ${REPORTS} WHERE user_id = ?`, [userId]);
    return rows.map(parseDailyReport);
  }

  /** Cursor + each day's snapshots commit together, serialized across replicas. */
  static async aggregateNextDay(cutoff: string): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [[state]] = await connection.execute<RowDataPacket[]>(
        `SELECT DATE_FORMAT(next_report_date, '%Y-%m-%d') AS day,
         DATE_FORMAT(notify_from_date, '%Y-%m-%d') AS notify_from FROM ${STATE} WHERE id = 1 FOR UPDATE`);
      if (!state || state.day > cutoff) { await connection.commit(); return false; }
      const { start, end, nextDay } = utcDayBounds(state.day);
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT user_id,
         SUM(CASE WHEN kind = 'wager_debit' THEN amount ELSE 0 END) AS wager_total,
         SUM(CASE WHEN kind IN ('payout_credit', 'auto_payout_credit') THEN amount ELSE 0 END) AS payout_total,
         SUM(supply_delta) AS net_amount
         FROM levelia_game_high_low_ledger WHERE created_at >= ? AND created_at < ? GROUP BY user_id`, [start, end]);
      for (const row of rows) {
        const report = parseDailyReport({ ...row, id: "0", day: state.day });
        await connection.execute(
          `INSERT INTO ${REPORTS} (report_date, user_id, wager_total, payout_total, net_amount, dm_state, created_at)
           VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
          [report.day, report.userId, report.wager, report.payout, report.net,
            report.day >= state.notify_from ? "pending" : "skipped"]);
      }
      await connection.execute(`UPDATE ${STATE} SET next_report_date = ? WHERE id = 1`, [nextDay]);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  static async deliverPending(client: Client): Promise<void> {
    const connection = await DbService.getConnection();
    let reports: HighLowDailyReport[];
    try {
      // A crash after claiming may have happened after Discord accepted the DM.
      // Never resend these ambiguous attempts; the daily history remains visible.
      await connection.execute(`UPDATE ${REPORTS} SET dm_state = 'uncertain', dm_error = 'interrupted'
        WHERE dm_state = 'sending' AND attempted_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE)`);
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, DATE_FORMAT(report_date, '%Y-%m-%d') AS day, user_id, wager_total, payout_total, net_amount
         FROM ${REPORTS} WHERE dm_state = 'pending' ORDER BY report_date, id LIMIT 50`);
      reports = rows.map(parseDailyReport);
    } finally { connection.release(); }

    for (const report of reports) {
      try { await this.deliverOne(client, report); }
      catch (error) { console.error("[HighLowDaily] delivery persistence failed", { reportId: report.id, error }); }
    }
  }

  private static async deliverOne(client: Client, report: HighLowDailyReport): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      // Commit the claim before making an external call; no DB lock spans a DM.
      const [claim] = await connection.execute<ResultSetHeader>(
        `UPDATE ${REPORTS} SET dm_state = 'sending', attempted_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND dm_state = 'pending'`, [report.id]);
      if (claim.affectedRows !== 1) return;
    } finally { connection.release(); }

    let state = "sent", messageId: string | null = null, errorCode: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const send = async () => {
        const recipient = await client.users.fetch(report.userId);
        return recipient.send({
          embeds: [new EmbedBuilder().setTitle(`${report.day.replace(/-/g, "/")}のハイ＆ロー収支`)
            .setDescription(dailyReportText(report)).setColor(report.net < 0 ? 0xc65c5c : 0x55a879)
            .setFooter({ text: "集計対象：当日の0:00〜24:00（日本時間）" })],
          allowedMentions: { parse: [] },
          nonce: createHash("sha256").update(`high-low-daily:${report.day}:${report.userId}`).digest("hex").slice(0, 24),
          enforceNonce: true,
        });
      };
      const message = await Promise.race([send(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("delivery_timeout")), 30_000);
      })]);
      messageId = message.id;
    } catch (error: any) {
      errorCode = String(error?.code ?? "delivery_unknown").slice(0, 64);
      state = [50007, 10013, 50001].includes(Number(error?.code)) ? "failed" : "uncertain";
      console.warn("[HighLowDaily] DM unavailable; history preserved", { reportId: report.id, state, errorCode });
    } finally { if (timer) clearTimeout(timer); }

    const finish = await DbService.getConnection();
    try {
      await finish.execute(`UPDATE ${REPORTS} SET dm_state = ?, message_id = ?, dm_error = ?,
        delivered_at = CASE WHEN ? = 'sent' THEN UTC_TIMESTAMP(3) ELSE NULL END
        WHERE id = ? AND dm_state = 'sending'`, [state, messageId, errorCode, state, report.id]);
    } finally { finish.release(); }
  }

  static runScheduled(client: Client, now = new Date()): Promise<void> {
    this.running ??= this.run(client, now).finally(() => { this.running = null; });
    return this.running;
  }

  private static async run(client: Client, now: Date): Promise<void> {
    try {
      const cutoff = latestReportDay(now);
      // Bound catch-up work so a long outage cannot monopolize the Bot.
      for (let day = 0; day < 31 && await this.aggregateNextDay(cutoff); day++) { /* persisted cursor */ }
      this.migrationWarning = false;
      await this.deliverPending(client);
    } catch (error: any) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        if (!this.migrationWarning) console.warn("[HighLowDaily] daily report migration is not installed");
        this.migrationWarning = true;
      } else console.error("[HighLowDaily] scheduled report failed", error);
    }
  }
}
