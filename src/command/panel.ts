import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { PanelInstallService } from "../service/panelInstallService";

import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.PANEL)
  .setDescription("実行したチャンネルに対応するパネルを設置します")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.editReply({
      content: await PanelInstallService.installByCurrentChannel(interaction),
    });
  } catch (error) {
    throw error;
  }
}
