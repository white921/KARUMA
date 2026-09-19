import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder } from "discord.js";
import { TICKET_EXCHANGE_PREFIX, TICKET_EXCHANGE_RATES, TICKET_EXCHANGE_TITLE } from "../../constant/inventory/ticketExchange";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { COLOR } from "../../constant/shared/color";

export function createTicketExchangePanelPayload() {
  return {
    embeds: [new EmbedBuilder().setTitle(TICKET_EXCHANGE_TITLE).setColor(COLOR.LIGFT_PINK)
      .setDescription([
        "使う予定のないチケットをLIAに換金できます。",
        "**同じ種類のチケットを5枚単位（5枚・10枚・15枚…）で換金できます。**",
        "種類を選び、「−5枚」「＋5枚」で枚数を調整して、受取額を確認してから確定してください。",
        "換金したチケットは戻せません。異なる種類の合算はできません。",
        "",
        "**換金レート（5枚あたり）**",
        ...TICKET_EXCHANGE_RATES.map((rate) => `${rate.label}: **${(rate.unitPrice * 5).toLocaleString()} LIA**`),
      ].join("\n"))],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${TICKET_EXCHANGE_PREFIX}:start`).setLabel("チケット換金").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW).setLabel("所持チケット確認").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PANEL_COMMAND_NAMES.VIEW).setLabel("残高確認").setStyle(ButtonStyle.Primary),
    )],
    allowedMentions: { parse: [] as never[] },
  };
}

export class TicketExchangePanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("換金パネルのチャンネルが見つかりません。");
    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find((message) => message.author.id === client.user?.id &&
      message.embeds.some((embed) => embed.title === TICKET_EXCHANGE_TITLE));
    const payload = createTicketExchangePanelPayload();
    if (existing) await existing.edit(payload);
    else await channel.send(payload);
  }
}
