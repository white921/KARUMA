import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { MANAGEMENT_ROLE_IDS } from "../../constant/shared/management";
import { hasOperatorRole } from "./operatorPermission";

export function hasManagementPermission(member: unknown): boolean {
  return hasOperatorRole(member, MANAGEMENT_ROLE_IDS);
}

export async function assertManagementPermission(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember> {
  if (!interaction.guild) throw new Error("サーバー内でのみ使用できます。");
  const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
  if (!hasManagementPermission(member)) {
    throw new Error("英傑・皇帝・システム支配人のみ実行できます。");
  }
  return member;
}
