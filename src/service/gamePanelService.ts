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
import { GAME_PANEL_MESSAGES, PANEL_MESSAGES } from "../constant/panel";
import { COLOR } from "../constant/color";

export function createGamePanelActionRows() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.GAME_SHORT)
      .setLabel(GAME_PANEL_MESSAGES.SHORT)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.GAME_LONG)
      .setLabel(GAME_PANEL_MESSAGES.LONG)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.GAME_PASS)
      .setLabel(GAME_PANEL_MESSAGES.GAME_PASS)
      .setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

export class GamePanelService {
  /**
   * 夢遊パネルを作成
   * 6時間プランボタン
   * 12時間プランボタン
   * 夢遊パスボタン
   * 残高確認ボタン
   * @param client クライアント
   */
  static async createGamePanel(client: Client) {
    try {
      const channelId = TEXT_CHANNEL_IDS.GAME_PANEL;
      const channel = await client.channels.fetch(channelId);

      if (channel && channel.isTextBased()) {
        // パネルメッセージを作成
        const embed = new EmbedBuilder()
          .setTitle(GAME_PANEL_MESSAGES.TITLE)
          .setDescription(GAME_PANEL_MESSAGES.DESCRIPTION)
          .setColor(COLOR.COBALT_GREEN)
          .setThumbnail(
            "https://cdn.discordapp.com/attachments/1444598540562206831/1448170627843489812/ChatGPT_Image_20251210_13_32_42.png?ex=693a497f&is=6938f7ff&hm=a1654bb43772aa2043d73b55df62ea7ee48b38053b00821ac1ac97cb3878a8d2&"
          );

        // コマンドボタンを作成
        const [row1, row2] = createGamePanelActionRows();

        await deletePanelMessage(
          channel as TextChannel,
          client,
          GAME_PANEL_MESSAGES.TITLE
        );

        // 新しいゲームパネルメッセージを送信
        await (channel as TextChannel).send({
          embeds: [embed],
          components: [row1, row2],
        });
      }
    } catch (error) {
      throw error;
    }
  }
}
