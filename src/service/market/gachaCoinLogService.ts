import { Client, EmbedBuilder, escapeMarkdown } from "discord.js";
import { THREAD_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";

type GachaCoinAdjustmentLog = {
  targetUserId: string;
  operatorUserId: string;
  amount: number;
  afterCoins: number;
  reason: string;
  interactionId: string;
};

/** コマンドによる増減の成功時だけ呼び出す。パネル交換は対象外。 */
export class GachaCoinLogService {
  static async send(client: Client, guildId: string, adjustment: GachaCoinAdjustmentLog): Promise<void> {
    try {
      const thread = await client.channels.fetch(THREAD_IDS.GACHA_COIN_LOG_THREAD);
      if (!thread?.isThread() || thread.guildId !== guildId) {
        throw new Error("ガチャコイン増減ログのスレッドが見つかりません。");
      }
      await thread.send({
        embeds: [new EmbedBuilder()
          .setTitle(adjustment.amount > 0 ? "ガチャコイン付与" : "ガチャコイン減算")
          .setColor(COLOR.LIGFT_PINK)
          .addFields(
            { name: "実行者", value: `<@${adjustment.operatorUserId}>` },
            { name: "対象者", value: `<@${adjustment.targetUserId}>` },
            { name: "増減枚数", value: `${adjustment.amount > 0 ? "+" : ""}${adjustment.amount.toLocaleString()}枚`, inline: true },
            { name: "変更後残高", value: `${adjustment.afterCoins.toLocaleString()}枚`, inline: true },
            { name: "理由", value: escapeMarkdown(adjustment.reason) || "未記入" },
          )
          .setTimestamp()],
        allowedMentions: { parse: [] },
        nonce: adjustment.interactionId,
        enforceNonce: true,
      });
    } catch (error) {
      // 残高更新は確定済み。ログ失敗で増減失敗と表示し、再操作を誘発しない。
      console.error("[GachaCoinLog] ログ送信失敗", {
        threadId: THREAD_IDS.GACHA_COIN_LOG_THREAD, guildId, ...adjustment, error,
      });
    }
  }
}
