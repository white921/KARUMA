import {
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";

import { Account } from "../type/account";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { MONTHLY_SEND_LIMIT, SEND_MESSAGES } from "../constant/send";
import { CURRENCY_NAMES } from "../constant/currency";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ACCOUNT_MESSAGES } from "../constant/account";
import { BOT_ID } from "../constant/id";

export class SendService {
  /**
   * 送金実行
   * @param interaction インタラクション
   * @param fromUserId 送金者ID
   * @param toUserId 受取者ID
   * @param amount 送金額
   * @param comment 備考
   * @param commandName コマンド名
   * @param replyMethod 返信方法
   */
  static async executeSend(
    interaction: ModalSubmitInteraction | ChatInputCommandInteraction,
    fromUserId: string,
    toUserId: string,
    amount: number,
    comment: string,
    commandName: string,
    replyMethod: "reply" | "editReply",
  ) {
    const fromUserAccount = (await AccountService.getAccountByUserId(fromUserId))[0];
    const toUserAccount = (await AccountService.getAccountByUserId(toUserId))[0];

    await this.validateSend(fromUserAccount, toUserAccount, amount);
    await this.validateMonthlySendLimit(fromUserId, toUserId, amount);

    const fromUserAmount = fromUserAccount.wallet - amount;
    const toUserAmount = toUserAccount.wallet + amount;

    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE accounts
        SET 
          wallet = ?
        WHERE user_id = ?
        ;`,
        [fromUserAmount, fromUserId],
      );
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

    if (replyMethod === "reply") {
      await interaction.reply({
        content: SEND_MESSAGES.SUCCESS_TO_USER(
          toUserId,
          amount,
          CURRENCY_NAMES,
          comment,
        ),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: SEND_MESSAGES.SUCCESS_TO_USER(
          toUserId,
          amount,
          CURRENCY_NAMES,
          comment,
        ),
      });
    }

    await ActionService.executeActionLog(
      interaction,
      commandName,
      amount,
      fromUserId,
      toUserId,
      fromUserAmount,
      toUserAmount,
      comment,
    );
  }

  /**
   * 送金
   * @param interaction インタラクション
   * @param fromUserId 送金者ID
   * @param toUserId 受取者ID
   * @param amount 送金額
   * @param comment 備考
   * @param commandName コマンド名
   */
  static async send(
    interaction: ModalSubmitInteraction,
    fromUserId: string,
    toUserId: string,
    amount: number,
    comment: string,
    commandName: string,
  ) {
    try {
      await this.executeSend(
        interaction,
        fromUserId,
        toUserId,
        amount,
        comment,
        commandName,
        "reply",
      );
    } catch (error: any) {
      throw error;
    }
  }

  static async sendByCommand(
    interaction: ChatInputCommandInteraction,
    fromUserId: string,
    toUserId: string,
    amount: number,
    comment: string,
  ) {
    try {
      await this.executeSend(
        interaction,
        fromUserId,
        toUserId,
        amount,
        comment,
        PANEL_COMMAND_NAMES.SEND,
        "editReply",
      );
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 送金バリデーション
   * @param fromUser 送金元アカウント
   * @param toUser 送金先アカウント
   * @param amount 送金額
   */
  static async validateSend(
    fromUserAccount: Account,
    toUserAccount: Account,
    amount: number,
  ) {
    try {
      if (!fromUserAccount) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }
      // amountがnumberではない場合
      if (!Number.isInteger(amount)) {
        throw new Error(SEND_MESSAGES.IS_NOT_INT);
      }
      // 送金先が存在しない
      if (!toUserAccount) {
        throw new Error(SEND_MESSAGES.NOT_FOUND_USER);
      }
      // 送金額が0以下
      if (amount <= 0) {
        throw new Error(SEND_MESSAGES.INVALID_AMOUNT);
      }
      // 送金元と送金先が同じ
      if (fromUserAccount?.user_id === toUserAccount?.user_id) {
        throw new Error(SEND_MESSAGES.SAME_USER);
      }
      // 送金元の残高が不足
      if (fromUserAccount?.wallet < amount) {
        throw new Error(SEND_MESSAGES.NOT_ENOUGH_BALANCE);
      }
    } catch (error: any) {
      throw error;
    }
  }

  static async validateMonthlySendLimit(
    fromUserId: string,
    toUserId: string,
    amount: number,
  ) {
    if (await AccountService.isLinkedMainAndSubAccount(fromUserId, toUserId)) {
      return;
    }
    
    if (fromUserId === BOT_ID || toUserId === BOT_ID) {
      return;
    }

    const monthlySentAmount = await this.getMonthlySentAmount(fromUserId, toUserId);
    if (monthlySentAmount + amount > MONTHLY_SEND_LIMIT) {
      throw new Error(
        SEND_MESSAGES.MONTHLY_LIMIT_EXCEEDED(
          monthlySentAmount,
          MONTHLY_SEND_LIMIT,
        ),
      );
    }
  }

  static async getMonthlySentAmount(fromUserId: string, toUserId: string) {
    const connection = await DbService.getConnection();
    try {
      const [rows]: any = await connection.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM actions
         WHERE command_name = ?
           AND from_user_id = ?
           AND to_user_id = ?
           AND created_at >= DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+09:00'), '%Y-%m-01 00:00:00')
           AND created_at < DATE_ADD(DATE_FORMAT(CONVERT_TZ(NOW(), '+00:00', '+09:00'), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH);`,
        [PANEL_COMMAND_NAMES.SEND, fromUserId, toUserId],
      );
      return Number(rows[0]?.total ?? 0);
    } finally {
      connection.release();
    }
  }
}
