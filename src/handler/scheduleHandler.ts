import cron from "node-cron";

import { Client, Guild } from "discord.js";

import { SalaryService } from "../service/salaryService";
// import { ChallengeMarkService } from "../service/challengeMarkService";
// import { MonthlyDebitService } from "../service/monthlyDebitService";
import { GameService } from "../service/gameService";
import { SalesManagementService } from "../service/salesManagementService";
import { InterviewShiftService } from "../service/interviewShiftService";
// import { DiaryService } from "../service/diaryService";
import { DailyMessageService } from "../service/dailyMessageService";
import { RedeployService } from "../service/redeployService";

/**
 * 定期的な処理を実行するハンドラ
 */
export async function handleSchedule(client: Client) {
  const guild: Guild | undefined = client.guilds.cache.get(
    process.env.GUILD_ID!,
  );

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
      SalaryService.payMonthlySalaries(guild!);
    },
    { timezone: "Asia/Tokyo" },
  );

  // cron.schedule(
  //   "50 3 1 * *",
  //   () => {
  //     // 毎月1日の3:50に実行される処理
  //     MonthlyDebitService.debitMonthly(guild!);
  //   },
  //   { timezone: "Asia/Tokyo" }
  // );

  // cron.schedule(
  //   "0 0 * * *",
  //   () => {
  //     // 毎日0:00に実行される処理
  //     try {
  //       ChallengeMarkService.executeChallengeMark(guild!, client);
  //     } catch (err) {
  //       console.error("schedule daily job error:", err);
  //     }
  //   },
  //   { timezone: "Asia/Tokyo" }
  // );

  cron.schedule(
    "0 21,22,23 * * *",
    async () => {
      // 毎日21:00・22:00・23:00に実行される処理
      try {
        await InterviewShiftService.sendDailyShiftMessage(client);
      } catch (err) {
        console.error("schedule interview shift job error:", err);
      }
    },
    { timezone: "Asia/Tokyo" },
  );

  cron.schedule(
    "0 21 * * *",
    async () => {
      try {
        await DailyMessageService.sendDailyMessage(client);
      } catch (err) {
        console.error("schedule daily message job error:", err);
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

  // cron.schedule(
  //   "10 0 * * *",
  //   () => {
  //     try {
  //       DiaryService.closeInactiveDiaries(client);
  //     } catch (err) {
  //       console.error("schedule daily diary cleanup job error:", err);
  //     }
  //   },
  //   { timezone: "Asia/Tokyo" },
  // );

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
