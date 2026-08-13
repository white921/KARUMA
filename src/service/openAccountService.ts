import { GuildMember } from "discord.js";

import { AccountService } from "./accountService";

import { ACCOUNT_MESSAGES } from "../constant/account";

export class OpenAccountService {
  /**
   * 口座開設バリデーション
   * @param member 口座を開設するサーバーメンバー
   */
  static async openAccountValidate(member: GuildMember) {
    try {
      // 口座が存在する場合はエラー
      if (await AccountService.hasAccount(member.id)) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_EXISTS);
      }

      await AccountService.validateName(member.displayName);
    } catch (error) {
      throw error;
    }
  }
}
