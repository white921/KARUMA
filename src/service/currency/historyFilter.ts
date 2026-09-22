import { ACTION_TYPES as A, toActionType } from "../../constant/currency/action";
import { BOT_ID } from "../../constant/shared/id";
import type { Action } from "../../type/currency/action";

export const HISTORY_FILTER_PREFIX = "history:v1:";

// The order is encoded in component IDs. Append new groups; change the version to reorder.
export const HISTORY_FILTER_GROUPS: { label: string; types: string[]; hidden?: boolean; replacement?: number }[] = [
  { label: "送金", types: [A.TRANSFER, A.SUPERCHAT] },
  { label: "カジノ（GF・麻雀・その他）", types: [A.CASINO_GF, A.CASINO_MAHJONG, A.CASINO_OTHER] },
  { label: "市場・夢印", types: [A.SHOP_PURCHASE, A.DARK_SHOP_PURCHASE, A.COURT_SHOP_PURCHASE, A.MARKET_GACHA_DRAW, A.CREATOR_EMBLEM_PAYMENT, A.TICKET_EXCHANGE, A.DISPLAY_NAME_CHANGE] },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "送金", types: [], hidden: true, replacement: 0 },
  { label: "執事・メイド支払い", types: [A.CAST_PAYMENT] },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "おみくじ", types: [A.OMIKUJI_DRAW] },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "給与支払い", types: [A.SALARY_PAYMENT] },
  { label: "VC滞在報酬", types: [A.VC_REWARD] },
  { label: "サーバーブースト報酬", types: [A.SERVER_BOOST_REWARD] },
  { label: "付与・剥奪", types: [], hidden: true, replacement: 15 },
  { label: "付与・剥奪", types: [A.ROLE_BASED_GRANT, A.ADMIN_MINT, A.ADMIN_BURN] },
  { label: "付与・剥奪", types: [], hidden: true, replacement: 15 },
  { label: "市場・夢印", types: [], hidden: true, replacement: 2 },
  { label: "ホテル", types: [A.HOTEL_NORMAL, A.HOTEL_SECRET, A.HOTEL_SECRET_LONG, A.HOTEL_FREEDOM, A.HOTEL_FREEDOM_LONG] },
  { label: "独房", types: [A.SOLITARY_CELL] },
  { label: "日記", types: [A.DIARY_PRIVATE, A.DIARY_PUBLIC, A.DIARY_UPDATE] },
  { label: "遊戯の間", types: [A.GAME_SHORT, A.GAME_LONG, A.GAME_SHORT_EXTEND, A.GAME_PASS, A.GAME_VC_CREATE, A.GAME_CRIMINAL_ACCESS, A.GAME_PASS_TWO_WEEKS, A.GAME_PASS_ONE_MONTH, A.MINECRAFT_PASS] },
  { label: "辺境の狭間", types: [A.HAZAMA_ACCESS] },
  { label: "ルーレット", types: [A.ROULETTE_BET, A.ROULETTE_PAYOUT, A.ROULETTE_BONUS] },
];

export interface HistoryFilters {
  counterparty?: string;
  groups: number[];
  direction: "all" | "income" | "expense";
}

export function emptyHistoryFilters(): HistoryFilters {
  return { groups: [], direction: "all" };
}

/** Preserve old component IDs while merging retired choices into their current groups. */
export function normalizeHistoryFilters(filters: HistoryFilters): HistoryFilters {
  return {
    ...filters,
    groups: [...new Set(filters.groups.map(index => HISTORY_FILTER_GROUPS[index]?.replacement ?? index))]
      .filter(index => HISTORY_FILTER_GROUPS[index] && !HISTORY_FILTER_GROUPS[index].hidden),
  };
}

export function historyActionType(action: Action): string {
  try { return toActionType(action.command_name); }
  catch { return action.command_name; }
}

const transfers = new Set<string>([A.TRANSFER, A.CREATOR_EMBLEM_PAYMENT, A.SUPERCHAT, A.CAST_PAYMENT, A.CASINO_GF, A.CASINO_MAHJONG, A.CASINO_OTHER]);
const credits = new Set<string>([A.TICKET_EXCHANGE, A.SALARY_PAYMENT, A.SERVER_BOOST_REWARD, A.VC_REWARD, A.ROLE_BASED_GRANT, A.ADMIN_MINT, A.OMIKUJI_DRAW, A.ROULETTE_PAYOUT, A.ROULETTE_BONUS]);
const knownTypes = new Set<string>(Object.values(A));

/** Match the account actually changed, excluding grant/burn operators and system-only sides. */
export function historyEffect(action: Action, userId: string) {
  const type = historyActionType(action);
  if (!knownTypes.has(type)) return null;
  const from = action.from_user_id === userId;
  const to = action.to_user_id === userId;
  const amount = Number(action.amount);
  if (transfers.has(type)) {
    if (!from && !to) return null;
    return {
      counterparty: from ? action.to_user_id : action.from_user_id,
      delta: from && to ? 0 : from ? -amount : amount,
      wallet: Number(from ? action.from_after_wallet : action.to_after_wallet),
    };
  }
  if (credits.has(type)) {
    if (!to) return null;
    return { counterparty: BOT_ID, delta: amount, wallet: Number(action.to_after_wallet) };
  }
  if (!from) return null;
  return { counterparty: BOT_ID, delta: -amount, wallet: Number(action.from_after_wallet) };
}

export function matchesHistoryFilters(action: Action, userId: string, filters: HistoryFilters): boolean {
  filters = normalizeHistoryFilters(filters);
  const effect = historyEffect(action, userId);
  if (!effect) return false;
  if (filters.counterparty && filters.counterparty !== effect.counterparty) return false;
  if (filters.direction === "income" && effect.delta <= 0) return false;
  if (filters.direction === "expense" && effect.delta >= 0) return false;
  return filters.groups.length === 0 || filters.groups.some(group =>
    HISTORY_FILTER_GROUPS[group]?.types.includes(historyActionType(action)),
  );
}

export type HistoryControl = "counterparty" | "groups" | "direction" | "page" | "reset";

/** Compact state survives page turns, multiple open histories, and bot restarts. */
export function historyCustomId(userId: string, filters: HistoryFilters, control: HistoryControl, page = 1): string {
  const mask = filters.groups.reduce((value, group) => value | (1 << group), 0);
  return `${HISTORY_FILTER_PREFIX}${userId}:${filters.counterparty || "-"}:${mask.toString(36)}:${filters.direction}:${control}:${page}`;
}

export function parseHistoryCustomId(customId: string, userId: string) {
  const parts = customId.split(":");
  const [prefix, version, owner, counterparty, encodedMask, direction, control, rawPage] = parts;
  const mask = parseInt(encodedMask, 36);
  const page = Number(rawPage);
  if (parts.length !== 8 || prefix !== "history" || version !== "v1" || owner !== userId ||
      !/^\d{17,20}$/.test(owner) || (counterparty !== "-" && !/^\d{17,20}$/.test(counterparty)) ||
      !/^[0-9a-z]+$/.test(encodedMask) || !Number.isSafeInteger(mask) || mask < 0 || mask >= 2 ** HISTORY_FILTER_GROUPS.length ||
      !["all", "income", "expense"].includes(direction) ||
      !["counterparty", "groups", "direction", "page", "reset"].includes(control) ||
      !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1) {
    throw new Error("履歴の操作情報が無効です。銀行窓口から取引履歴を開き直してください。");
  }
  const filters: HistoryFilters = {
    counterparty: counterparty === "-" ? undefined : counterparty,
    groups: HISTORY_FILTER_GROUPS.flatMap((_, index) => mask & (1 << index) ? [index] : []),
    direction: direction as HistoryFilters["direction"],
  };
  return { filters, control: control as HistoryControl, page };
}
