import { Client, TextChannel } from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { ROLE_IDS, TEXT_CHANNEL_IDS } from "../constant/id";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SHIFT_OPTIONS = ["21時", "22時", "欠席"];

export class InterviewShiftService {
  static async sendDailyShiftMessage(client: Client) {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.MENSTU_SHIFT);
    if (
      !channel ||
      !channel.isTextBased() ||
      !(channel instanceof TextChannel)
    ) {
      return;
    }

    const now = dayjs().tz("Asia/Tokyo");
    const weekDay = WEEK_DAYS[now.day()];

    await channel.send(
      `<@&${ROLE_IDS.MENSETU_LEADER}><@&${ROLE_IDS.MENSTUKAN}>\n${now.format(
        `M月D日(${weekDay})`,
      )}\n本日の面接のシフトを提出してください`,
    );

    for (const option of SHIFT_OPTIONS) {
      await channel.send(option);
    }

    await channel.send(
      "出席できる時間または欠席にリアクションをつけてください。",
    );
  }
}
