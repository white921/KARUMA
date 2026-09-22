import { GachaCoinActivationService } from "../../service/market/gachaCoinActivationService";
import cron from "node-cron";
import { EVALUATION_REMINDER_CRON, EvaluationDeadlineReminderService } from "../../service/evaluation/evaluationDeadlineReminderService";

import { Client, Guild } from "discord.js";

import { SalaryService } from "../../service/currency/salaryService";
import { DiaryService } from "../../service/diary/diaryService";
import { InterviewShiftService } from "../../service/evaluation/interviewShiftService";
import { GameService } from "../../service/game/gameService";
import { SalesManagementService } from "../../service/market/salesManagementService";
import { RedeployService } from "../../service/system/redeployService";

/**
 * 定期的な処理を実行するハンドラ
 */
export async function handleSchedule(client: Client) {
  const guild: Guild | undefined = client.guilds.cache.get(
    process.env.GUILD_ID!,
  );

  // 23:00に通知。23時台は5分ごとに未完了分だけ再試行し、起動時にも確認する。
  cron.schedule(EVALUATION_REMINDER_CRON, () => EvaluationDeadlineReminderService.runScheduled(client), { timezone: "Asia/Tokyo" });
  void EvaluationDeadlineReminderService.runScheduled(client);

  // 毎分00秒に日時を判定。開始前は無変更、失敗・再起動時も未完了分だけ再試行する。
  cron.schedule("0 * * * * *", () => GachaCoinActivationService.runScheduledActivation(), { timezone: "Asia/Tokyo" });
  await GachaCoinActivationService.runScheduledActivation();

  cron.schedule(
    "30 0 1 * *",
    () => {
      // 毎月1日0:30に実行される処理
      SalesManagementService.executeSalesDataMessage(guild!);
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "0 0 1 * *",
    () => {
      // 毎月1日0:00に実行される処理
      if (!SalaryService.shouldPayMonthlySalaries()) {
        console.info("monthly salary payment skipped for today");
        return;
      }
      SalaryService.payMonthlySalaries(guild!);
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "30 0 * * *",
    async () => {
      try {
        await InterviewShiftService.sendDailyShiftMessage(client);
      } catch (err) {
        console.error("schedule daily interviewer shift notification error:", err);
      }
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "*/10 * * * *",
    () => {
      try {
        GameService.removeExpiredRole(client);
      } catch (err) {
        console.error("schedule every minute job error:", err);
      }
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "10 0 * * *",
    async () => {
      try {
        await DiaryService.closeInactiveDiaries(client);
      } catch (err) {
        console.error("schedule daily diary cleanup job error:", err);
      }
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "45 0,4,8,12,16,20 * * *",
    async () => {
      try {
        await RedeployService.redeployCurrentService();
      } catch (err) {
        console.error("schedule railway self redeploy job error:", err);
      }
    },
    { timezone: "Asia/Tokyo" },
  );
}
