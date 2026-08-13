import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { TEXT_CHANNEL_IDS } from "../constant/id";
import { HAZAMA_PANEL_MESSAGES, PANEL_MESSAGES } from "../constant/panel";
import { deletePanelMessage } from "../util/channelMessage";

export function createHazamaPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HAZAMA_ACCESS)
      .setLabel(HAZAMA_PANEL_MESSAGES.ACCESS)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Secondary),
  );
}

export class HazamaPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.HAZAMA_PANEL);
    if (!channel || !channel.isTextBased()) {
      throw new Error(HAZAMA_PANEL_MESSAGES.ERROR);
    }

    const embed = new EmbedBuilder()
      .setTitle(HAZAMA_PANEL_MESSAGES.TITLE)
      .setDescription(HAZAMA_PANEL_MESSAGES.DESCRIPTION)
      .setColor(COLOR.PURPLE);

    await deletePanelMessage(
      channel as TextChannel,
      client,
      HAZAMA_PANEL_MESSAGES.TITLE,
    );
    await (channel as TextChannel).send({
      embeds: [embed],
      components: [createHazamaPanelActionRow()],
    });
  }
}
