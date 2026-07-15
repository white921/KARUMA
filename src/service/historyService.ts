import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { RowDataPacket } from "mysql2";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { Action } from "../type/action";
import { EmbedField } from "../type/embed";

import { DbService } from "./dbService";
import { AccountService } from "./accountService";

import { COLOR } from "../constant/color";
import { ACCOUNT_MESSAGES } from "../constant/account";

import { HISTORY_TITLE_MAPPER } from "../constant/history";
import { PANEL_COMMAND_NAMES, COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { BOT_ID } from "../constant/id";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";
import { ROULETTE_ACTION_NAMES } from "../constant/roulette";

dayjs.extend(utc);
dayjs.extend(timezone);

// Discordのフィールド上限（1,024文字）とEmbed全体上限（6,000文字）より余裕を持たせる。
const HISTORY_FIELD_VALUE_MAX_LENGTH = 900;
const HISTORY_PAGE_CONTENT_MAX_LENGTH = 5_000;

export class HistoryService {
  /**
   * ユーザーの取引履歴を取得
   * @param userId ユーザーID
   * @returns 取引履歴の配列
   */
  static async getActionsByUserId(userId: string): Promise<Action[]> {
    const connection = await DbService.getConnection();
    try {
      const [actions] = await connection.execute<Action[] & RowDataPacket[]>(
        `SELECT * FROM actions 
         WHERE (from_user_id = ? OR to_user_id = ?);`,
        [userId, userId],
      );
      return actions;
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 取引履歴をフィルタリング
   * @param actions 取引履歴の配列
   * @param userId ユーザーID
   * @returns フィルタリングされた取引履歴の配列
   */
  static filterActions(actions: Action[], userId: string): Action[] {
    // 管理者コマンドと名前変更の実行者側の履歴は除外
    const filteredActions = actions.filter((action) => {
      if (
        action.command_name === PANEL_COMMAND_NAMES.ADMIN_BURN &&
        action.to_user_id === userId
      ) {
        return false;
      }
      if (
        action.command_name === PANEL_COMMAND_NAMES.ADMIN_MINT &&
        action.from_user_id === userId
      ) {
        return false;
      }
      if (
        action.command_name === COMMAND_NAMES.ROLE_BASED_SEND &&
        action.from_user_id === userId
      ) {
        return false;
      }
      // if (
      //   action.command_name === COMMAND_NAMES.CHANGE_NAME &&
      //   action.from_user_id !== userId &&
      //   action.to_user_id !== action.from_user_id
      // ) {
      //   return false;
      // }
      return true;
    });
    // 新しい順（降順）でソート
    return filteredActions.sort((a, b) => b.id - a.id);
  }

  /**
   * 取引履歴を取引履歴のオブジェクトに変換
   * @param action 取引履歴
   * @param userId ユーザーID
   * @returns 取引履歴のオブジェクト
   */
  static convertActiontoHistoryObject(action: Action, userId: string) {
    const isFromUser = action.from_user_id === userId;
    const historyObject = {
      [PANEL_COMMAND_NAMES.SEND]: isFromUser
        ? `<@${
            action.to_user_id
          }> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`
        : `<@${
            action.from_user_id
          }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.SHOP_SEND]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.OMIKUJI_DRAW]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.ROLE_BASED_SEND]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.ADMIN_MINT]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.ADMIN_BURN]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.PAY_SALARY]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.CHANGE_NAME]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_SECRET]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_PRIVATE]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_PUBLIC]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_UPDATE]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.CASINO_GF]: isFromUser
        ? `<@${
            action.to_user_id
          }> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`
        : `<@${
            action.from_user_id
          }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.CASINO_MAJONG]: isFromUser
        ? `<@${
            action.to_user_id
          }> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`
        : `<@${
            action.from_user_id
          }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.CASINO_OTHER]: isFromUser
        ? `<@${
            action.to_user_id
          }> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`
        : `<@${
            action.from_user_id
          }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.GAME_SHORT]: `<@${
        action.from_user_id
      }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.GAME_LONG]: `<@${
        action.from_user_id
      }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.GAME_SHORT_EXTEND]: `<@${
        action.from_user_id
      }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.GAME_PASS]: `<@${
        action.from_user_id
      }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.MINECRAFT_PASS]: `<@${
        action.from_user_id
      }> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [ROULETTE_ACTION_NAMES.BET]: `<@${BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [ROULETTE_ACTION_NAMES.PAYOUT]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [ROULETTE_ACTION_NAMES.BONUS]: `<@${BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
    };

    return historyObject;
  }

  /** 1件の取引履歴を表示用文字列に変換する。 */
  static createHistoryString(action: Action, userId: string): string | null {
    const date = dayjs(action.created_at)
      .tz("Asia/Tokyo")
      .format("MM/DD HH:mm");
    const titleText = HISTORY_TITLE_MAPPER[action.command_name] || "不明な取引";
    const historyObject = this.convertActiontoHistoryObject(action, userId);
    let value = historyObject[action.command_name];
    if (!value) return null;

    if (action.comment) {
      if (action.command_name === COMMAND_NAMES.CHANGE_NAME) {
        const [oldName, newName] = action.comment.split("_");
        value += `\n${oldName}から${newName}に変更`;
      } else {
        value += `\n備考: ${action.comment}`;
      }
    }

    return `**${date} ${titleText}**\n${value}`;
  }

  /**
   * 履歴文字列をEmbed全体の安全な文字数内に収まるページへ分割する。
   * 固定件数ではなく、履歴本文の長さに応じて1ページの件数を調整する。
   */
  static createHistoryPages(historyStrings: string[]): string[][] {
    const pages: string[][] = [];
    let currentPage: string[] = [];
    let currentLength = 0;

    for (const historyString of historyStrings) {
      const separatorLength = currentPage.length > 0 ? 2 : 0;
      if (
        currentPage.length > 0 &&
        currentLength + separatorLength + historyString.length > HISTORY_PAGE_CONTENT_MAX_LENGTH
      ) {
        pages.push(currentPage);
        currentPage = [];
        currentLength = 0;
      }
      currentPage.push(historyString);
      currentLength += (currentPage.length > 1 ? 2 : 0) + historyString.length;
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }

  /** 長い本文もフィールド上限を超えないよう、改行を優先して分割する。 */
  static splitHistoryString(value: string): string[] {
    const chunks: string[] = [];
    let remaining = value;
    while (remaining.length > HISTORY_FIELD_VALUE_MAX_LENGTH) {
      const newlineIndex = remaining.lastIndexOf("\n", HISTORY_FIELD_VALUE_MAX_LENGTH);
      const splitIndex = newlineIndex > 0 ? newlineIndex + 1 : HISTORY_FIELD_VALUE_MAX_LENGTH;
      chunks.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex);
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  /** 履歴を最大900文字ずつの複数フィールドへ分割する。 */
  static createHistoryEmbedFields(historyStrings: string[]): EmbedField[] {
    const fields: EmbedField[] = [];
    let currentValue = "";

    const pushCurrentField = () => {
      if (!currentValue) return;
      fields.push({ name: "\u200B", value: currentValue });
      currentValue = "";
    };

    for (const historyString of historyStrings) {
      for (const chunk of this.splitHistoryString(historyString)) {
        const separator = currentValue ? "\n\n" : "";
        if (currentValue.length + separator.length + chunk.length > HISTORY_FIELD_VALUE_MAX_LENGTH) {
          pushCurrentField();
        }
        currentValue += `${currentValue ? "\n\n" : ""}${chunk}`;
      }
    }
    pushCurrentField();
    return fields;
  }

  /**
   * 取引履歴をEmbed形式で表示
   * @param interaction インタラクション
   * @param page ページ番号（デフォルト: 1）
   */
  static async viewHistory(
    interaction: ButtonInteraction,
    page: number = 1,
  ): Promise<void> {
    try {
      const userId = interaction.user.id;

      // 口座が存在するか確認
      if (!(await AccountService.hasAccount(userId))) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      // 総件数と取引履歴を取得
      const actions = await this.getActionsByUserId(userId);
      const filteredActions = this.filterActions(actions, userId);
      const historyStrings = filteredActions
        .map((action) => this.createHistoryString(action, userId))
        .filter((value): value is string => value !== null);
      const totalCount = historyStrings.length;

      if (totalCount === 0) {
        await interaction.editReply({
          content: "取引履歴がありません。",
        });
        return;
      }

      const historyPages = this.createHistoryPages(historyStrings);
      const currentPage = Math.min(Math.max(page, 1), historyPages.length);
      const pagedHistoryStrings = historyPages[currentPage - 1];
      const displayedBeforeCount = historyPages
        .slice(0, currentPage - 1)
        .reduce((count, historyPage) => count + historyPage.length, 0);
      const totalPages = historyPages.length;

      // Embedを作成
      const embed = new EmbedBuilder()
        .setTitle("取引履歴")
        .setColor(COLOR.LIGFT_PINK)
        .setDescription(
          `全${totalCount}件中、${displayedBeforeCount + 1}〜${
            displayedBeforeCount + pagedHistoryStrings.length
          }件目を表示しています。\nページ ${currentPage}/${totalPages}`,
        )
        .setTimestamp();

      // 取引履歴をフィールドに追加
      const fields = this.createHistoryEmbedFields(pagedHistoryStrings);

      // フィールドを追加
      embed.addFields(fields);

      // ページネーションボタンを作成
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (totalPages > 1) {
        const row = new ActionRowBuilder<ButtonBuilder>();

        // 前へボタン
        if (currentPage > 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`history_page_${currentPage - 1}`)
              .setLabel("前へ")
              .setStyle(ButtonStyle.Primary)
              .setEmoji(EXTERNALE_MOJI_VIEWS.PREVIOUS),
          );
        }

        // 次へボタン
        if (currentPage < totalPages) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`history_page_${currentPage + 1}`)
              .setLabel("次へ")
              .setStyle(ButtonStyle.Primary)
              .setEmoji(EXTERNALE_MOJI_VIEWS.NEXT),
          );
        }

        if (row.components.length > 0) {
          components.push(row);
        }
      }

      await interaction.editReply({
        embeds: [embed],
        components: components,
      });
    } catch (error: any) {
      throw error;
    }
  }
}
