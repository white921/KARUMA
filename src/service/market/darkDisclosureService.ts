import { EmbedBuilder, type ButtonInteraction } from "discord.js";
import { DARK_DISCLOSURE_PREFIX } from "../../constant/market/darkMessage";
import { createDisclosureConfirmation, createDisclosureResult } from "../../panel/market/darkDisclosurePanel";
import { DarkMessageStore, type DarkMessageRequest } from "./darkMessageStore";
import { assertDisclosureRecipient, DarkDisclosureStore, type DisclosureContext } from "./darkDisclosureStore";

export class DarkDisclosureService {
  private static async deliveryMessage(interaction: ButtonInteraction, request: DarkMessageRequest) {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased() || channel.id !== request.delivery_channel_id)
      throw new Error("配送先のTCを確認できません。");
    const message = await channel.messages.fetch(request.delivery_message_id!).catch(() => null);
    if (!message || message.author.id !== interaction.client.user.id || !message.embeds[0])
      throw new Error("元のメッセージが見つかりません。運営へお問い合わせください。");
    return message;
  }

  private static async showResult(interaction: ButtonInteraction, request: DarkMessageRequest, alreadyPaid: boolean) {
    let displayed = false;
    try {
      const message = await this.deliveryMessage(interaction, request);
      // 元の本文・音声添付を保持し、開示パネルだけを結果に置き換える。
      await message.edit({ embeds: [EmbedBuilder.from(message.embeds[0]), createDisclosureResult(request.buyer_id)],
        components: [], allowedMentions: { parse: [] } });
      displayed = true;
    } catch {
      console.error("[DarkDisclosure] result display requires retry", { requestId: request.request_id });
    }
    await interaction.editReply({
      content: (alreadyPaid ? "開示済みです。追加の引き落としはありません。" : "35,000 LIAを支払い、送信者を開示しました。") +
        (displayed ? "" : "\nTCの表示更新に失敗しました。開示ボタンから無料で再表示できます。"),
      embeds: [createDisclosureResult(request.buyer_id)], components: [], allowedMentions: { parse: [] },
    });
  }

  static async handleButton(interaction: ButtonInteraction) {
    const [prefix, action, requestId, confirmationId, extra] = interaction.customId.split(":");
    if (prefix !== DARK_DISCLOSURE_PREFIX || !["show", "confirm", "cancel"].includes(action) ||
        !/^\d{17,20}$/.test(requestId ?? "") || extra ||
        (action !== "show" && !/^\d{17,20}$/.test(confirmationId ?? "")) ||
        (action === "show" && confirmationId)) throw new Error("無効な開示パネルです。");
    if (!interaction.guildId || !interaction.channelId) throw new Error("専用TC内で操作してください。");
    const context: DisclosureContext = { requestId, userId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId };
    const request = await DarkMessageStore.get(requestId);
    assertDisclosureRecipient(request, context);
    if (action === "cancel") {
      await DarkDisclosureStore.cancel(confirmationId, context);
      await interaction.editReply({ content: "開示をキャンセルしました。この確認での支払いは発生していません。", embeds: [], components: [] });
      return;
    }
    if (await DarkDisclosureStore.get(requestId)) {
      await this.showResult(interaction, request, true);
      return;
    }
    // 消えた配送メッセージに対して新たに課金しない。
    await this.deliveryMessage(interaction, request);
    if (action === "show") {
      const wallet = await DarkDisclosureStore.prepare(interaction.id, context);
      await interaction.editReply(createDisclosureConfirmation(requestId, interaction.id, request.product, wallet));
      return;
    }
    const result = await DarkDisclosureStore.purchase(confirmationId, context);
    await this.showResult(interaction, result.request, result.alreadyPaid);
  }
}
