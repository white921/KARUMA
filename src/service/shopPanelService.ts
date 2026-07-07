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
import { SHOP_PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

export function createShopPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SHOP_SEND)
      .setLabel(SHOP_PANEL_MESSAGES.SHOP_SEND)
      .setStyle(ButtonStyle.Success)
      .setEmoji(EXTERNALE_MOJI_VIEWS.ROYAL_COIN),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(SHOP_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EXTERNALE_MOJI_VIEWS.WALLET),
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
    try {
      const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.SHOP_PANEL);

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(SHOP_PANEL_MESSAGES.ERROR);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(SHOP_PANEL_MESSAGES.TITLE)
        .setDescription(SHOP_PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.LIGFT_PINK)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434890727569231983/1440528890480033833/ChatGPT_Image_20251119_11_27_20.png?ex=691fce13&is=691e7c93&hm=2a4fbb9c5783417860da7f86487c6c4365b0caabdcfcea3b47b954441cec5553&",
        );

      // コマンドボタンを作成
      const row1 = createShopPanelActionRow();

      await deletePanelMessage(channel, client, SHOP_PANEL_MESSAGES.TITLE);

      // 新しいパネルメッセージを送信
      await channel.send({
        embeds: [embed],
        components: [row1],
      });
    } catch (error) {
      throw error;
    }
  }
}
