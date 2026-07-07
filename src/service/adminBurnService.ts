import { ModalSubmitInteraction, User, MessageFlags } from "discord.js";

import { Account } from "../type/account";

import { isTechnician } from "../util/role";
import { hasAdminBankPanelPermission } from "../util/adminPermission";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { CURRENCY_NAMES } from "../constant/currency";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ADMIN_BURN_MESSAGES } from "../constant/adminBurn";
import { ADMIN_MESSAGES } from "../constant/admin";
import { BOT_ID } from "../constant/id";
import { formatNumber } from "../util/number";

export class AdminBurnService {
  /**
   * 減額
   * @param interaction  インタラクション
   * @param burnedUserId 減額先アカウント
   * @param fromUserId 減額元アカウント
   * @param amount 減額額
   * @param comment 備考
   */
  static async burn(
    interaction: ModalSubmitInteraction,
    burnedUserId: string,
    amount: number,
    comment: string,
  ) {
    try {
      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];
      const burnedUserAccount = (
        await AccountService.getAccountByUserId(burnedUserId)
      )[0];
      const user = interaction.user;
      if (!(await isTechnician(user))) {
        await this.validateBurn(burnedUserAccount, interaction, user, amount);
      }

      const burnedUserWallet = burnedUserAccount.wallet - amount;
      const connection = await DbService.getConnection();
      try {
        // 残高更新
        await connection.execute(
          `UPDATE accounts
        SET
          wallet = ?
        WHERE user_id = ?
        ;`,
          [burnedUserWallet, burnedUserId],
        );
      } finally {
        connection.release();
      }

      await interaction.reply({
        content: `✅ <@${burnedUserId}> から ${formatNumber(amount)}${CURRENCY_NAMES}減額しました！`,
        flags: MessageFlags.Ephemeral,
      });
      await interaction.editReply({
        content: `✅ <@${burnedUserId}> から ${formatNumber(amount)}${CURRENCY_NAMES}減額しました！`,
      });

      // アクション記録
      await ActionService.executeActionLog(
        interaction,
        PANEL_COMMAND_NAMES.ADMIN_BURN,
        amount,
        burnedUserId,
        interaction.user.id,
        burnedUserWallet,
        botAccount.wallet,
        comment,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * 減額のバリデーション
   * @param burnedUserAccount 減額者アカウント
   * @param interaction インタラクション
   * @param user 実行ユーザー
   * @param amount 金額
   * @throws エラー
   */
  static async validateBurn(
    burnedUserAccount: Account,
    interaction: ModalSubmitInteraction,
    user: User,
    amount: number,
  ) {
    try {
      if (!Number.isInteger(amount)) {
        throw new Error(ADMIN_BURN_MESSAGES.IS_NOT_INT);
      }
      // 管理者銀行パネルの操作権限がない
      const member = await interaction.guild?.members.fetch(user.id);
      if (member) {
        if (!(await hasAdminBankPanelPermission(member))) {
          throw new Error(ADMIN_MESSAGES.NO_PERMISSION);
        }
        //減額先が存在しない
        if (!burnedUserAccount) {
          throw new Error(ADMIN_BURN_MESSAGES.NOT_FOUND_USER);
        }
        //減額先の残高が足りない
        if (burnedUserAccount.wallet < amount) {
          throw new Error(ADMIN_BURN_MESSAGES.NOT_ENOUGH_BALANCE);
        }
      }
    } catch (error: any) {
      throw error;
    }
  }
}
