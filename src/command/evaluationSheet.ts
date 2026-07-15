import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  User,
} from "discord.js";

import { isTechnician } from "../util/role";
import { EvaluationService } from "../service/evaluationService";
import { InterviewService } from "../service/interviewService";
import { COMMAND_NAMES } from "../constant/command";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { ACCOUNT_MESSAGES } from "../constant/account";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.EVALUATION_SHEET)
  .setDescription("同じVC内の見学者ユーザーの評価シートを作成します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("指定した場合はそのユーザーだけを対象にします")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const operator = interaction.member as GuildMember;
  const targetUser = interaction.options.getUser("user") as User | null;
  
  const targetMember = targetUser ? await interaction.guild?.members.fetch(targetUser.id) : null;

  try {
    EvaluationService.validateCommandCategory(interaction);

    if (
      !(await isTechnician(interaction.user)) ||
      interaction.user.id == "1251952925043982338"
    ) {
      await InterviewService.validateOperator(operator);
    }

    const targetMembers = await EvaluationService.resolveEvaluationTargetMembers(
      operator,
      targetMember,
    );
    if (targetMembers.length === 0) {
      throw new Error(EVALUATION_SHEET_MESSAGES.NO_TARGET_USERS);
    }

    const createdUsers: string[] = [];
    const errorUsers: string[] = [];

    for (const targetMember of targetMembers) {
      try {
        await EvaluationService.validateEvaluationTarget(targetMember);
        const introductionMessage =
          await EvaluationService.findLatestIntroductionMessage(targetMember);
        const introductionMessageUrl =
          EvaluationService.createIntroductionMessageUrl(introductionMessage);
        const { createdForumIds } = await EvaluationService.createEvaluationSheets(
          targetMember,
          introductionMessageUrl,
          interaction.user.id,
        );

        createdUsers.push(`<@${targetMember.id}> (${createdForumIds.length}件作成)`);
      } catch (error: any) {
        errorUsers.push(`<@${targetMember.id}>: ${error.message}`);
      }
    }

    const messages: string[] = [];
    if (createdUsers.length > 0) {
      messages.push(`✅ 評価シート作成\n${createdUsers.join("\n")}`);
    }
    if (errorUsers.length > 0) {
      messages.push(
        `${EVALUATION_SHEET_MESSAGES.ERROR_HEADER}\n${errorUsers.join("\n")}`,
      );
    }

    await interaction.editReply({
      content: messages.join("\n\n"),
    });
  } catch (error) {
    throw error;
  }
}
