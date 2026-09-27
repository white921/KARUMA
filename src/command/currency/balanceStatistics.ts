import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { BalanceStatisticsService } from "../../service/currency/balanceStatisticsService";
import { assertManagementPermission } from "../../util/shared/managementPermission";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.BALANCE_STATISTICS)
  .setDescription("30,000LIAの口座を除外した残高の平均値・中央値を確認します")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await assertManagementPermission(interaction);
  const result = await BalanceStatisticsService.get(interaction.guild!);
  const format = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  await interaction.editReply({ content: [
    "📊 残高統計",
    "対象：サーバー在籍中のメイン口座（Bot・サブ垢を除外）",
    `30,000LIAの口座を除外：${result.excluded}件`,
    `集計対象：${result.count}件`,
    ...(result.count ? [
      `平均値：**${format(result.average!)}LIA**`,
      `中央値：**${format(result.median!)}LIA**`,
    ] : ["集計対象の口座はありません。"]),
  ].join("\n") });
}
