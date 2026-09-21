import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder } from "discord.js";
import { GACHA_COIN_PANEL_TITLE, GACHA_COIN_PREFIX, GACHA_COIN_REWARDS } from "../../constant/market/gachaCoin";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { COLOR } from "../../constant/shared/color";

export function createGachaCoinPanelPayload() {
  return {
    embeds: [new EmbedBuilder().setTitle(GACHA_COIN_PANEL_TITLE).setColor(COLOR.LIGFT_PINK)
      .setDescription("ガチャコインをアイテムと交換できます。「交換する」を押してチケットを選び、内容を確認して確定してください。")
      .addFields(
        { name: "パネルで交換", value: GACHA_COIN_REWARDS.map(r => `${r.label}：**${r.cost}枚**`).join("\n") },
        { name: "チケット内で従業員が対応", value: "通行証（1ヶ月）：**30枚**\n評価延長3：**30枚**\n評価延長5：**50枚**\n再評価券：**75枚**\nオリジナルロール（1週間）：**150枚**\nご希望の方はショップのチケット内で従業員にお申し付けください。" },
      )],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${GACHA_COIN_PREFIX}:start`).setLabel("交換する").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${GACHA_COIN_PREFIX}:balance`).setLabel("コイン所持数").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW).setLabel("所持チケット確認").setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] as never[] },
  };
}

export class GachaCoinPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.GACHA_COIN_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("アイテム交換所が見つかりません。");
    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find(m => m.author.id === client.user?.id && m.embeds.some(e => e.title === GACHA_COIN_PANEL_TITLE));
    if (existing) await existing.edit(createGachaCoinPanelPayload());
    else await channel.send(createGachaCoinPanelPayload());
  }
}
