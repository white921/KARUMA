import { Client, EmbedBuilder } from "discord.js";
import { THREAD_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
import type { TicketExchangeResult } from "../../type/inventory/ticketExchange";

export class TicketExchangeLogService {
  static async send(client: Client, guildId: string, userId: string, requestId: string, result: TicketExchangeResult): Promise<void> {
    // 同じ確認を再実行した場合は、消費・入金だけでなくログも追加しない。
    if (result.alreadyCompleted) return;
    try {
      const thread = await client.channels.fetch(THREAD_IDS.TICKET_EXCHANGE_LOG_THREAD);
      if (!thread?.isThread() || thread.guildId !== guildId) {
        throw new Error("チケット換金ログのスレッドが見つかりません。");
      }
      await thread.send({
        embeds: [new EmbedBuilder()
          .setTitle("チケット換金")
          .setColor(COLOR.LIGFT_PINK)
          .addFields(
            { name: "換金した人", value: `<@${userId}>\nユーザーID: ${userId}` },
            { name: "チケット", value: result.label },
            { name: "換金枚数", value: `${result.quantity.toLocaleString()}枚`, inline: true },
            { name: "受取額", value: `${result.amount.toLocaleString()} LIA`, inline: true },
          )
          .setFooter({ text: `換金ID: ${requestId}` })
          .setTimestamp()],
        allowedMentions: { parse: [] },
        nonce: requestId,
        enforceNonce: true,
      });
    } catch (error) {
      // 入金は確定済み。Discordログの失敗を換金失敗として扱わず、復旧用の情報を残す。
      console.error("[TicketExchangeLog] ログ送信失敗", {
        threadId: THREAD_IDS.TICKET_EXCHANGE_LOG_THREAD, guildId, userId, requestId,
        ticket: result.label, quantity: result.quantity, amount: result.amount, error,
      });
    }
  }
}
