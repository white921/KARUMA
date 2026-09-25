import { Client, EmbedBuilder } from "discord.js";
import { THREAD_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
import type { GachaCoinService } from "./gachaCoinService";

type ExchangeResult = Awaited<ReturnType<typeof GachaCoinService.redeem>>;

export class GachaCoinExchangeLogService {
  static async send(client: Client, guildId: string, userId: string, requestId: string, result: ExchangeResult): Promise<void> {
    if (result.alreadyCompleted) return;
    try {
      const thread = await client.channels.fetch(THREAD_IDS.GACHA_COIN_EXCHANGE_LOG_THREAD);
      if (!thread?.isThread() || thread.guildId !== guildId) {
        throw new Error("ガチャコイン交換ログのスレッドが見つかりません。");
      }
      await thread.send({
        embeds: [new EmbedBuilder()
          .setTitle("ガチャコイン・アイテム交換")
          .setColor(COLOR.LIGFT_PINK)
          .addFields(
            { name: "交換者", value: `<@${userId}>` },
            { name: "アイテム", value: `${result.reward.label} × 1枚` },
            { name: "消費コイン", value: `${result.reward.cost.toLocaleString()}枚`, inline: true },
          )
          .setFooter({ text: `交換ID: ${requestId}` })
          .setTimestamp()],
        allowedMentions: { parse: [] },
        nonce: requestId,
        enforceNonce: true,
      });
    } catch (error) {
      // 交換は確定済み。ログの失敗を交換失敗にせず、復旧に必要な情報を残す。
      console.error("[GachaCoinExchangeLog] ログ送信失敗", {
        threadId: THREAD_IDS.GACHA_COIN_EXCHANGE_LOG_THREAD, guildId, userId, requestId,
        item: result.reward.itemKey, cost: result.reward.cost, balance: result.balance, error,
      });
    }
  }
}
