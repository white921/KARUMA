import { ITEM_KEY } from "../inventory/item";
import { ROLE_IDS } from "../shared/id";

export const GACHA_COIN_PREFIX = "gachaCoin";
export const GACHA_COIN_PANEL_TITLE = "ガチャコイン・アイテム交換所";
export const GACHA_COIN_MAX = 2_147_483_647;
export const GACHA_COIN_OPERATOR_ROLE_IDS = [
  ROLE_IDS.SHOP_STAFF, ROLE_IDS.SHOP_LEADER, ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI,
] as const;
export const GACHA_COIN_REWARDS = [
  { key: "game", itemKey: ITEM_KEY.GAME_SHORT_FREE, label: "遊戯24時間チケット", cost: 10 },
  { key: "secret", itemKey: ITEM_KEY.HOTEL_SECRET_FREE, label: "シクレ12時間チケット", cost: 20 },
  { key: "freedom", itemKey: ITEM_KEY.HOTEL_FREEDOM_FREE, label: "フリーダム12時間チケット", cost: 25 },
] as const;
export function getGachaCoinReward(key: string) {
  const reward = GACHA_COIN_REWARDS.find((entry) => entry.key === key);
  if (!reward) throw new Error("交換するアイテムが不正です。");
  return reward;
}
