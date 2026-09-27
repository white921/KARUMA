import { GuildMemberCacheService } from "../../service/system/guildMemberCacheService";
import {
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import { AdminOpenAccountService } from "../../service/account/adminOpenAccountService";

import { COMMAND_NAMES } from "../../constant/shared/command";
import { ADMIN_OPEN_ACCOUNT_MESSAGES } from "../../constant/account/adminOpenAccount";
import { formatRoleNameForOutput } from "../../util/member/role";

function formatMemberList(memberIds: string[]): string {
  if (memberIds.length === 0) {
    return "なし";
  }

  const mentions = memberIds.slice(0, 10).map((memberId) => `<@${memberId}>`);
  return mentions.join(", ") + (memberIds.length > 10 ? ` ほか${memberIds.length - 10}人` : "");
}

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ADMIN_OPEN_ACCOUNT)
  .setDescription("指定ユーザーまたは指定ロールのメンバーの口座を開設します")
  .setDMPermission(false)
  .addUserOption(option => option.setName("ユーザー").setDescription("口座を開設するユーザー（ロールとどちらか一方）"))
  .addRoleOption((option) =>
    option
      .setName("ロール")
      .setDescription("まとめて口座を開設する対象ロール（ユーザーとどちらか一方）"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await AdminOpenAccountService.validate(interaction);
  const selectedRole = interaction.options.getRole("ロール");
  const selectedUser = interaction.options.getUser("ユーザー");
  if (Boolean(selectedRole) === Boolean(selectedUser)) {
    throw new Error("ユーザーかロールのどちらか一方を指定してください。");
  }
  const guild = interaction.guild!;
  let targetMembers: Collection<string, GuildMember>;
  let targetLabel: string;
  if (selectedUser) {
    const member = await guild.members.fetch({ user: selectedUser.id, force: true });
    targetMembers = new Collection([[member.id, member]]);
    targetLabel = `<@${member.id}>`;
  } else {
    const targetRole = await guild.roles.fetch(selectedRole!.id);
    if (!targetRole) throw new Error(ADMIN_OPEN_ACCOUNT_MESSAGES.ROLE_NOT_FOUND);
    const members = await GuildMemberCacheService.getMembers(guild);
    targetMembers = members.filter(member => member.roles.cache.has(targetRole.id));
    targetLabel = `ロール **${formatRoleNameForOutput(targetRole.name)}**`;
  }
  if (targetMembers.size === 0) {
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
      `✅ ${targetLabel} の口座開設処理が完了しました。\n` +
      `開設した人数: ${openedMembers.length}\n` +
      `スキップした人数: ${skippedMembers.length}\n` +
      `開設済み: ${formatMemberList(openedMemberIds)}\n` +
      `既存口座ありでスキップ: ${formatMemberList(skippedByReason.accountExists)}\n` +
      `サブ垢のためスキップ: ${formatMemberList(skippedByReason.subAccount)}\n` +
      `Botのためスキップ: ${formatMemberList(skippedByReason.bot)}`,
    allowedMentions: { parse: [] },
  });
}
