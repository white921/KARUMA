import { ROLE_IDS } from "../constant/id";

type RoleBackedMember = {
  roles?: string[] | { cache?: { has: (roleId: string) => boolean } };
};

function memberHasRole(member: unknown, roleId: string): boolean {
  const roles = (member as RoleBackedMember | null | undefined)?.roles;
  return Array.isArray(roles) ? roles.includes(roleId) : Boolean(roles?.cache?.has(roleId));
}

/** 操作者の権限判定専用。料金・対象者の属性判定には使用しない。 */
export function hasSystemAdminRole(member: unknown): boolean {
  return memberHasRole(member, ROLE_IDS.GIJUTU_LEADER);
}

/** システム支配人は全コマンド・パネルの操作権限を持つ。 */
export function hasOperatorRole(member: unknown, allowedRoleIds: readonly string[]): boolean {
  return hasSystemAdminRole(member) || allowedRoleIds.some((roleId) => memberHasRole(member, roleId));
}
