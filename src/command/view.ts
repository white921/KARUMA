import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { ViewService } from "../service/viewService";

import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.VIEW)
  .setDescription("自分の残高を確認します");

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.editReply({
      content: await ViewService.createViewMessage(interaction.user.id),
    });
  } catch (error) {
    throw error;
  }
}
