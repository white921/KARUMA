import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  ThreadChannel,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { THREAD_IDS } from "../constant/id";
import { DIARY_PANEL_MESSAGES, PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

export class DiaryPanelService {
  static async createDiaryPanel(client: Client) {
    try {
      const threadId = THREAD_IDS.DIARY_PANEL_THREAD;
      if (!threadId) {
        console.warn(DIARY_PANEL_MESSAGES.CHANNEL_NOT_CONFIGURED);
        return;
      }

      const thread = await client.channels.fetch(threadId);

      if (!thread || !thread.isThread() || !thread.isTextBased()) {
        console.error(DIARY_PANEL_MESSAGES.ERROR);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(DIARY_PANEL_MESSAGES.TITLE)
        .setDescription(DIARY_PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.PINK);

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.DIARY_PRIVATE)
          .setLabel(DIARY_PANEL_MESSAGES.PRIVATE)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.DIARY_PUBLIC)
          .setLabel(DIARY_PANEL_MESSAGES.PUBLIC)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.DIARY_UPDATE)
          .setLabel(DIARY_PANEL_MESSAGES.UPDATE)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.VIEW)
          .setLabel(PANEL_MESSAGES.VIEW)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(EXTERNALE_MOJI_VIEWS.WALLET),
      );

      await deletePanelMessage(
        thread as ThreadChannel,
        client,
        DIARY_PANEL_MESSAGES.TITLE,
      );

      await (thread as ThreadChannel).send({
        embeds: [embed],
        components: [row1],
      });
    } catch (error) {
      throw error;
    }
  }
}
