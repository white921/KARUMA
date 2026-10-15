import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import type { RowDataPacket } from "mysql2";

import { hasRole } from "../../util/member/role";

import { AccountService } from "./accountService";
import { ActionService } from "../currency/actionService";
import { DbService } from "../system/dbService";
import { EvaluationSheetArchiveService } from "../evaluation/evaluationSheetArchiveService";

import { CHANGE_NAME_MESSAGES } from "../../constant/account/changeName";
import { hasSystemAdminRole } from "../../util/shared/operatorPermission";
import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { ROLE_IDS } from "../../constant/shared/id";

interface AccountNameRow extends RowDataPacket {
  user_name: string;
}

export class ChangeNameService {
  /**
   * 表示名変更処理
   * @param interaction インタラクション
   * @param targetUserId 対象ユーザーID
   * @param newName 新しい表示名
   */
  static async changeName(
    interaction: ChatInputCommandInteraction,
    targetUserId: string,
    newName: string
  ): Promise<{ evaluationSheetRenamedCount: number }> {
    const targetMember = interaction.guild?.members.cache.get(targetUserId);
    if (!targetMember) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }
    const oldName = targetMember.displayName;
    const oldNickname = targetMember.nickname;
    const oldAccountName = await this.getAccountName(targetUserId);
    let nicknameChanged = false;
    let accountNameChanged = false;
    let evaluationSheetRenamedCount = 0;

    try {
      await targetMember.setNickname(newName);
      nicknameChanged = true;

      await this.updateAccountName(targetUserId, newName);
      accountNameChanged = true;

      evaluationSheetRenamedCount = await hasRole(
        targetMember,
        ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
      )
        ? await EvaluationSheetArchiveService.renameActiveSheetTitles(
            targetMember.client,
            targetUserId,
            newName,
          )
        : 0;
    } catch (error: any) {
      const rollbackErrors: string[] = [];
      if (accountNameChanged) {
        try {
          await this.updateAccountName(targetUserId, oldAccountName);
        } catch (rollbackError: any) {
          rollbackErrors.push(`口座名: ${rollbackError?.message ?? String(rollbackError)}`);
        }
      }
      if (nicknameChanged) {
        try {
          await targetMember.setNickname(oldNickname);
        } catch (rollbackError: any) {
          rollbackErrors.push(`Discord表示名: ${rollbackError?.message ?? String(rollbackError)}`);
        }
      }
      const rollbackMessage = rollbackErrors.length
        ? ` / 復元失敗: ${rollbackErrors.join(" / ")}`
        : "";
      throw new Error(`${error?.message ?? String(error)}${rollbackMessage}`);
    }

    await ActionService.createActionLogMessage(
      interaction,
      COMMAND_NAMES.CHANGE_NAME,
      0,
      interaction.user.id,
      targetUserId,
      JSON.stringify({ oldName, newName }),
    );
    return { evaluationSheetRenamedCount };
  }

  private static async getAccountName(userId: string): Promise<string> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<AccountNameRow[]>(
        "SELECT user_name FROM accounts WHERE user_id = ?",
        [userId],
      );
      if (rows.length !== 1) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }
      return rows[0].user_name;
    } finally {
      connection.release();
    }
  }

  private static async updateAccountName(
    userId: string,
    userName: string,
  ): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        "UPDATE accounts SET user_name = ? WHERE user_id = ?",
        [userName, userId],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * 表示名変更バリデーション
   * @param memberAccount メンバーアカウント
   * @param member メンバー
   * @param newName 新しい表示名
   * @param user コマンド実行者
   */
  static async validateChangeName(
    member: GuildMember,
    newName: string,
    user: GuildMember
  ) {
    try {
      //ショップ統括・案内官系・運営以外は利用できない
      if (
        !(await hasRole(user, ROLE_IDS.SHOP_LEADER)) &&
        !(await hasRole(user, ROLE_IDS.MENSTU_BUIGINNER)) &&
        !(await hasRole(user, ROLE_IDS.MENSTUKAN)) &&
        !(await hasRole(user, ROLE_IDS.MENSETU_LEADER)) &&
        !(await hasRole(user, ROLE_IDS.KANRISYA)) &&
        !(await hasRole(user, ROLE_IDS.SABANUSI)) &&
        !(await hasRole(user, ROLE_IDS.GIJUTU_LEADER))
      ) {
        throw new Error(CHANGE_NAME_MESSAGES.NO_PERMISSION);
      }

      // 口座が存在しない
      if (!(await AccountService.hasAccount(member.user.id))) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      // サブアカウントの表示名は変更できない
      if (await AccountService.isSubAccount(member.user.id)) {
        throw new Error(CHANGE_NAME_MESSAGES.IS_SUB_ACCOUNT);
      }

      // 表示名が変更後と同じ
      if (member.displayName === newName) {
        throw new Error(CHANGE_NAME_MESSAGES.SAME_NAME);
      }

      // 対象者が旅人・賢者・騎士・貴族のいずれでもない
      if (
        !hasSystemAdminRole(user) &&
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN)) &&
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN)) &&
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN)) &&
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.HONMEN))
      ) {
        throw new Error(CHANGE_NAME_MESSAGES.REQUIRED_ROLE_NOT_FOUND);
      }

      await AccountService.validateName(newName, member.guild, member.id);
    } catch (error) {
      throw error;
    }
  }
}
