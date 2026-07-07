import { TextChannel, ThreadChannel } from "discord.js";

import { DbService } from "./dbService";
import { HotelVcService } from "./hotelVcService";

import { THREAD_IDS, TEXT_CHANNEL_IDS, ROLE_IDS } from "../constant/id";
import { COMMAND_NAMES, PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { CASINO_MESSAGES } from "../constant/casino";
import { formatNumber } from "../util/number";

export function resolveActionLogThreadId(commandName: string): string | null {
  switch (commandName) {
    case PANEL_COMMAND_NAMES.SEND:
      return THREAD_IDS.SEND_LOG_THREAD;
    case PANEL_COMMAND_NAMES.SHOP_SEND:
      return THREAD_IDS.SHOP_LOG_THREAD;
    case PANEL_COMMAND_NAMES.ADMIN_MINT:
    case COMMAND_NAMES.ROLE_BASED_SEND:
      return THREAD_IDS.MINT_LOG_THREAD;
    case PANEL_COMMAND_NAMES.ADMIN_BURN:
      return THREAD_IDS.BURN_LOG_THREAD;
    case PANEL_COMMAND_NAMES.CASINO_GF:
      return THREAD_IDS.CASINO_GF_LOG_THREAD;
    case PANEL_COMMAND_NAMES.CASINO_MAJONG:
      return THREAD_IDS.CASINO_MAJONG_LOG_THREAD;
    case PANEL_COMMAND_NAMES.CASINO_OTHER:
      return THREAD_IDS.CASINO_OTHER_LOG_THREAD;
    default:
      return null;
  }
}

export class ActionService {
  private static isDiscordMissingAccessError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 50001
    );
  }

  /**
   * actionsテーブルにデータを追加
   * @param commandName
   * @param amount
   * @param fromUserId
   * @param toUserId
   * @param fromAfterWallet
   * @param toAfterWallet
   * @param comment
   */
  static async createActionLog(
    commandName: string,
    amount: number,
    fromUserId: string,
    toUserId: string,
    fromAfterWallet: number,
    toAfterWallet: number,
    comment: string,
  ) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO actions 
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) 
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          commandName,
          amount,
          fromUserId,
          toUserId,
          fromAfterWallet,
          toAfterWallet,
          comment,
        ],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * actionログメッセージの送信
   * @param interaction
   * @param commandName
   * @param amount
   * @param fromUserId
   * @param toUserId
   * @param comment
   * @returns
   */
  static async createActionLogMessage(
    interaction: any,
    commandName: string,
    amount: number,
    fromUserId: string,
    toUserId: string,
    comment: string,
  ) {
    try {
      let channel, thread, channelId, threadId;
      switch (commandName) {
        case PANEL_COMMAND_NAMES.SEND:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**送金**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}送金されました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          // ママサブからスタンプ屋さんへの送金は別スレッドにもログ送信
          if (fromUserId == "1414010714640613456") {
            const toMember = await interaction.guild?.members.fetch(toUserId);
            if (toMember && toMember.roles.cache.has(ROLE_IDS.SHOP_STAFF)) {
              const threadId = THREAD_IDS.SHOP_SALARY_LOG_THREAD;
              const thread = await interaction.client.channels.fetch(threadId);
              if (thread && thread.isThread() && thread.isTextBased()) {
                await (thread as ThreadChannel).send(
                  `**送金**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}送金されました！${
                    comment ? `\n備考: ${comment}` : ""
                  }`,
                );
              }
            }
          }
          break;
        case PANEL_COMMAND_NAMES.SHOP_SEND:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**ショップ支払い**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}支払いされました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.ADMIN_MINT:
        case COMMAND_NAMES.ROLE_BASED_SEND:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**付与**\n<@${fromUserId}>が<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}付与しました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.ADMIN_BURN:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**減額**\n<@${toUserId}>が<@${fromUserId}>から${formatNumber(amount)}${CURRENCY_NAMES}減額しました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        // case COMMAND_NAMES.CHANGE_NAME:
        //   channelId = TEXT_CHANNEL_IDS.CHANGE_NAME_LOG;
        //   channel = await interaction.client.channels.fetch(channelId);
        //   // comment: oldName_newName_targetUserId
        //   const oldName = comment.split("_")[0];
        //   const newName = comment.split("_")[1];
        //   const targetUserId = comment.split("_")[2];
        //   if (channel && channel.isTextBased()) {
        //     await (channel as TextChannel).send(
        //       `**表示名変更**\n${oldName}から${newName}に変更しました！\n対象者: <@${targetUserId}>`,
        //     );
        //   }
        //   break;
        case PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL:
        case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
        case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
        case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM:
        case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG:
          channelId = TEXT_CHANNEL_IDS.HOTEL_LOG;
          channel = await interaction.client.channels.fetch(channelId);
          const hotelVcTypeName =
            HotelVcService.getHotelVcTypeName(commandName);
          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send(
              `**ホテルVC作成**\n<@${fromUserId}>が${hotelVcTypeName}VCを作成しました！`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.DIARY_PRIVATE:
          channelId = TEXT_CHANNEL_IDS.DIARY_LOG;
          channel = await interaction.client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send(
              `**日記作成**\n<@${fromUserId}>が通常日記を購入・更新しました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.DIARY_PUBLIC:
          channelId = TEXT_CHANNEL_IDS.DIARY_LOG;
          channel = await interaction.client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send(
              `**日記作成**\n<@${fromUserId}>がVIP日記を購入・更新しました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.DIARY_UPDATE:
          channelId = TEXT_CHANNEL_IDS.DIARY_LOG;
          channel = await interaction.client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send(
              `**日記更新**\n<@${fromUserId}>が日記をアップグレードしました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.CASINO_GF:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**${
                CASINO_MESSAGES.SEND_FOR_GF
              }**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}送金されました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.CASINO_MAJONG:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**${
                CASINO_MESSAGES.SEND_FOR_MAJONG
              }**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}送金されました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        case PANEL_COMMAND_NAMES.CASINO_OTHER:
          threadId = resolveActionLogThreadId(commandName);
          thread = await interaction.client.channels.fetch(threadId);
          if (thread && thread.isThread() && thread.isTextBased()) {
            await (thread as ThreadChannel).send(
              `**${
                CASINO_MESSAGES.SEND_FOR_OTHER
              }**\n<@${fromUserId}>から<@${toUserId}>に${formatNumber(amount)}${CURRENCY_NAMES}送金されました！${
                comment ? `\n備考: ${comment}` : ""
              }`,
            );
          }
          break;
        default:
          break;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * アクションログの実行関数
   * @param interaction
   * @param commandName
   * @param amount
   * @param fromUserId
   * @param toUserId
   * @param fromAfterWallet
   * @param toAfterWallet
   * @param comment
   */
  static async executeActionLog(
    interaction: any,
    commandName: string,
    amount: number,
    fromUserId: string,
    toUserId: string,
    fromAfterWallet: number,
    toAfterWallet: number,
    comment: string,
  ) {
    try {
      await this.createActionLog(
        commandName,
        amount,
        fromUserId,
        toUserId,
        fromAfterWallet,
        toAfterWallet,
        comment,
      );
      try {
        await this.createActionLogMessage(
          interaction,
          commandName,
          amount,
          fromUserId,
          toUserId,
          comment,
        );
      } catch (error) {
        if (this.isDiscordMissingAccessError(error)) {
          console.warn(
            `[ActionService] Discord action log message skipped due to missing access. command=${commandName}`,
            error,
          );
          return;
        }
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
}
