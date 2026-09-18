import { GuildMember } from "discord.js";
import { MAX_DISPLAY_NAME_LENGTH } from "../../constant/account/account";
import {
  LINK_ACCOUNT_MESSAGES,
  LINK_ACCOUNT_OPERATOR_ROLE_IDS,
} from "../../constant/account/linkAccount";
import type { RoleBackedMember } from "../../type/account/linkAccount";
import { DbService } from "../system/dbService";
import { AccountService } from "./accountService";

export function canManageLinkAccount(member: unknown): boolean {
  const roleBackedMember = member as RoleBackedMember | null | undefined;
  return LINK_ACCOUNT_OPERATOR_ROLE_IDS.some((roleId) =>
    Boolean(roleBackedMember?.roles?.cache?.has(roleId)),
  );
}

export function assertCanManageLinkAccount(member: unknown): void {
  if (!canManageLinkAccount(member)) {
    throw new Error(LINK_ACCOUNT_MESSAGES.NO_PERMISSION);
  }
}

export class LinkAccountService {
  /**
   * 本アカウントで使徒ロールをもっていないユーザーと口座がないユーザーはサブ垢同期を行えない
   * @param mainAccount 本アカウントメンバー
   */
  static async validateMainAccount(mainAccount: GuildMember) {
    if (!(await AccountService.hasAccount(mainAccount.id))) {
      throw new Error(LINK_ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * 本アカウントの表示名の末尾に(sub)を追加してサブアカウントの表示名にする
   * @param mainMember 本アカウントメンバー
   * @param subMember サブアカウントメンバー
   */
  static async changeSubAccountDisplayName(
    mainMember: GuildMember,
    subMember: GuildMember
  ) {
    try {
      const mainName = mainMember.displayName;
      const subName = mainName + " (sub)";
      if (subName.length > MAX_DISPLAY_NAME_LENGTH) {
        throw new Error(LINK_ACCOUNT_MESSAGES.DISPLAY_NAME_TOO_LONG);
      }
      await subMember.setNickname(subName);

      const connection = await DbService.getConnection();
      try {
        await connection.execute(
          "UPDATE accounts SET user_name = ? WHERE user_id = ?",
          [subName, subMember.id]
        );
      } finally {
        connection.release();
      }

      return subName;
    } catch (error) {
      throw new Error(LINK_ACCOUNT_MESSAGES.CHANGE_DISPLAY_NAME_FAILED);
    }
  }

  /**
   * sub_accountsテーブルに登録
   * @param mainUserId 本アカウントユーザーID
   * @param subUserId サブアカウントユーザーID
   */
  static async registerSubAccount(
    mainUserId: string,
    subUserId: string,
    subDisplayName: string
  ) {
    const connection = await DbService.getConnection();
    try {
      // サブアカウント口座が存在しない場合は口座を開設
      if (!(await AccountService.hasAccount(subUserId))) {
        await AccountService.createAccount(subUserId, subDisplayName, 0);
      }

      await connection.execute(
        `INSERT INTO sub_accounts (main_user_id, sub_user_id) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE 
        updated_at = CURRENT_TIMESTAMP;`,
        [mainUserId, subUserId]
      );
    } catch (error) {
      throw new Error(LINK_ACCOUNT_MESSAGES.REGISTER_SUB_ACCOUNT_FAILED);
    } finally {
      connection.release();
    }
  }
}
