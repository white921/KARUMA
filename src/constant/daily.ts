import { ROLE_IDS } from "./id";

/** 定時出席報告の通知先。案内官系3ロールへ通知する。 */
export const DAILY_ATTENDANCE_ROLE_IDS = [
  ROLE_IDS.MENSETU_LEADER,
  ROLE_IDS.MENSTUKAN,
  ROLE_IDS.MENSTU_BUIGINNER,
] as const;

const DAILY_ATTENDANCE_MENTIONS = DAILY_ATTENDANCE_ROLE_IDS.map(
  (roleId) => `<@&${roleId}>`,
).join("");

export const DAILY_MESSAGES = {
  WEEKDAY: `${DAILY_ATTENDANCE_MENTIONS}\n**本日のコアタイムが開始しました！**\nコアタイムは21:00~22:30です`,
  HOLIDAY_OR_WEEKEND:
    `${DAILY_ATTENDANCE_MENTIONS}\n**本日のコアタイムが開始しました！**\nコアタイムは21:00~23:00です`,
};
