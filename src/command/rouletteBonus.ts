import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE_BONUS)
  .setDescription("ルーレット参加者へ30,000通貨を一度だけ配布します")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  const paidCount = await RouletteService.grantParticipationBonus();
  await interaction.editReply({
    content: `🎁 前回の参加ボーナス配布以降に参加した ${paidCount} 名へ30,000通貨を配布しました。`,
  });
}
