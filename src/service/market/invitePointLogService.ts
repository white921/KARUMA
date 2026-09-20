import { Client, EmbedBuilder } from "discord.js";
import { THREAD_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";

type InvitePointGrantLog = {
  targetUserId: string;
  operatorUserId: string;
  amount: number;
  afterPoints: number;
  interactionId: string;
};

export class InvitePointLogService {
  static async send(client: Client, guildId: string, grant: InvitePointGrantLog): Promise<void> {
    try {
      const thread = await client.channels.fetch(THREAD_IDS.INVITE_POINT_LOG_THREAD);
      if (!thread?.isThread() || thread.guildId !== guildId) {
        throw new Error("ガチャポイント付与ログのスレッドが見つかりません。");
      }
      await thread.send({
        embeds: [new EmbedBuilder()
          .setTitle("招待ポイント付与")
          .setColor(COLOR.LIGFT_PINK)
          .addFields(
            { name: "付与者", value: `<@${grant.operatorUserId}>` },
            { name: "対象者", value: `<@${grant.targetUserId}>` },
            { name: "付与ポイント", value: `${grant.amount.toLocaleString()}pt`, inline: true },
            { name: "付与後残高", value: `${grant.afterPoints.toLocaleString()}pt`, inline: true },
          )
          .setTimestamp()],
        allowedMentions: { parse: [] },
        nonce: grant.interactionId,
        enforceNonce: true,
      });
    } catch (error) {
      // 付与は確定済み。ログ送信失敗で付与失敗と表示し、再付与を誘発しない。
      console.error("[InvitePointLog] ログ送信失敗", {
        threadId: THREAD_IDS.INVITE_POINT_LOG_THREAD, guildId, ...grant, error,
      });
    }
  }
}
