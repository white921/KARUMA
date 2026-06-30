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

import {
  HISTORY_TITLE_MAPPER,
  ACTION_COUNT_PER_PAGE,
} from "../constant/history";
import { PANEL_COMMAND_NAMES, COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { AETHER_BOT_ID } from "../constant/id";
import { EXTERNALE_MOJI_VIEWS } from "../constant/emoji";

dayjs.extend(utc);
dayjs.extend(timezone);

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
   * 取引履歴の配列から指定されたページの履歴を取得する
   * @param actions 取引履歴の配列
   * @param page ページ番号（1から始まる）
   * @param limit 1ページあたりの件数（デフォルト: 10）
   * @returns 指定されたページの取引履歴の配列
   */
  static getPagedHistories(
    actions: Action[],
    page: number = 1,
    limit: number = ACTION_COUNT_PER_PAGE,
  ): Action[] {
    const offset = (page - 1) * limit;
    return actions.slice(offset, offset + limit);
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
      [PANEL_COMMAND_NAMES.SHOP_SEND]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.ROLE_BASED_SEND]: `<@${AETHER_BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.ADMIN_MINT]: `<@${AETHER_BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.ADMIN_BURN]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.PAY_SALARY]: `<@${AETHER_BOT_ID}> から\n+${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.to_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [COMMAND_NAMES.CHANGE_NAME]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_SECRET]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_PRIVATE]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_PUBLIC]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
      [PANEL_COMMAND_NAMES.DIARY_UPDATE]: `<@${AETHER_BOT_ID}> へ\n-${action.amount.toLocaleString()}${CURRENCY_NAMES}　　　残高: ${action.from_after_wallet.toLocaleString()}${CURRENCY_NAMES}`,
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
    };

    return historyObject;
  }

  /**
   * 取引履歴をEmbedフィールド形式に変換
   * 1ページ分の履歴を1つのフィールドにまとめる
   * @param history 取引履歴の配列
   * @param userId ユーザーID
   * @returns Embedフィールド
   */
  static createHistoryEmbedFields(
    history: Action[],
    userId: string,
  ): EmbedField | undefined {
    // 各履歴を文字列形式に変換
    const historyStrings = history
      .map((action) => {
        const date = dayjs(action.created_at)
          .tz("Asia/Tokyo")
          .format("MM/DD HH:mm");

        const titleText =
          HISTORY_TITLE_MAPPER[action.command_name] || "不明な取引";
        const title = `${date} ${titleText}`;

        const historyObject = this.convertActiontoHistoryObject(action, userId);
        let value = historyObject[action.command_name];

        // valueがundefinedの場合はスキップ
        if (!value) {
          return null;
        }

        // commentがある場合は追加
        if (action.comment) {
          if (action.command_name === COMMAND_NAMES.CHANGE_NAME) {
            const parts = action.comment.split("_");
            const oldName = parts[0];
            const newName = parts[1];
            value += `\n${oldName}から${newName}に変更`;
          } else {
            value += `\n備考: ${action.comment}`;
          }
        }

        return `**${title}**\n${value}`;
      })
      .filter((str) => str !== null) as string[];

    // 履歴が存在しない場合は空のフィールドを返す
    if (historyStrings.length === 0) {
      return undefined;
    }

    // すべての履歴を改行で結合（履歴ごとに空行を追加）
    const combinedValue = historyStrings.join("\n\n");

    // 1つのフィールドとして返す
    return {
      name: "\u200B",
      value: combinedValue,
    };
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
      const totalCount = filteredActions.length;

      if (totalCount === 0) {
        await interaction.editReply({
          content: "取引履歴がありません。",
        });
        return;
      }

      const pagedHistories = this.getPagedHistories(
        filteredActions,
        page,
        ACTION_COUNT_PER_PAGE,
      );

      const totalPages = Math.ceil(totalCount / ACTION_COUNT_PER_PAGE);

      // Embedを作成
      const embed = new EmbedBuilder()
        .setTitle("取引履歴")
        .setColor(COLOR.LIGFT_PINK)
        .setDescription(
          `全${totalCount}件中、${(page - 1) * ACTION_COUNT_PER_PAGE + 1}〜${
            (page - 1) * ACTION_COUNT_PER_PAGE + pagedHistories.length
          }件目を表示しています。\nページ ${page}/${totalPages}`,
        )
        .setTimestamp();

      // 取引履歴をフィールドに追加
      const fields = this.createHistoryEmbedFields(pagedHistories, userId);

      // フィールドを追加
      if (fields) {
        embed.addFields(fields);
      }

      // ページネーションボタンを作成
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (totalPages > 1) {
        const row = new ActionRowBuilder<ButtonBuilder>();

        // 前へボタン
        if (page > 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`history_page_${page - 1}`)
              .setLabel("前へ")
              .setStyle(ButtonStyle.Primary)
              .setEmoji(EXTERNALE_MOJI_VIEWS.PREVIOUS),
          );
        }

        // 次へボタン
        if (page < totalPages) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`history_page_${page + 1}`)
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
