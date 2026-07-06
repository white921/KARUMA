import { Client, GuildMember, PartialGuildMember } from "discord.js";

// import { ChallengeMarkService } from "../service/challengeMarkService";
// import { RemindToMadoromiService } from "../service/remindToMadoromiService";
// import { EvaluationService } from "../service/evaluationService";
import { AccountService } from "../service/accountService";
import { addRole, deleteRole } from "../util/role";

import { ROLE_IDS } from "../constant/id";

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
    (await AccountService.hasAccount(newMember.id))
  ) {
    await addRole(newMember, ROLE_IDS.CORE_MEMBER_ROLES.DEMODORI);
    await deleteRole(newMember, ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI);
  }

  // 挑戦の印ロールの付与を監視
  // const hadTyosen = oldMember.roles.cache.has(ROLE_IDS.TYOSEN_NO_SHIRUSHI);
  // const hasTyosen = newMember.roles.cache.has(ROLE_IDS.TYOSEN_NO_SHIRUSHI);
  // if (!hadTyosen && hasTyosen) {
  //   ChallengeMarkService.insertIntoRoleManagementLogs(newMember.id);
  //   ChallengeMarkService.createChallengeEvaluateSheet(client, newMember);
  // }

  // まどろみロールの付与・剥奪を監視
  // const hadMadoromi = oldMember.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.MADOROMI);
  // const hasMadoromi = newMember.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.MADOROMI);
  // if (!hadMadoromi && hasMadoromi) {
  //   RemindToMadoromiService.insertIntoRoleManagementLogs(newMember.id);
  //   RemindToMadoromiService.executeRemindToMadoromi(client);
  // }

  // // まどろみロールが外れた場合、メッセージを送らないようにする
  // if (hadMadoromi && !hasMadoromi) {
  //   RemindToMadoromiService.setIsDeletedToTrue(newMember.id);
  // }
}
