import { randomBytes } from "node:crypto";
import { ChannelType, type ButtonInteraction } from "discord.js";
import { DARK_MESSAGE_CLOSE_PREFIX, DARK_MESSAGE_CLOSE_OPERATOR_ROLES } from "../../constant/market/darkMessage";
import { createDarkMessageCloseConfirmation } from "../../panel/market/darkMessageClosePanel";
import { DarkMessageStore } from "./darkMessageStore";
import { hasOperatorRole } from "../../util/shared/operatorPermission";

type PendingClose = { requestId: string; userId: string; guildId: string; channelId: string; expiresAt: number };

export class DarkMessageCloseService {
  // 再起動・10分経過後は再確認が必要。配送・開示の台帳はTC削除後も保持する。
  private static readonly pending = new Map<string, PendingClose>();
  private static readonly deleting = new Set<string>();

  static async handleButton(interaction: ButtonInteraction) {
    const [prefix, action, requestId, token, extra] = interaction.customId.split(":");
    if (prefix !== DARK_MESSAGE_CLOSE_PREFIX || !["show", "confirm", "cancel"].includes(action) ||
        !/^\d{17,20}$/.test(requestId ?? "") || extra ||
        (action === "show" ? token !== undefined : !/^[a-f0-9]{24}$/.test(token ?? "")))
      throw new Error("無効な確認パネルです。");
    for (const [key, value] of this.pending) if (value.expiresAt <= Date.now()) this.pending.delete(key);
    const request = await DarkMessageStore.get(requestId);
    const channel = interaction.channel;
    if (!request || !interaction.guildId || request.guild_id !== interaction.guildId ||
        request.delivery_channel_id !== interaction.channelId)
      throw new Error("このTCの受取人本人・闇市場支配人・英傑・システム支配人だけが閉じることができます。");
    if (request.recipient_id !== interaction.user.id) {
      // 確認を開くときも削除確定時も、最新のロールで権限を照合する。
      const member = await interaction.guild?.members.fetch({ user: interaction.user.id, force: true }).catch(() => null);
      if (!hasOperatorRole(member, DARK_MESSAGE_CLOSE_OPERATOR_ROLES))
        throw new Error("このTCの受取人本人・闇市場支配人・英傑・システム支配人だけが閉じることができます。");
    }
    if (request.status !== "delivered" || !request.delivery_message_id ||
        channel?.type !== ChannelType.GuildText || channel.id !== request.delivery_channel_id)
      throw new Error("配送済みの専用TCで操作してください。");

    if (action === "show") {
      if (interaction.message.id !== request.delivery_message_id || interaction.message.author.id !== interaction.client.user.id)
        throw new Error("専用TCのパネルから操作してください。");
      const newToken = randomBytes(12).toString("hex");
      this.pending.set(newToken, { requestId, userId: interaction.user.id, guildId: interaction.guildId,
        channelId: channel.id, expiresAt: Date.now() + 10 * 60_000 });
      try { await interaction.editReply(createDarkMessageCloseConfirmation(requestId, newToken)); }
      catch (error) { this.pending.delete(newToken); throw error; }
      return;
    }
    const pending = this.pending.get(token);
    if (!pending || pending.expiresAt <= Date.now() || pending.requestId !== requestId || pending.userId !== interaction.user.id ||
        pending.guildId !== interaction.guildId || pending.channelId !== channel.id)
      throw new Error("確認が無効、キャンセル済み、または期限切れです。「このTCを閉じる」からやり直してください。");
    // awaitより前に消費し、連打やキャンセル後の削除を拒否する。
    this.pending.delete(token);
    if (action === "cancel") {
      await interaction.editReply({ content: "TCの削除をキャンセルしました。", embeds: [], components: [] });
      return;
    }
    if (this.deleting.has(channel.id)) throw new Error("このTCは削除処理中です。");
    this.deleting.add(channel.id);
    try {
      await interaction.editReply({ content: "TCを削除しています。", embeds: [], components: [] });
      await channel.delete("闇市場商品の受取人または許可された運営が確認画面でTC削除を確定");
      // 削除済みTCでは応答を更新できない場合がある。
      await interaction.editReply({ content: "TCを削除しました。", embeds: [], components: [] }).catch(() => undefined);
    } catch {
      throw new Error("TCを削除できませんでした。Botの権限を確認し、「このTCを閉じる」からやり直してください。");
    } finally { this.deleting.delete(channel.id); }
  }
}
