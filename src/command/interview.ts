import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  User,
} from "discord.js";

import { addRole, deleteRole, isTechnician } from "../util/role";
import { AccountService } from "../service/accountService";
import { InterviewService } from "../service/interviewService";

import { ROLE_IDS } from "../constant/id";
import { INTERVIEW_MESSAGES } from "../constant/interview";
import { INITIAL_WALLET } from "../constant/account";
import { COMMAND_NAMES } from "../constant/command";
import { ACCOUNT_MESSAGES } from "../constant/account";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.INTERVIEW_PASS)
  .setDescription("同じVC内の審問待ちユーザーを面接通過にします")
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
    InterviewService.validateCommandCategory(interaction);

    if (
      !(await isTechnician(interaction.user)) ||
      interaction.user.id == "1251952925043982338"
    ) {
      await InterviewService.validateOperator(operator);
    }

    const targetMembers = await InterviewService.resolveInterviewTargetMembers(
      operator,
      targetMember,
    );
    if (targetMembers.length === 0) {
      throw new Error(INTERVIEW_MESSAGES.NO_TARGET_USERS);
    }

    const successUsers: string[] = [];
    const errorUsers: string[] = [];

    for (const targetMember of targetMembers) {
      try {
        await InterviewService.validateInterviewTarget(targetMember);

        await deleteRole(targetMember, ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI);
        await addRole(targetMember, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN);
        await AccountService.createAccount(
          targetMember.id,
          targetMember.displayName,
          INITIAL_WALLET,
        );

        successUsers.push(`<@${targetMember.id}>`);
      } catch (error: any) {
        errorUsers.push(`<@${targetMember.id}>: ${error.message}`);
      }
    }

    const messages: string[] = [];
    if (successUsers.length > 0) {
      messages.push(`✅ 面接通過: ${successUsers.join(", ")}`);
    }
    if (errorUsers.length > 0) {
      messages.push(
        `${INTERVIEW_MESSAGES.ERROR_HEADER}\n${errorUsers.join("\n")}`,
      );
    }

    await interaction.editReply({
      content: messages.join("\n\n"),
    });
  } catch (error) {
    throw error;
  }
}
