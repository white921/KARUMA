import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from "discord.js";
import type { RowDataPacket } from "mysql2";
import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { ACTION_TYPES } from "../../constant/currency/action";
import { COLOR } from "../../constant/shared/color";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { EXTERNALE_MOJI_VIEWS } from "../../constant/shared/emoji";
import {
  HISTORY_FIELD_VALUE_MAX_LENGTH,
  HISTORY_PAGE_CONTENT_MAX_LENGTH,
  HISTORY_PAGE_ITEM_LIMIT,
  HISTORY_TITLE_MAPPER,
} from "../../constant/currency/history";
import type { Action } from "../../type/currency/action";
import type { EmbedField } from "../../type/shared/embed";
import { AccountService } from "../account/accountService";
import { DbService } from "../system/dbService";

import {
  emptyHistoryFilters, HISTORY_FILTER_GROUPS, historyActionType, historyCustomId,
  historyEffect, matchesHistoryFilters, parseHistoryCustomId,
  type HistoryFilters, type HistoryControl,
} from "./historyFilter";

type HistoryInteraction = ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction;

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

  static filterActions(actions: Action[], userId: string, filters = emptyHistoryFilters()): Action[] {
    return actions.filter(action => matchesHistoryFilters(action, userId, filters))
      .sort((a, b) => b.id - a.id);
  }

  /** 1件の取引履歴を表示用文字列に変換する。 */
  static createHistoryString(action: Action, userId: string): string | null {
    const date = dayjs(action.created_at)
      .tz("Asia/Tokyo")
      .format("MM/DD HH:mm");
    const type = historyActionType(action);
    const effect = historyEffect(action, userId);
    if (!effect) return null;
    const titleText = HISTORY_TITLE_MAPPER[type] || "不明な取引";
    const sign = effect.delta > 0 ? "+" : effect.delta < 0 ? "-" : "";
    let value = `<@${effect.counterparty}> ${effect.delta < 0 ? "へ" : "から"}\n${sign}${Math.abs(effect.delta).toLocaleString()}${CURRENCY_NAMES}　　　残高: ${effect.wallet.toLocaleString()}${CURRENCY_NAMES}`;

    if (action.comment) {
      if (type === ACTION_TYPES.DISPLAY_NAME_CHANGE) {
        const [oldName, newName] = action.comment.split("_");
        value += `\n${oldName}から${newName}に変更`;
      } else {
        value += `\n備考: ${action.comment}`;
      }
    }

    return `**${date} ${titleText}**\n${value}`;
  }

  /**
   * 履歴文字列を1ページ最大10件で分割する。
   * 10件分がEmbed全体の安全な文字数を超える場合だけは、送信エラーを防ぐため早めに改ページする。
   */
  static createHistoryPages(historyStrings: string[]): string[][] {
    const pages: string[][] = [];
    let currentPage: string[] = [];
    let currentLength = 0;

    for (const historyString of historyStrings) {
      const separatorLength = currentPage.length > 0 ? 2 : 0;
      if (
        currentPage.length > 0 &&
        (currentPage.length >= HISTORY_PAGE_ITEM_LIMIT ||
          currentLength + separatorLength + historyString.length >
            HISTORY_PAGE_CONTENT_MAX_LENGTH)
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

  static createFilterComponents(userId: string, filters: HistoryFilters, actions: Action[], page: number, totalPages: number) {
    const id = (control: HistoryControl, targetPage = 1) => historyCustomId(userId, filters, control, targetPage);
    const counterparty = new UserSelectMenuBuilder()
      .setCustomId(id("counterparty"))
      .setPlaceholder("取引相手：すべて（選択解除で全員）")
      .setMinValues(0).setMaxValues(1);
    if (filters.counterparty) counterparty.setDefaultUsers(filters.counterparty);

    // Base options on all visible history, so combining filters never removes a selected option.
    const availableTypes = new Set(actions.map(historyActionType));
    let options = HISTORY_FILTER_GROUPS.flatMap((group, index) =>
      !group.hidden && (group.types.some(type => availableTypes.has(type)) || filters.groups.includes(index))
        ? [{ label: group.label, value: String(index), default: filters.groups.includes(index) }]
        : [],
    );
    const noOptions = options.length === 0;
    if (noOptions) options = [{ label: "アクションの履歴がありません", value: "none", default: false }];
    const groups = new StringSelectMenuBuilder()
      .setCustomId(id("groups"))
      .setPlaceholder("アクションの種類：すべて（複数選択可）")
      .setMinValues(0).setMaxValues(options.length).setDisabled(noOptions)
      .addOptions(options);
    const direction = new StringSelectMenuBuilder()
      .setCustomId(id("direction"))
      .setPlaceholder("収入／支出")
      .addOptions([
        { label: "収入・支出すべて", value: "all", default: filters.direction === "all" },
        { label: "収入のみ", value: "income", default: filters.direction === "income" },
        { label: "支出のみ", value: "expense", default: filters.direction === "expense" },
      ]);
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(id("page", Math.max(1, page - 1)))
        .setLabel("前へ").setStyle(ButtonStyle.Primary).setEmoji(EXTERNALE_MOJI_VIEWS.PREVIOUS).setDisabled(page <= 1),
      new ButtonBuilder().setCustomId(id("page", page + 1))
        .setLabel("次へ").setStyle(ButtonStyle.Primary).setEmoji(EXTERNALE_MOJI_VIEWS.NEXT).setDisabled(page >= totalPages),
      new ButtonBuilder().setCustomId(id("reset"))
        .setLabel("条件をすべて解除").setStyle(ButtonStyle.Secondary)
        .setDisabled(!filters.counterparty && filters.groups.length === 0 && filters.direction === "all"),
    );
    return [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(counterparty),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(groups),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(direction),
      buttons,
    ];
  }

  static async handleFilter(interaction: HistoryInteraction): Promise<void> {
    // Acknowledge before querying accounts/history. Button interactions may already be deferred.
    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    const state = parseHistoryCustomId(interaction.customId, interaction.user.id);
    let { filters } = state;
    if (interaction.isUserSelectMenu() && state.control === "counterparty") {
      const selected = interaction.values[0];
      if (selected && !/^\d{17,20}$/.test(selected)) throw new Error("取引相手が無効です。");
      filters.counterparty = selected;
    } else if (interaction.isStringSelectMenu() && state.control === "groups") {
      if (interaction.values.some(value => !/^\d+$/.test(value) || !HISTORY_FILTER_GROUPS[Number(value)])) {
        throw new Error("アクションの種類が無効です。");
      }
      filters.groups = [...new Set(interaction.values.map(Number))];
    } else if (interaction.isStringSelectMenu() && state.control === "direction") {
      const selected = interaction.values[0];
      if (!["all", "income", "expense"].includes(selected)) throw new Error("収入／支出の条件が無効です。");
      filters.direction = selected as HistoryFilters["direction"];
    } else if (interaction.isButton() && state.control === "reset") {
      filters = emptyHistoryFilters();
    } else if (!interaction.isButton() || state.control !== "page") {
      throw new Error("履歴の操作が無効です。");
    }
    await this.viewHistory(interaction, state.control === "page" ? state.page : 1, filters);
  }

  static async viewHistory(
    interaction: HistoryInteraction,
    page = 1,
    filters = emptyHistoryFilters(),
  ): Promise<void> {
    // Drop retired conditions from already-open history messages as well.
    filters = { ...filters, groups: filters.groups.filter(group => !HISTORY_FILTER_GROUPS[group]?.hidden) };
    const userId = interaction.user.id;
    if (!(await AccountService.hasAccount(userId))) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }
    const actions = this.filterActions(await this.getActionsByUserId(userId), userId);
    const historyStrings = this.filterActions(actions, userId, filters)
      .map(action => this.createHistoryString(action, userId))
      .filter((value): value is string => value !== null);
    const historyPages = this.createHistoryPages(historyStrings);
    const totalPages = Math.max(1, historyPages.length);
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const pagedHistoryStrings = historyPages[currentPage - 1] || [];
    const displayedBeforeCount = historyPages.slice(0, currentPage - 1)
      .reduce((count, historyPage) => count + historyPage.length, 0);
    const conditions = [
      `取引相手：${filters.counterparty ? `<@${filters.counterparty}>` : "すべて"}`,
      `種類：${filters.groups.length ? filters.groups.map(group => HISTORY_FILTER_GROUPS[group].label).join("・") : "すべて"}`,
      `収入／支出：${{ all: "すべて", income: "収入のみ", expense: "支出のみ" }[filters.direction]}`,
    ];
    const countText = historyStrings.length
      ? `該当${historyStrings.length}件中、${displayedBeforeCount + 1}〜${displayedBeforeCount + pagedHistoryStrings.length}件目を表示しています。\nページ ${currentPage}/${totalPages}`
      : actions.length ? "条件に一致する取引履歴がありません。" : "取引履歴がありません。";
    const embed = new EmbedBuilder().setTitle("取引履歴").setColor(COLOR.LIGFT_PINK)
      .setDescription(`${conditions.join("\n")}\n\n${countText}`)
      .addFields(this.createHistoryEmbedFields(pagedHistoryStrings)).setTimestamp();
    await interaction.editReply({
      content: "",
      embeds: [embed],
      components: this.createFilterComponents(userId, filters, actions, currentPage, totalPages),
      allowedMentions: { parse: [] },
    });
  }
}
