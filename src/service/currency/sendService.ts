import {
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  ButtonInteraction,
  Guild,
  EmbedBuilder,
} from "discord.js";

import { Account } from "../../type/account/account";

import { AccountService } from "../account/accountService";
import { ActionService } from "./actionService";
import { DbService } from "../system/dbService";

import {
  MONTHLY_SEND_LIMIT,
  MONTHLY_SEND_LIMIT_EXEMPT_ROLE_IDS,
  SEND_MESSAGES,
  SEND_DM_TEST_RECIPIENT_ID,
} from "../../constant/currency/send";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { BOT_ID } from "../../constant/shared/id";
import { ACTION_TYPES } from "../../constant/currency/action";
import { hasOperatorRole } from "../../util/shared/operatorPermission";
import { COLOR } from "../../constant/shared/color";

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
    interaction: ModalSubmitInteraction | ChatInputCommandInteraction | ButtonInteraction,
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
    await this.validateMonthlySendLimit(fromUserId, toUserId, amount, interaction.guild);

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
        components: [],
        embeds: [],
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

    await this.sendReceiptDm(interaction, fromUserId, toUserId, amount, comment, toUserAmount, commandName);
  }

  /** 確定済みの通常送金だけ通知する。通知失敗によって送金の再試行を促さない。 */
  private static async sendReceiptDm(
    interaction: ModalSubmitInteraction | ChatInputCommandInteraction | ButtonInteraction,
    fromUserId: string,
    toUserId: string,
    amount: number,
    comment: string,
    afterWallet: number,
    commandName: string,
  ): Promise<void> {
    if (toUserId !== SEND_DM_TEST_RECIPIENT_ID || commandName !== PANEL_COMMAND_NAMES.SEND) return;

    try {
      const member = await interaction.guild?.members.fetch(fromUserId).catch(() => null);
      const sender = member?.user ?? await interaction.client.users.fetch(fromUserId);
      const avatarUrl = member?.displayAvatarURL({ extension: "png" })
        ?? sender.displayAvatarURL({ extension: "png" });
      const embed = new EmbedBuilder()
        .setColor(COLOR.GREEN)
        .setAuthor({ name: member?.displayName ?? sender.displayName, iconURL: avatarUrl })
        .setThumbnail(avatarUrl)
        .setTitle("💸 送金を受け取りました")
        .setDescription(`<@${fromUserId}> さんから **${amount.toLocaleString("ja-JP")} ${CURRENCY_NAMES}** が届きました。`)
        .setFooter({ text: `受取後の残高：${afterWallet.toLocaleString("ja-JP")} ${CURRENCY_NAMES}` })
        .setTimestamp();
      if (comment.trim()) {
        embed.addFields({ name: "備考", value: comment.length > 1024 ? `${comment.slice(0, 1023)}…` : comment });
      }
      const recipient = await interaction.client.users.fetch(toUserId);
      await recipient.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error("[SendService] Transfer completed but receipt DM failed", { fromUserId, toUserId, error });
    }
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
    guild?: Guild | null,
  ) {
    if (await AccountService.isLinkedMainAndSubAccount(fromUserId, toUserId)) {
      return;
    }
    
    if (fromUserId === BOT_ID || toUserId === BOT_ID) {
      return;
    }

    const monthlySentAmount = await this.getMonthlySentAmount(fromUserId, toUserId);
    if (monthlySentAmount + amount > MONTHLY_SEND_LIMIT) {
      if (guild) {
        // 送金元本人の最新ロールを確認し、ロール解除後は上限を再適用する。
        const sender = await guild.members.fetch({ user: fromUserId, force: true });
        if (hasOperatorRole(sender, MONTHLY_SEND_LIMIT_EXEMPT_ROLE_IDS)) {
          return;
        }
      }
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
        [ACTION_TYPES.TRANSFER, fromUserId, toUserId],
      );
      return Number(rows[0]?.total ?? 0);
    } finally {
      connection.release();
    }
  }
}
