import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Client, TextChannel } from "discord.js";
import { ROLE_IDS, TEXT_CHANNEL_IDS } from "../../constant/id";
import { SHIFT_OPTIONS, WEEK_DAYS } from "../../constant/interview";

dayjs.extend(utc);

dayjs.extend(timezone);

export function buildDailyShiftMessagePayloads(dateLabel: string): string[] {
  const introduction = [
    `<@&${ROLE_IDS.MENSETU_LEADER}><@&${ROLE_IDS.MENSTUKAN}><@&${ROLE_IDS.MENSTU_BUIGINNER}>`,
    `${dateLabel}`,
    "本日の面接のシフトを提出してください",
    "該当する場合は、以下の各メッセージにリアクションをつけてください。",
  ].join("\n");

  return [introduction, ...SHIFT_OPTIONS];
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

    for (const payload of buildDailyShiftMessagePayloads(dateLabel)) {
      await channel.send(payload);
    }
  }
}
