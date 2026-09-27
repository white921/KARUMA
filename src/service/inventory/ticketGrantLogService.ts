import { Client, EmbedBuilder, escapeMarkdown } from "discord.js";
import { THREAD_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
import type { TicketGrantLog } from "../../type/inventory/ticketGrantLog";

/** 管理コマンドの付与がDBに確定した後にだけ送信する。 */
export class TicketGrantLogService {
  static async send(client: Client, guildId: string, grant: TicketGrantLog): Promise<void> {
    try {
      const thread = await client.channels.fetch(THREAD_IDS.TICKET_GRANT_LOG_THREAD);
      if (!thread?.isThread() || thread.guildId !== guildId) {
        throw new Error("チケット付与ログのスレッドが見つかりません。");
      }
      await thread.send({
        embeds: [new EmbedBuilder()
          .setTitle("チケット付与")
          .setColor(COLOR.LIGFT_PINK)
          .addFields(
            { name: "実行者", value: `<@${grant.operatorUserId}>` },
            { name: "対象者", value: `<@${grant.targetUserId}>` },
            { name: "チケット", value: escapeMarkdown(grant.itemName), inline: true },
            { name: "付与枚数", value: `${grant.quantity.toLocaleString("ja-JP")}枚`, inline: true },
            { name: "理由", value: escapeMarkdown(grant.reason) || "未記入" },
          )
          .setTimestamp()],
        allowedMentions: { parse: [] },
        nonce: grant.interactionId,
        enforceNonce: true,
      });
    } catch (error) {
      // 付与は確定済み。ログ失敗によって付与失敗と表示し、再付与を誘発しない。
      console.error("[TicketGrantLog] ログ送信失敗", {
        threadId: THREAD_IDS.TICKET_GRANT_LOG_THREAD, guildId, ...grant, error,
      });
    }
  }
}
