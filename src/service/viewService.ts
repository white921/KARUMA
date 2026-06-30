import { ButtonInteraction } from "discord.js";

import { AccountService } from "./accountService";

import { ACCOUNT_MESSAGES } from "../constant/account";
import { VIEW_MESSAGES } from "../constant/view";

export class ViewService {
  static async createViewMessage(userId: string) {
    await this.validateView(userId);
    const account = await AccountService.getAccountByUserId(userId);
    return VIEW_MESSAGES.BALANCE(account[0].wallet);
  }

  /**
   * 残高確認
   * @param interaction インタラクション
   * @param userId ユーザーID
   */
  static async view(interaction: ButtonInteraction) {
    try {
      await interaction.editReply({
        content: await this.createViewMessage(interaction.user.id),
      });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 残高確認バリデーション
   * @param userId ユーザーID
   */
  static async validateView(userId: string) {
    try {
      if (!(await AccountService.hasAccount(userId))) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }
    } catch (error: any) {
      throw error;
    }
  }
}
