import type { Action } from "../../type/currency/action";
import { ACTION_TYPES as A } from "../../constant/currency/action";

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;
export const LEVELIA_GAME_USER_ID = "1552246348756025344";

export interface HighLowDailyReport {
  id: string;
  day: string;
  userId: string;
  wager: number;
  payout: number;
  net: number;
}

export interface HighLowDailyAction extends Action {
  highLowDaily?: HighLowDailyReport;
}

export function utcDayBounds(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid daily report date");
  const calendar = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) {
    throw new Error("Invalid daily report date");
  }
  const start = calendar.getTime() - JST_OFFSET_MS;
  const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
  return { start: sql(start), end: sql(start + DAY_MS), endMs: start + DAY_MS,
    nextDay: new Date(calendar.getTime() + DAY_MS).toISOString().slice(0, 10) };
}

/** At 00:59 JST yesterday is not yet due; at 01:00 it becomes eligible. */
export function latestReportDay(now = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS - 3_600_000 - DAY_MS).toISOString().slice(0, 10);
}

export function parseDailyReport(row: Record<string, unknown>): HighLowDailyReport {
  const report = { id: String(row.id), day: String(row.day), userId: String(row.user_id),
    wager: Number(row.wager_total), payout: Number(row.payout_total), net: Number(row.net_amount) };
  utcDayBounds(report.day);
  if (![report.wager, report.payout, report.net].every(Number.isSafeInteger)
    || report.wager < 0 || report.payout < 0 || report.payout - report.wager !== report.net) {
    throw new Error("Invalid high-low daily totals");
  }
  return report;
}

export function dailyReportText(report: HighLowDailyReport): string {
  const amount = (n: number) => n.toLocaleString("ja-JP");
  return `残高増減：${report.net > 0 ? "+" : ""}${amount(report.net)} LIA\n`
    + `賭け金合計：${amount(report.wager)} LIA\n受取合計：${amount(report.payout)} LIA`;
}

/** Display-only row. Never insert it into actions or apply it to a wallet. */
export function dailyReportAction(report: HighLowDailyReport): HighLowDailyAction {
  return {
    id: 0, command_name: report.net < 0 ? A.HIGH_LOW_BET : A.HIGH_LOW_PAYOUT,
    amount: Math.abs(report.net),
    from_user_id: report.net < 0 ? report.userId : LEVELIA_GAME_USER_ID,
    to_user_id: report.net < 0 ? LEVELIA_GAME_USER_ID : report.userId,
    from_after_wallet: 0, to_after_wallet: 0, comment: "",
    created_at: new Date(utcDayBounds(report.day).endMs - 1), highLowDaily: report,
  };
}

export function withoutIndividualHighLow(actions: HighLowDailyAction[]): HighLowDailyAction[] {
  return actions.filter(row => row.highLowDaily
    || (row.command_name !== A.HIGH_LOW_BET && row.command_name !== A.HIGH_LOW_PAYOUT));
}

export function formatHighLowDaily(action: HighLowDailyAction): string | null {
  const report = action.highLowDaily;
  return report ? `**${report.day.replace(/-/g, "/")} ハイ＆ロー収支**\n${dailyReportText(report)}` : null;
}
