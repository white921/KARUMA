import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder } from "discord.js";
import { CAST_MENUS, CAST_PAYMENT_PREFIX, CAST_PAYMENT_TITLE } from "../../constant/cast/castPayment";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
export function createCastPaymentPanelPayload() {
  return {
    embeds: [new EmbedBuilder().setTitle(CAST_PAYMENT_TITLE).setColor(COLOR.PINK)
      .setDescription("**基本メニュー**\nツーショ：30分 / 10,000 LIA\nフリー：30分 / 5,000 LIA\n団体指名：キャスト1人につき30分 / 25,000 LIA\n利用時間は30分単位で選べます。\n\nツーショ・団体指名はキャストと利用時間を指定してください。\nフリーは利用時間のみ指定してください。\nオプションは「お給仕メイド」「お仕え執事」から、キャスト・金額・内容を指定できます。\n最後の確認画面で確定すると、LEVELIA Botへ支払われます。")],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      Object.entries(CAST_MENUS).map(([key, menu]) => new ButtonBuilder()
        .setCustomId(`${CAST_PAYMENT_PREFIX}:start:${key}`).setLabel(menu.label)
        .setStyle(menu.ratePerHalfHour ? ButtonStyle.Primary : ButtonStyle.Secondary)))],
    allowedMentions: { parse: [] as never[] },
  };
}
export class CastPaymentPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("キャスト支払いパネルのチャンネルが見つかりません。");
    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find(m => m.author.id === client.user?.id && m.embeds.some(e => e.title === CAST_PAYMENT_TITLE));
    if (existing) await existing.edit(createCastPaymentPanelPayload());
    else await channel.send(createCastPaymentPanelPayload());
  }
}
