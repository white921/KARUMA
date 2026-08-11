import { MessageFlags, ModalSubmitInteraction } from "discord.js";
import { RowDataPacket } from "mysql2/promise";

import {
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
type ShopPaymentCommandName =
  | typeof PANEL_COMMAND_NAMES.SHOP_SEND
  | typeof PANEL_COMMAND_NAMES.DARK_SHOP_SEND;

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
  ): string {
    if (ticketType === SHOP_TICKET_NONE) {
      return `${productName}\n使用チケット: 消費しない`;
    }
    return `${productName}\n使用チケット: ${getShopTicket(ticketType).label}`;
  }

  static async pay(
    interaction: ModalSubmitInteraction,
    amount: number,
    productName: string,
    ticketType: ShopTicketType | typeof SHOP_TICKET_NONE,
    commandName: ShopPaymentCommandName = PANEL_COMMAND_NAMES.SHOP_SEND,
  ): Promise<void> {
    this.validateAmount(amount);
    const appliedTicketType = commandName === PANEL_COMMAND_NAMES.DARK_SHOP_SEND
      ? SHOP_TICKET_NONE
      : ticketType;
    if (!productName.trim()) {
      throw new Error("商品名を入力してください。");
    }
    if (
      commandName === PANEL_COMMAND_NAMES.SHOP_SEND &&
      appliedTicketType !== SHOP_TICKET_NONE &&
      amount >= SHOP_TICKET_MAX_APPLICABLE_AMOUNT
    ) {
      throw new Error("市場割引券は100万LIA以上の商品には使用できません。");
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const connection = await DbService.getConnection();
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
        throw new Error(
          `${commandName === PANEL_COMMAND_NAMES.DARK_SHOP_SEND ? "闇市場" : "市場"}商品購入用の口座情報が見つかりません。`,
        );
      }

      if (appliedTicketType !== SHOP_TICKET_NONE) {
        await ShopTicketService.consume(connection, interaction.user.id, appliedTicketType);
      }
      if (Number(user.wallet) < amount) {
        throw new Error("残高が不足しています。");
      }

      afterWallet = Number(user.wallet) - amount;
      botAfterWallet = Number(bot.wallet) + amount;
      logComment = this.createTicketLogComment(
        productName.trim(),
        appliedTicketType,
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
          commandName,
          amount,
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
        `✅ ${commandName === PANEL_COMMAND_NAMES.DARK_SHOP_SEND ? "闇市場" : "市場"}で ${amount.toLocaleString()}${CURRENCY_NAMES}の商品を購入しました！\n` +
        `商品名: ${productName.trim()}\n` +
        (commandName === PANEL_COMMAND_NAMES.DARK_SHOP_SEND ||
        appliedTicketType === SHOP_TICKET_NONE
          ? "使用チケット: 消費しない"
          : `使用チケット: ${getShopTicket(appliedTicketType).label}`),
    });
    await ActionService.createActionLogMessage(
      interaction,
      commandName,
      amount,
      interaction.user.id,
      BOT_ID,
      logComment,
    );
  }
}
