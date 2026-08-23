import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { CREATOR_EMBLEM_PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { CREATOR_EMBLEM_ENABLED } from "../constant/creatorEmblem";
import { deletePanelMessage } from "../util/channelMessage";

export function createCreatorEmblemPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY)
      .setLabel(CREATOR_EMBLEM_PANEL_MESSAGES.PAY)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!CREATOR_EMBLEM_ENABLED),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(CREATOR_EMBLEM_PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary),
  );
}

export class CreatorEmblemPanelService {
  static async createPanel(client: Client): Promise<void> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.CREATOR_EMBLEM_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.ERROR);
    }

    const embed = new EmbedBuilder()
      .setTitle(CREATOR_EMBLEM_PANEL_MESSAGES.TITLE)
      .setDescription(CREATOR_EMBLEM_PANEL_MESSAGES.DESCRIPTION)
      .setColor(COLOR.LIGFT_PINK);

    await deletePanelMessage(channel, client, CREATOR_EMBLEM_PANEL_MESSAGES.TITLE);
    await channel.send({
      embeds: [embed],
      components: [createCreatorEmblemPanelActionRow()],
    });
  }
}
