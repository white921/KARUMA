import Holidays from "date-holidays";
import { Client, TextChannel } from "discord.js";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { DAILY_MESSAGES } from "../constant/daily";

export class DailyMessageService {
  private static readonly holidays = new Holidays("JP");

  private static getTokyoDateInfo(targetDate = new Date()) {
    const date = targetDate.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    const weekday = targetDate.toLocaleDateString("en-US", {
      timeZone: "Asia/Tokyo",
      weekday: "short",
    });

    return { date, weekday };
  }

  private static getDailyMessage(targetDate = new Date()) {
    const tokyoDate = this.getTokyoDateInfo(targetDate);
    const isWeekend =
      tokyoDate.weekday === "Sat" || tokyoDate.weekday === "Sun";
    const isHoliday = Boolean(
      this.holidays.isHoliday(tokyoDate.date),
    );

    if (isWeekend || isHoliday) {
      return DAILY_MESSAGES.HOLIDAY_OR_WEEKEND;
    }

    return DAILY_MESSAGES.WEEKDAY;
  }

  static async sendDailyMessage(client: Client) {
    const message = this.getDailyMessage();

    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.DAILY_MESSAGE);
    if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
      throw new Error("Daily message channel is not a text channel.");
    }

    await channel.send({ content: message });
  }
}
