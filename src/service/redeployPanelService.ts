import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ChannelType,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { REDEPLOY_PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

export class RedeployPanelService {
  /**
   * Bot再起動パネルを作成
   * Bot再起動ボタン
   * @param client クライアント
   */
  static async createRedeployPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        TEXT_CHANNEL_IDS.REDEPLOY_PANEL,
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(REDEPLOY_PANEL_MESSAGES.ERROR);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(REDEPLOY_PANEL_MESSAGES.TITLE)
        .setDescription(REDEPLOY_PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.LIGFT_PINK)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434890727569231983/1440528890480033833/ChatGPT_Image_20251119_11_27_20.png?ex=691fce13&is=691e7c93&hm=2a4fbb9c5783417860da7f86487c6c4365b0caabdcfcea3b47b954441cec5553&",
        );

      // コマンドボタンを作成
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.REDEPLOY)
          .setLabel(REDEPLOY_PANEL_MESSAGES.BUTTON)
          .setStyle(ButtonStyle.Danger)
          .setEmoji(EXTERNALE_MOJI_VIEWS.RESTART),
      );

      await deletePanelMessage(channel, client, REDEPLOY_PANEL_MESSAGES.TITLE);

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
