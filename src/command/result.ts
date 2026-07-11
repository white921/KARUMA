import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE_RESULT)
  .setDescription("ルーレットの結果を確定し、自動で配当します")
  .setDMPermission(false)
  .addIntegerOption((option) =>
    option.setName("number").setDescription("出た数字（0〜36）").setRequired(true).setMinValue(0).setMaxValue(36),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  const number = interaction.options.getInteger("number", true);
  const settlement = await RouletteService.settleRound(number);
  if (interaction.channel?.isSendable()) {
    await interaction.channel.send({ embeds: [RouletteService.createSettlementEmbed(settlement)] });
  }
  await interaction.editReply({ content: "✅ 結果を確定し、配当を処理しました。" });
}
