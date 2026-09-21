import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { DARK_DISCLOSURE_PREFIX, DARK_DISCLOSURE_PRICE, DARK_MESSAGE_PRODUCTS, type DarkMessageKind } from "../../constant/market/darkMessage";

export function createDisclosureOffer(requestId: string) {
  return {
    embed: new EmbedBuilder().setTitle("匿名開示")
      .setDescription(`**${DARK_DISCLOSURE_PRICE.toLocaleString("ja-JP")} LIA**で送信者を開示しますか？\n受取人本人だけが購入できます。次の確認画面で確定するまで支払いは発生しません。`)
      .setColor(0x392247),
    row: new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
      .setCustomId(`${DARK_DISCLOSURE_PREFIX}:show:${requestId}`).setLabel("35,000 LIAで開示する").setStyle(ButtonStyle.Secondary)),
  };
}

export function createDisclosureConfirmation(requestId: string, confirmationId: string, kind: DarkMessageKind, wallet: number) {
  return {
    content: "",
    embeds: [new EmbedBuilder().setTitle("開示購入の確認")
      .setDescription(`この${DARK_MESSAGE_PRODUCTS[kind].title}の送信者を開示します。\n\n料金：**35,000 LIA**\n現在の残高：${wallet.toLocaleString("ja-JP")} LIA\n購入後の残高：${(wallet - DARK_DISCLOSURE_PRICE).toLocaleString("ja-JP")} LIA\n\n確定すると引き落とし、その送信者をこのTCに表示します。`)
      .setFooter({ text: "確認の有効期限は10分です。キャンセルした場合は課金されません。" }).setColor(0xc9a052)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${DARK_DISCLOSURE_PREFIX}:confirm:${requestId}:${confirmationId}`)
        .setLabel("35,000 LIAを支払って開示").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`${DARK_DISCLOSURE_PREFIX}:cancel:${requestId}:${confirmationId}`)
        .setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
    )],
    allowedMentions: { parse: [] as never[] },
  };
}

export function createDisclosureResult(senderId: string) {
  return new EmbedBuilder().setTitle("送信者の開示結果")
    .setDescription(`送信者：<@${senderId}>\nユーザーID：${senderId}`)
    .setColor(0x392247);
}
