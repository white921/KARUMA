import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { EvaluationService } from "../service/evaluationService";
import { assertCanManageEvaluationSheetArchive } from "../util/evaluationSheetPermission";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.EVALUATION_SHEET_RESTORE)
  .setDescription("新しい評価シートを作成して過去評価を添付します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("過去の評価を復元するユーザー")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const operator = interaction.member as GuildMember;
  assertCanManageEvaluationSheetArchive(operator);
  EvaluationService.validateCommandCategory(interaction);

  const user = interaction.options.getUser("user", true);
  const targetMember = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    throw new Error(EVALUATION_SHEET_MESSAGES.TARGET_MEMBER_NOT_FOUND);
  }
  await EvaluationService.validateEvaluationTarget(targetMember);
  const introduction = await EvaluationService.findLatestIntroductionMessage(targetMember);
  const introductionUrl = EvaluationService.createIntroductionMessageUrl(introduction);
  const result = await EvaluationService.createEvaluationSheets(
    targetMember,
    introductionUrl,
    interaction.user.id,
  );

  await interaction.editReply({
    content: `✅ <@${user.id}> の評価シートを${result.createdForumIds.length}件作成しました。過去評価の添付: ${result.restoredForumIds.length}件${result.restoreFailures.length > 0 ? `\n⚠️ 添付失敗: ${result.restoreFailures.length}件` : ""}`,
  });
}
