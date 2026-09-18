import { Client, GuildMember, PartialGuildMember } from "discord.js";

import { AccountService } from "../../service/account/accountService";
import { ServerBoostService } from "../../service/member/serverBoostService";
import { addRole, deleteRole } from "../../util/member/role";

import { RETURN_MEMBER_ROLE_CHANGE_EXCLUDED_USER_IDS, ROLE_IDS } from "../../constant/shared/id";

export function shouldSkipReturnMemberRoleChange(userId: string): boolean {
  return RETURN_MEMBER_ROLE_CHANGE_EXCLUDED_USER_IDS.has(userId);
}

/**
 * ロールの変更に伴う処理を実行するハンドラ
 * @param client クライアント
 * @param oldMember 更新前のメンバー情報
 * @param newMember 更新後のメンバー情報
 */
export async function handleRoleChange(
  client: Client,
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  const hadSinmonmati = oldMember.roles.cache.has(
    ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI,
  );
  const hasSinmonmati = newMember.roles.cache.has(
    ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI,
  );
  if (
    !hadSinmonmati &&
    hasSinmonmati &&
    (await AccountService.hasAccount(newMember.id)) &&
    !shouldSkipReturnMemberRoleChange(newMember.id)
  ) {
    await addRole(newMember, ROLE_IDS.CORE_MEMBER_ROLES.DEMODORI);
    await deleteRole(newMember, ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI);
  }

  await ServerBoostService.handleMemberUpdate(oldMember, newMember, client);
}
