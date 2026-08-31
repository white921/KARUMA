import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { SOLITARY_CELL_MESSAGES } from "../constant/solitaryCell";
import { deletePanelMessage } from "../util/channelMessage";

export function createSolitaryCellPanelActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SOLITARY_CELL_CREATE)
      .setLabel(SOLITARY_CELL_MESSAGES.CREATE)
      .setStyle(ButtonStyle.Danger),
  );
}

export class SolitaryCellPanelService {
  static async createPanel(client: Client) {
    const channel = await client.channels.fetch(
      TEXT_CHANNEL_IDS.SOLITARY_CELL_PANEL,
    );
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("独房作成パネルのチャンネルが見つからないか、無効な型です。");
    }

    await deletePanelMessage(channel, client, SOLITARY_CELL_MESSAGES.TITLE);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(SOLITARY_CELL_MESSAGES.TITLE)
          .setDescription(SOLITARY_CELL_MESSAGES.DESCRIPTION)
          .setColor(COLOR.RED),
      ],
      components: [createSolitaryCellPanelActionRow()],
    });
  }
}
