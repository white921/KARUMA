import { MessageFlags, ModalSubmitInteraction } from "discord.js";
import { PoolConnection, RowDataPacket } from "mysql2/promise";

import {
  calculateShopTicketDiscount,
  getShopTicket,
  SHOP_TICKET_MAX_APPLICABLE_AMOUNT,
  SHOP_TICKET_NONE,
  ShopTicketType,
} from "../constant/shopTicket";
import { BOT_ID } from "../constant/id";
import { CURRENCY_NAMES } from "../constant/currency";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";
import { ShopTicketService } from "./shopTicketService";

type WalletRow = RowDataPacket & { wallet: number };

export class ShopPaymentService {
  private static validateAmount(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new Error("金額は整数で入力してください。");
    }
    if (amount <= 0) {
      throw new Error("金額は1以上で入力してください。");
    }
  }

  private static createTicketLogComment(
    productName: string,
    ticketType: ShopTicketType | typeof SHOP_TICKET_NONE,
    discountAmount: number,
  ): string {
    if (ticketType === SHOP_TICKET_NONE) {
      return `${productName}\n使用チケット: 消費しない`;
    }
    return `${productName}\n使用チケット: ${getShopTicket(ticketType).label}\n割引額: ${discountAmount.toLocaleString()}${CURRENCY_NAMES}`;
  }

  static async pay(
    interaction: ModalSubmitInteraction,
    amount: number,
    productName: string,
    ticketType: ShopTicketType | typeof SHOP_TICKET_NONE,
  ): Promise<void> {
    this.validateAmount(amount);
    if (!productName.trim()) {
      throw new Error("商品名を入力してください。");
    }
    if (
      ticketType !== SHOP_TICKET_NONE &&
      amount >= SHOP_TICKET_MAX_APPLICABLE_AMOUNT
    ) {
      throw new Error("ショップ割引券は100万krm以上の商品には使用できません。");
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const connection = await DbService.getConnection();
    let paymentAmount = amount;
    let discountAmount = 0;
    let afterWallet = 0;
    let botAfterWallet = 0;
    let logComment = "";
    try {
      await connection.beginTransaction();
      const [userRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [BOT_ID],
      );
      const user = userRows[0];
      const bot = botRows[0];
      if (!user || !bot) {
        throw new Error("ショップ支払い用の口座情報が見つかりません。");
      }

      if (ticketType !== SHOP_TICKET_NONE) {
        await ShopTicketService.consume(connection, interaction.user.id, ticketType);
        ({ discountAmount, paymentAmount } = calculateShopTicketDiscount(
          amount,
          ticketType,
        ));
      }
      if (Number(user.wallet) < paymentAmount) {
        throw new Error("残高が不足しています。");
      }

      afterWallet = Number(user.wallet) - paymentAmount;
      botAfterWallet = Number(bot.wallet) + paymentAmount;
      logComment = this.createTicketLogComment(
        productName.trim(),
        ticketType,
        discountAmount,
      );

      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
        afterWallet,
        interaction.user.id,
      ]);
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
        botAfterWallet,
        BOT_ID,
      ]);
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          PANEL_COMMAND_NAMES.SHOP_SEND,
          paymentAmount,
          interaction.user.id,
          BOT_ID,
          afterWallet,
          botAfterWallet,
          logComment,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await interaction.editReply({
      content:
        `✅ ショップへ ${paymentAmount.toLocaleString()}${CURRENCY_NAMES}支払いました！\n` +
        `商品名: ${productName.trim()}\n` +
        (ticketType === SHOP_TICKET_NONE
          ? "使用チケット: 消費しない"
          : `使用チケット: ${getShopTicket(ticketType).label}\n割引額: ${discountAmount.toLocaleString()}${CURRENCY_NAMES}`),
    });
    await ActionService.createActionLogMessage(
      interaction,
      PANEL_COMMAND_NAMES.SHOP_SEND,
      paymentAmount,
      interaction.user.id,
      BOT_ID,
      logComment,
    );
  }
}
