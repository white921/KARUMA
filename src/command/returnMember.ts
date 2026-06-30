import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  User,
} from "discord.js";

import { ReturnMemberService } from "../service/returnMemberService";

import { COMMAND_NAMES } from "../constant/command";
import { ACCOUNT_MESSAGES } from "../constant/account";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.RETURN_MEMBER)
  .setDescription("出戻り対応に必要な情報を表示します")
  .addUserOption((option) =>
    option
      .setName("target_member")
      .setDescription("確認したいユーザー")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("target_member") as User | null;
  if (!targetUser) {
    throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
  }
  const targetMember = await interaction.guild?.members.fetch(targetUser.id);
  if (!targetMember) {
    throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
  }

  await interaction.editReply({
    embeds: [await ReturnMemberService.createReturnMemberEmbed(targetMember)],
  });
}
