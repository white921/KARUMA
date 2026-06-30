import { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { hasRole, isTechnician } from "../util/role";

import { AccountService } from "./accountService";

import { ACCOUNT_MESSAGES } from "../constant/account";
import { ROLE_IDS } from "../constant/id";
import { OPEN_ACCOUNT_MESSAGES } from "../constant/openAccount";

export class OpenAccountService {
  /**
   * 口座開設バリデーション
   * @param interaction インタラクション
   */
  static async openAccountValidate(interaction: ChatInputCommandInteraction) {
    try {
      // 技術者でない場合はエラー
      // if (!(await isTechnician(interaction.user))) {
      //   throw new Error(OPEN_ACCOUNT_MESSAGES.PERMISSION_DENIED);
      // }
      // 口座が存在する場合はエラー
      if (await AccountService.hasAccount(interaction.user.id)) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_EXISTS);
      }

      await AccountService.validateName(interaction.user.displayName);
    } catch (error) { 
      throw error;
    }
  }
}
