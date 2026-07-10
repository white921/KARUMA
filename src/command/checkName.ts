import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";

import { CheckNameService } from "../service/checkNameService";
import { InterviewService } from "../service/interviewService";

import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.CHECK_NAME)
  .setDescription(
    "自分が今いるVC内の審問待ちメンバーの名前をまとめて確認します。",
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    InterviewService.validateCommandCategory(interaction);
    await InterviewService.validateOperator(interaction.member as GuildMember);
    const user = await interaction.guild!.members.fetch(interaction.user);
    const result = await CheckNameService.validateVcMemberNames(user);

    const successLines =
      result.successes.length > 0
        ? result.successes.map(
            (target) => `- <@${target.id}>: ${target.displayName}`,
          )
        : ["- なし"];

    const failureLines =
      result.failures.length > 0
        ? result.failures.map(
            ({ member: target, reason }) =>
              `- <@${target.id}>: ${target.displayName} / ${reason}`,
          )
        : ["- なし"];

    const warningLines =
      result.warnings.length > 0
        ? result.warnings.map(
            ({ member: target, reason }) =>
              `- <@${target.id}>: ${target.displayName} / ${reason}`,
          )
        : ["- なし"];

    await interaction.editReply({
      content: [
        "✅ VC内の審問待ちメンバーの名前チェックが完了しました。",
        `成功: ${result.successes.length}人`,
        ...successLines,
        `失敗: ${result.failures.length}人`,
        ...failureLines,
        `要確認（同名）: ${result.warnings.length}人`,
        ...warningLines,
      ].join("\n"),
    });
  } catch (error) {
    throw error;
  }
}
