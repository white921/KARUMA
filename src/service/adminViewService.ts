import { User, UserSelectMenuInteraction } from "discord.js";

import { hasRole, isTechnician } from "../util/role";

import { AccountService } from "./accountService";

import { ADMIN_MESSAGES } from "../constant/admin";
import { ROLE_IDS } from "../constant/id";
import { VIEW_MESSAGES } from "../constant/view";

export class AdminViewService {
  /**
   * 指定ユーザーの残高確認
   * @param interaction
   * @param selectedUserId
   */
  static async adminView(
    interaction: UserSelectMenuInteraction,
    selectedUserId: string
  ) {
    try {
      const user = interaction.user;

      // 実行者が技術者でなければバリデーションを行う
      if (!(await isTechnician(user))) {
        await this.validateAdminView(interaction, user);
      }

      const account = await AccountService.getAccountByUserId(selectedUserId);
      await interaction.reply({
        content: VIEW_MESSAGES.BALANCE_OF_USER(selectedUserId, account[0].wallet),
        ephemeral: true,
      });
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 他人の残高確認バリデーション
   * @param interaction
   * @param user
   */
  static async validateAdminView(
    interaction: UserSelectMenuInteraction,
    user: User
  ) {
    try {
      const member = await interaction.guild?.members.fetch(user.id);
      if (member) {
        if (
          !(await hasRole(member, ROLE_IDS.SIKKOKAN)) &&
          !(await hasRole(member, ROLE_IDS.SOUZOUSYU)) &&
          !(await hasRole(member, ROLE_IDS.GINKOU_LEADER))
        ) {
          throw new Error(ADMIN_MESSAGES.NO_PERMISSION);
        }
      }
    } catch (error: any) {
      throw error;
    }
  }
}
