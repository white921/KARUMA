import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { DbService } from "../system/dbService";
import { latestReportDay, parseDailyReport, utcDayBounds, type HighLowDailyReport } from "./highLowDailyReport";

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
        `SELECT DATE_FORMAT(next_report_date, '%Y-%m-%d') AS day FROM ${STATE} WHERE id = 1 FOR UPDATE`);
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
          [report.day, report.userId, report.wager, report.payout, report.net, "skipped"]);
      }
      await connection.execute(`UPDATE ${STATE} SET next_report_date = ? WHERE id = 1`, [nextDay]);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  private static async disablePendingDeliveries(): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      // Daily history remains available, but LEVELIA Games results are no longer sent by DM.
      await connection.execute(`UPDATE ${REPORTS} SET dm_state = 'skipped', dm_error = 'dm_disabled'
        WHERE dm_state IN ('pending', 'sending')`);
    } finally { connection.release(); }
  }

  static runScheduled(now = new Date()): Promise<void> {
    this.running ??= this.run(now).finally(() => { this.running = null; });
    return this.running;
  }

  private static async run(now: Date): Promise<void> {
    try {
      await this.disablePendingDeliveries();
      const cutoff = latestReportDay(now);
      // Bound catch-up work so a long outage cannot monopolize the Bot.
      for (let day = 0; day < 31 && await this.aggregateNextDay(cutoff); day++) { /* persisted cursor */ }
      this.migrationWarning = false;
    } catch (error: any) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        if (!this.migrationWarning) console.warn("[HighLowDaily] daily report migration is not installed");
        this.migrationWarning = true;
      } else console.error("[HighLowDaily] scheduled report failed", error);
    }
  }
}
