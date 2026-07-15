import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { COLOR } from "../constant/color";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { OMIKUJI_PANEL_MESSAGES } from "../constant/panel";
import { deletePanelMessage } from "../util/channelMessage";

export function createOmikujiPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.OMIKUJI_DRAW)
      .setLabel(OMIKUJI_PANEL_MESSAGES.DRAW)
      .setStyle(ButtonStyle.Primary),
  );
}

export class OmikujiPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.OMIKUJI_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(OMIKUJI_PANEL_MESSAGES.ERROR);
    }

    const embed = new EmbedBuilder()
      .setTitle(OMIKUJI_PANEL_MESSAGES.TITLE)
      .setDescription(OMIKUJI_PANEL_MESSAGES.DESCRIPTION)
      .setColor(COLOR.LIGFT_PINK);

    await deletePanelMessage(channel, client, OMIKUJI_PANEL_MESSAGES.TITLE);
    await channel.send({
      embeds: [embed],
      components: [createOmikujiPanelActionRow()],
    });
  }
}
