import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { RouletteStage } from "../type/roulette";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE_OPEN)
  .setDescription("指定した部のベット受付を開始します")
  .setDMPermission(false)
  .addIntegerOption((option) =>
    option
      .setName("number")
      .setDescription("開催する部（1〜3）")
      .setRequired(true)
      .addChoices(
        { name: "1st", value: 1 },
        { name: "2nd", value: 2 },
        { name: "3rd", value: 3 },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  const stage = interaction.options.getInteger("number", true) as RouletteStage;
  await interaction.editReply({ content: await RouletteService.openRound(stage) });
}
