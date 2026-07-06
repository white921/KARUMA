import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { hasRole } from "../util/role";

import { AccountService } from "./accountService";
import { DbService } from "./dbService";

import { CHANGE_NAME_MESSAGES } from "../constant/changeName";
import { ACCOUNT_MESSAGES } from "../constant/account";
import { ROLE_IDS } from "../constant/id";

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
  ) {
    try {
      const targetMember = interaction.guild?.members.cache.get(targetUserId);
      if (!targetMember) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }
      // 表示名更新
      await targetMember.setNickname(newName);

      const connection = await DbService.getConnection();
      try {
        await connection.execute(
          "UPDATE accounts SET user_name = ? WHERE user_id = ?",
          [newName, targetUserId]
        );
      } finally {
        connection.release();
      }
    } catch (error) {
      throw error;
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
      //ショップ統括と運営以外は利用できない
      if (
        !(await hasRole(user, ROLE_IDS.SHOP_LEADER)) &&
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

      // 準メン以上でない
      if (
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN)) &&
        !(await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.HONMEN))
      ) {
        throw new Error(CHANGE_NAME_MESSAGES.REQUIRED_ROLE_NOT_FOUND);
      }

      await AccountService.validateName(newName, member.id);
    } catch (error) {
      throw error;
    }
  }
}
