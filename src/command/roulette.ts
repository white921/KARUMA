import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { RouletteStage } from "../type/roulette";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE_OPEN)
  .setDescription("指定した部のベット受付を開始します")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("fase")
      .setDescription("開催するフェーズ")
      .setRequired(true)
      .addChoices(
        { name: "1st", value: "1st" },
        { name: "2nd", value: "2nd" },
        { name: "3rd", value: "3rd" },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  const stageByFase: Record<string, RouletteStage> = {
    "1st": 1,
    "2nd": 2,
    "3rd": 3,
  };
  const stage = stageByFase[interaction.options.getString("fase", true)];
  if (!stage) {
    throw new Error("フェーズは1st・2nd・3rdから選択してください。");
  }
  await interaction.editReply({ content: await RouletteService.openRound(stage) });
}
