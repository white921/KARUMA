import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { SUPERCHAT_PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { deletePanelMessage } from "../util/channelMessage";

export function createSuperchatPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SUPERCHAT_SEND)
      .setLabel(SUPERCHAT_PANEL_MESSAGES.SEND)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(SUPERCHAT_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary),
  );
}

export class SuperchatPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.SUPERCHAT_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.ERROR);
    }

    const embed = new EmbedBuilder()
      .setTitle(SUPERCHAT_PANEL_MESSAGES.TITLE)
      .setDescription(SUPERCHAT_PANEL_MESSAGES.DESCRIPTION)
      .setColor(COLOR.LIGFT_PINK);

    await deletePanelMessage(channel, client, SUPERCHAT_PANEL_MESSAGES.TITLE);
    await channel.send({
      embeds: [embed],
      components: [createSuperchatPanelActionRow()],
    });
  }
}
