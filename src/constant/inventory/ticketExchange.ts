import { ITEM_KEY } from "./item";
import type { ItemKey } from "../../type/inventory/item";

export const TICKET_EXCHANGE_PREFIX = "ticketExchange";
export const TICKET_EXCHANGE_STEP_PREFIX = `${TICKET_EXCHANGE_PREFIX}:step:`;
export const TICKET_EXCHANGE_DRAFT_TTL_MS = 10 * 60 * 1_000;
export const TICKET_EXCHANGE_BATCH_SIZE = 5;
export const TICKET_EXCHANGE_MAX_QUANTITY = 100_000;
export const TICKET_EXCHANGE_TITLE = "チケット換金パネル";

// ホテル・遊戯券は通常料金（遊戯は最低料金）の10%。
// 割引券は利用額で価値が変わるため、10,000 LIAの商品に使った場合の割引額を採用。
export const TICKET_EXCHANGE_RATES: readonly {
  itemKey: ItemKey;
  label: string;
  unitPrice: number;
}[] = [
  { itemKey: ITEM_KEY.HOTEL_SECRET_FREE, label: "VIPホテル無料券（12時間）", unitPrice: 3_000 },
  { itemKey: ITEM_KEY.HOTEL_FREEDOM_FREE, label: "フリーダム無料券（12時間）", unitPrice: 5_000 },
  { itemKey: ITEM_KEY.GAME_SHORT_FREE, label: "遊戯VC作成券（24時間）", unitPrice: 500 },
  { itemKey: ITEM_KEY.SHOP_DISCOUNT_5, label: "市場割引券 5%OFF", unitPrice: 500 },
  { itemKey: ITEM_KEY.SHOP_DISCOUNT_10, label: "市場割引券 10%OFF", unitPrice: 1_000 },
];

export function getTicketExchangeRate(itemKey: string) {
  const rate = TICKET_EXCHANGE_RATES.find((candidate) => candidate.itemKey === itemKey);
  if (!rate) throw new Error("換金できないチケットです。");
  return rate;
}

export function parseTicketExchangeQuantity(value: string): number {
  const trimmed = value.trim();
  const quantity = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(quantity) ||
      quantity < TICKET_EXCHANGE_BATCH_SIZE || quantity > TICKET_EXCHANGE_MAX_QUANTITY ||
      quantity % TICKET_EXCHANGE_BATCH_SIZE !== 0) {
    throw new Error("枚数は5枚単位で、5〜100,000枚の整数を入力してください。");
  }
  return quantity;
}
