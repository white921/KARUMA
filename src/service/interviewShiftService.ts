import { Client, TextChannel } from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { ROLE_IDS, TEXT_CHANNEL_IDS } from "../constant/id";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SHIFT_OPTIONS = ["21時", "22時", "23時", "欠席"];

export function buildDailyShiftMessagePayload(dateLabel: string): string {
  return [
    `<@&${ROLE_IDS.MENSETU_LEADER}><@&${ROLE_IDS.MENSTUKAN}>`,
    `${dateLabel}`,
    "本日の面接のシフトを提出してください",
    "",
    "選択肢",
    ...SHIFT_OPTIONS.map((option) => `- ${option}`),
    "",
    "出席できる時間または欠席にリアクションをつけてください。",
  ].join("\n");
}

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
    const dateLabel = now.format(`M月D日(${weekDay})`);

    await channel.send(buildDailyShiftMessagePayload(dateLabel));
  }
}
