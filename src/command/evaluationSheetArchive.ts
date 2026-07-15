import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { EvaluationSheetArchiveService } from "../service/evaluationSheetArchiveService";
import {
  assertCanManageEvaluationSheetArchive,
  isDiscordUserId,
} from "../util/evaluationSheetPermission";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.EVALUATION_SHEET_ARCHIVE)
  .setDescription("評価シートを保存してから削除します")
  .addStringOption((option) =>
    option
      .setName("user_id")
      .setDescription("対象者のDiscordユーザーID（サーバー脱退後も指定できます）")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("保存・削除する理由（例: 脱退、評価期間終了）")
      .setMaxLength(256)
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const operator = interaction.member as GuildMember;
  assertCanManageEvaluationSheetArchive(operator);

  const userId = interaction.options.getString("user_id", true).trim();
  if (!isDiscordUserId(userId)) {
    throw new Error(EVALUATION_SHEET_MESSAGES.INVALID_USER_ID);
  }
  const reason = interaction.options.getString("reason");
  const result = await EvaluationSheetArchiveService.saveAndDelete(
    interaction.client,
    userId,
    interaction.user.id,
    reason,
  );

  const saved = result.savedCount > 0 ? `${result.savedCount}件を保存し、` : "すでに保存済みの評価シートを、";
  const pending = result.pendingDeletionCount > 0
    ? ` 削除未完了: ${result.pendingDeletionCount}件`
    : "";
  await interaction.editReply({
    content: `✅ <@${userId}> の評価シート ${saved}${result.deletedCount}件削除しました。${pending}`,
  });
}
