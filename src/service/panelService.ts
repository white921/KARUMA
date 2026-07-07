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
import { PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

export function createBankPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(EXTERNALE_MOJI_VIEWS.WALLET),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SEND)
      .setLabel(PANEL_MESSAGES.SEND)
      .setStyle(ButtonStyle.Success)
      .setEmoji(EXTERNALE_MOJI_VIEWS.ROYAL_COIN),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HISTORY)
      .setLabel(PANEL_MESSAGES.HISTORY)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EXTERNALE_MOJI_VIEWS.HISTORY),
  );
}

export class PanelService {
  /**
   * 一般パネルを作成
   * 残高確認ボタン
   * コイン送金ボタン
   * @param client クライアント
   */
  static async createPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        TEXT_CHANNEL_IDS.GINKOU_PANEL
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(PANEL_MESSAGES.ERROR);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(PANEL_MESSAGES.TITLE)
        .setDescription(PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.LIGFT_PINK)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434890727569231983/1440528890480033833/ChatGPT_Image_20251119_11_27_20.png?ex=691fce13&is=691e7c93&hm=2a4fbb9c5783417860da7f86487c6c4365b0caabdcfcea3b47b954441cec5553&"
        );

      // コマンドボタンを作成
      const row1 = createBankPanelActionRow();

      await deletePanelMessage(channel, client, PANEL_MESSAGES.TITLE);

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
