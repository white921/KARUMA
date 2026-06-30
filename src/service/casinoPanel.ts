import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CASINO_PANEL_MESSAGES, PANEL_MESSAGES } from "../constant/panel";
import { COLOR } from "../constant/color";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

export class CasinoPanelService {
  /**
   * カジノパネルを作成
   * GFボタン
   * 麻雀ボタン
   * その他ボタン
   * @param client クライアント
   */
  static async createCasinoPanel(client: Client) {
    try {
      const channelId = TEXT_CHANNEL_IDS.CASINO_PANEL;
      const channel = await client.channels.fetch(channelId);

      if (channel && channel.isTextBased()) {
        // パネルメッセージを作成
        const embed = new EmbedBuilder()
          .setTitle(CASINO_PANEL_MESSAGES.TITLE)
          .setDescription(CASINO_PANEL_MESSAGES.DESCRIPTION)
          .setColor(COLOR.GREEN);

        // コマンドボタンを作成
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CASINO_GF)
            .setLabel(CASINO_PANEL_MESSAGES.GF)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EXTERNALE_MOJI_VIEWS.GF),
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CASINO_MAJONG)
            .setLabel(CASINO_PANEL_MESSAGES.MAJONG)
            .setStyle(ButtonStyle.Success)
            .setEmoji(EXTERNALE_MOJI_VIEWS.MAJONG),
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CASINO_OTHER)
            .setLabel(CASINO_PANEL_MESSAGES.OTHER)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EXTERNALE_MOJI_VIEWS.OTHER),
          new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.VIEW)
          .setLabel(PANEL_MESSAGES.VIEW)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(EXTERNALE_MOJI_VIEWS.WALLET)
        );

        await deletePanelMessage(channel as TextChannel, client, CASINO_PANEL_MESSAGES.TITLE);

        // 新しいカジノパネルメッセージを送信
        await (channel as TextChannel).send({
          embeds: [embed],
          components: [row1],
        });
      }
    } catch (error) {
      throw error;
    }
  }
}
