import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { getRouletteEventKey } from "../constant/roulette";
import { RouletteStage } from "../type/roulette";
import { RouletteService } from "../service/rouletteService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROULETTE)
  .setDescription("ヨーロピアンルーレットの運営操作")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("open")
      .setDescription("指定した部のベット受付を開始します")
      .addIntegerOption((option) =>
        option.setName("stage").setDescription("部").setRequired(true)
          .addChoices({ name: "第1部", value: 1 }, { name: "第2部", value: 2 }, { name: "第3部", value: 3 }),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("close").setDescription("ベット受付を締め切ります"))
  .addSubcommand((subcommand) => subcommand.setName("status").setDescription("現在のラウンド状況を確認します"))
  .addSubcommand((subcommand) => subcommand.setName("bonus").setDescription("イベント参加者へ30,000通貨を一度だけ配布します"));

export async function execute(interaction: ChatInputCommandInteraction) {
  await RouletteService.assertOperator(interaction);
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "open": {
      const stage = interaction.options.getInteger("stage", true) as RouletteStage;
      await interaction.editReply({ content: await RouletteService.openRound(stage) });
      return;
    }
    case "close":
      await interaction.editReply({ content: await RouletteService.closeRound() });
      return;
    case "status":
      await interaction.editReply({ content: await RouletteService.getStatus() });
      return;
    case "bonus": {
      const paidCount = await RouletteService.grantParticipationBonus();
      await interaction.editReply({
        content: `🎁 イベント（${getRouletteEventKey()}）の参加者 ${paidCount} 名へ30,000通貨を配布しました。すでに配布済みの参加者は対象外です。`,
      });
      return;
    }
  }
}
