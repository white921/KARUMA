import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE_CLOSE)
  .setDescription("ルーレットのベット受付を締め切ります")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  await interaction.editReply({ content: await RouletteService.closeRound() });
}
