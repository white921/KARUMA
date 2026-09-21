import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder } from "discord.js";
import { GACHA_COIN_PREFIX, getGachaCoinReward } from "../../constant/market/gachaCoin";
import { COLOR } from "../../constant/shared/color";
import { GachaCoinService } from "./gachaCoinService";

export async function handleGachaCoinButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, value] = interaction.customId.split(":");
  if (action === "balance") {
    await interaction.editReply({ content: `ガチャコインの所持数: **${await GachaCoinService.getBalance(interaction.user.id)}枚**`, embeds: [], components: [] });
  } else if (action === "select") {
    const reward = getGachaCoinReward(value);
    const balance = await GachaCoinService.createRequest(interaction.id, interaction.user.id, reward.key);
    await interaction.editReply({
      content: "",
      embeds: [new EmbedBuilder().setTitle("アイテム交換の確認").setColor(COLOR.LIGFT_PINK)
        .setDescription(`**${reward.label} × 1枚**と交換します。\n消費: **${reward.cost}コイン**\n所持: ${balance}枚 → ${balance - reward.cost}枚\n\n交換したチケットは所持チケットに追加されます。確認の有効期限は10分です。`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${GACHA_COIN_PREFIX}:confirm:${interaction.id}`).setLabel("交換を確定").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${GACHA_COIN_PREFIX}:cancel:${interaction.id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
      )],
    });
  } else if (action === "confirm") {
    const result = await GachaCoinService.redeem(value, interaction.user.id);
    await interaction.editReply({ content: result.alreadyCompleted
      ? `この交換はすでに完了しています。ガチャコインの所持数: ${result.balance}枚`
      : `✅ ${result.reward.label}を1枚受け取りました。\nガチャコインの残り: **${result.balance}枚**`, embeds: [], components: [] });
  } else if (action === "cancel") {
    await GachaCoinService.cancel(value, interaction.user.id);
    await interaction.editReply({ content: "交換をキャンセルしました。", embeds: [], components: [] });
  } else { throw new Error("不明な操作です。"); }
}
