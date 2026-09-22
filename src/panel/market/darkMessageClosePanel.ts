import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { DARK_MESSAGE_CLOSE_PREFIX } from "../../constant/market/darkMessage";

export function createDarkMessageCloseButton(requestId: string) {
  return new ButtonBuilder().setCustomId(`${DARK_MESSAGE_CLOSE_PREFIX}:show:${requestId}`)
    .setLabel("このTCを閉じる").setStyle(ButtonStyle.Danger);
}

export function createDarkMessageCloseRow(requestId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(createDarkMessageCloseButton(requestId));
}

export function createDarkMessageCloseConfirmation(requestId: string, token: string) {
  return {
    content: "",
    embeds: [new EmbedBuilder().setTitle("このTCを削除しますか？")
      .setDescription("削除すると、このTCと中のメッセージ・音声ファイルは復元できません。\n本当に削除しますか？")
      .setColor(0xed4245)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${DARK_MESSAGE_CLOSE_PREFIX}:confirm:${requestId}:${token}`)
        .setLabel("削除").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`${DARK_MESSAGE_CLOSE_PREFIX}:cancel:${requestId}:${token}`)
        .setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
    )],
    allowedMentions: { parse: [] as never[] },
  };
}
