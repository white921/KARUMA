import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { AdminOpenAccountService } from "../service/adminOpenAccountService";

import { COMMAND_NAMES } from "../constant/command";
import { ADMIN_OPEN_ACCOUNT_MESSAGES } from "../constant/adminOpenAccount";

function formatMemberList(memberIds: string[]): string {
  if (memberIds.length === 0) {
    return "なし";
  }

  const mentions = memberIds.map((memberId) => `<@${memberId}>`);
  return mentions.join(", ");
}

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ADMIN_OPEN_ACCOUNT)
  .setDescription("指定ロールを持つユーザーの口座をまとめて開設します")
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("口座を開設したい対象ロール")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const selectedRole = interaction.options.getRole("role", true);
  const targetRole =
    (await interaction.guild?.roles.fetch(selectedRole.id).catch(() => null)) ??
    null;

  await AdminOpenAccountService.validate(interaction, targetRole);
  if (!targetRole) {
    throw new Error(ADMIN_OPEN_ACCOUNT_MESSAGES.ROLE_NOT_FOUND);
  }

  const members = await interaction.guild?.members.fetch();
  const targetMembers =
    members?.filter((member) => member.roles.cache.has(targetRole.id)) ?? null;

  if (!targetMembers || targetMembers.size === 0) {
    throw new Error(ADMIN_OPEN_ACCOUNT_MESSAGES.NO_TARGETS);
  }

  const { openedMembers, skippedMembers } =
    await AdminOpenAccountService.createAccountsForRole(
      targetMembers,
    );

  const openedMemberIds = openedMembers.map((member) => member.id);
  const skippedByReason = {
    bot: skippedMembers
      .filter((result) => result.reason === "bot")
      .map((result) => result.member.id),
    subAccount: skippedMembers
      .filter((result) => result.reason === "subAccount")
      .map((result) => result.member.id),
    accountExists: skippedMembers
      .filter((result) => result.reason === "accountExists")
      .map((result) => result.member.id),
  };

  await interaction.editReply({
    content:
      `✅ ロール <@&${targetRole.id}> の口座開設処理が完了しました。\n` +
      `開設した人数: ${openedMembers.length}\n` +
      `スキップした人数: ${skippedMembers.length}\n` +
      `開設済み: ${formatMemberList(openedMemberIds)}\n` +
      `既存口座ありでスキップ: ${formatMemberList(skippedByReason.accountExists)}\n` +
      `サブ垢のためスキップ: ${formatMemberList(skippedByReason.subAccount)}\n` +
      `Botのためスキップ: ${formatMemberList(skippedByReason.bot)}`,
  });
}
