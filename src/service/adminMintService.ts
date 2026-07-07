import { ModalSubmitInteraction, User, MessageFlags } from "discord.js";

import { Account } from "../type/account";

import { isTechnician } from "../util/role";
import { hasAdminBankPanelPermission } from "../util/adminPermission";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { CURRENCY_NAMES } from "../constant/currency";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { BOT_ID } from "../constant/id";
import { ADMIN_MINT_MESSAGES } from "../constant/adminMint";
import { ADMIN_MESSAGES } from "../constant/admin";
import { formatNumber } from "../util/number";

export class AdminMintService {
  /**
   * 付与
   * @param interaction インタラクション
   * @param toUserId 付与先ユーザーID
   * @param amount 付与額
   * @param comment 備考
   */
  static async mint(
    interaction: ModalSubmitInteraction,
    toUserId: string,
    amount: number,
    comment: string,
  ) {
    try {
      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];

      const toUserAccount = (
        await AccountService.getAccountByUserId(toUserId)
      )[0];

      const user = interaction.user;
      await this.validateMint(toUserAccount, interaction, user, amount);

      const toUserAmount = toUserAccount.wallet + amount;
      const connection = await DbService.getConnection();
      try {
        // 残高更新
        await connection.execute(
          `UPDATE accounts
        SET
          wallet = ?
        WHERE user_id = ?
        ;`,
          [toUserAmount, toUserId],
        );
      } finally {
        connection.release();
      }

      await interaction.reply({
        content: `✅ <@${toUserId}> に ${formatNumber(amount)}${CURRENCY_NAMES}付与しました！`,
        flags: MessageFlags.Ephemeral,
      });
      await interaction.editReply({
        content: `✅ <@${toUserId}> に ${formatNumber(amount)}${CURRENCY_NAMES}付与しました！`,
      });

      // アクション記録
      await ActionService.executeActionLog(
        interaction,
        PANEL_COMMAND_NAMES.ADMIN_MINT,
        amount,
        interaction.user.id,
        toUserId,
        botAccount?.wallet ?? 0,
        toUserAmount,
        comment,
      );
    } catch (error) {
      throw error;
    }
  }
  /**
   * 付与のバリデーション
   * @param toUserAccount 付与先アカウント
   * @param interaction インタラクション
   * @param user 実行ユーザー
   * @param amount 金額
   * @throws エラー
   */
  static async validateMint(
    toUserAccount: Account,
    interaction: ModalSubmitInteraction,
    user: User,
    amount: number,
  ) {
    try {
      if (!Number.isInteger(amount)) {
        throw new Error(ADMIN_MINT_MESSAGES.IS_NOT_INT);
      }
      if (!toUserAccount) {
        throw new Error(ADMIN_MINT_MESSAGES.NOT_FOUND_USER);
      }

      if (await AccountService.isSubAccount(toUserAccount.user_id)) {
        throw new Error(ADMIN_MINT_MESSAGES.DO_NOT_MINT_TO_SUB_ACCOUNT);
      }

      const member = await interaction.guild?.members.fetch(user.id);
      if (member && !(await isTechnician(user))) {
        if (!(await hasAdminBankPanelPermission(member))) {
          throw new Error(ADMIN_MESSAGES.NO_PERMISSION);
        }
      }
    } catch (error: any) {
      throw error;
    }
  }
}
