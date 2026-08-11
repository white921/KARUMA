import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import {
  DARK_SHOP_PANEL_MESSAGES,
  SHOP_PANEL_MESSAGES,
} from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";

export function createShopPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SHOP_SEND)
      .setLabel(SHOP_PANEL_MESSAGES.SHOP_SEND)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW)
      .setLabel(SHOP_PANEL_MESSAGES.MARKET_GACHA_DRAW)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(SHOP_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW)
      .setLabel(SHOP_PANEL_MESSAGES.TICKET_VIEW)
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createDarkShopPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.DARK_SHOP_SEND)
      .setLabel(SHOP_PANEL_MESSAGES.SHOP_SEND)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(SHOP_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary),
  );
}

export class ShopPanelService {
  /**
   * ショップパネルを作成
   * 送金ボタン
   * 残高確認ボタン
   * @param client クライアント
   */
  static async createShopPanel(client: Client) {
    await this.createPanelInChannel(
      client,
      TEXT_CHANNEL_IDS.SHOP_PANEL,
      SHOP_PANEL_MESSAGES.TITLE,
      SHOP_PANEL_MESSAGES.DESCRIPTION,
      SHOP_PANEL_MESSAGES.ERROR,
      createShopPanelActionRow(),
    );
  }

  static async createDarkShopPanel(client: Client) {
    await this.createPanelInChannel(
      client,
      TEXT_CHANNEL_IDS.DARK_SHOP_PANEL,
      DARK_SHOP_PANEL_MESSAGES.TITLE,
      DARK_SHOP_PANEL_MESSAGES.DESCRIPTION,
      DARK_SHOP_PANEL_MESSAGES.ERROR,
      createDarkShopPanelActionRow(),
    );
  }

  private static async createPanelInChannel(
    client: Client,
    channelId: string,
    title: string,
    description: string,
    errorMessage: string,
    actionRow: ActionRowBuilder<ButtonBuilder>,
  ) {
    try {
      const channel = await client.channels.fetch(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(errorMessage);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(COLOR.LIGFT_PINK)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434890727569231983/1440528890480033833/ChatGPT_Image_20251119_11_27_20.png?ex=691fce13&is=691e7c93&hm=2a4fbb9c5783417860da7f86487c6c4365b0caabdcfcea3b47b954441cec5553&",
        );

      await deletePanelMessage(channel, client, title);

      // 新しいパネルメッセージを送信
      await channel.send({
        embeds: [embed],
        components: [actionRow],
      });
    } catch (error) {
      throw error;
    }
  }
}
