import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { EvaluationService } from "../service/evaluationService";
import { EvaluationSheetArchiveService } from "../service/evaluationSheetArchiveService";
import { assertCanManageEvaluationSheetArchive } from "../util/evaluationSheetPermission";

function fileNameFor(userId: string): string {
  return `past-evaluation-${userId}.html`;
}

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.EVALUATION_SHEET_RESTORE)
  .setDescription("この評価スレッドへ過去の評価を添付します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("過去の評価を復元するユーザー")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const operator = interaction.member as GuildMember;
  assertCanManageEvaluationSheetArchive(operator);

  const channel = interaction.channel;
  if (!channel?.isThread() || !EvaluationService.getEvaluationForumIds().includes(channel.parentId ?? "")) {
    throw new Error(EVALUATION_SHEET_MESSAGES.RESTORE_NOT_IN_EVALUATION_THREAD);
  }

  const user = interaction.options.getUser("user", true);
  const archive = await EvaluationSheetArchiveService.getLatestArchiveForForum(
    user.id,
    channel.parentId!,
  );
  if (!archive) {
    throw new Error(EVALUATION_SHEET_MESSAGES.ARCHIVE_NOT_FOUND);
  }

  await channel.send({
    content: `📄 <@${user.id}> の過去評価を復元しました。`,
    files: [{ attachment: Buffer.from(archive.html, "utf8"), name: fileNameFor(user.id) }],
  });
  await interaction.editReply({
    content: `✅ このスレッドに ${fileNameFor(user.id)} を添付しました。`,
  });
}
