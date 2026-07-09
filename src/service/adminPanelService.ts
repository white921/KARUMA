import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { THREAD_IDS } from "../constant/id";
import { ADMIN_PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";

export function createAdminPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.ADMIN_VIEW)
      .setLabel(ADMIN_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.ADMIN_MINT)
      .setLabel(ADMIN_PANEL_MESSAGES.MINT)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.ADMIN_BURN)
      .setLabel(ADMIN_PANEL_MESSAGES.BURN)
      .setStyle(ButtonStyle.Danger),
  );
}

export class AdminPanelService {
  /**
   * 管理者パネルを作成
   * 残高確認ボタン
   * コイン減額ボタン
   * コイン付与ボタン
   * @param client クライアント
   */
  static async createAdminPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        THREAD_IDS.ADMIN_PANEL_THREAD,
      );

      if (channel && channel.isTextBased()) {
        // パネルメッセージを作成
        const embed = new EmbedBuilder()
          .setTitle(ADMIN_PANEL_MESSAGES.TITLE)
          .setDescription(ADMIN_PANEL_MESSAGES.DESCRIPTION)
          .setColor(COLOR.GREEN);

        // コマンドボタンを作成
        const row1 = createAdminPanelActionRow();

        await deletePanelMessage(
          channel as TextChannel,
          client,
          ADMIN_PANEL_MESSAGES.TITLE,
        );

        // 新しい管理者パネルメッセージを送信
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
