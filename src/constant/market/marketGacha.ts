import type { MarketGachaPrize } from "../../type/market/marketGacha";
import { ITEM_KEY } from "../inventory/item";
import { TEXT_CHANNEL_IDS } from "../shared/id";

export const MARKET_GACHA_PRICE = 5_000;
export const MARKET_GACHA_DAILY_LIMIT = 5;
export const MARKET_GACHA_CONFIRMATION_PREFIX = "marketGachaSession";
export const MARKET_GACHA_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/** 確率の単位は%。身分別の代替景品は通行券の5%枠を共有する。 */
export const MARKET_GACHA_PRIZES: readonly MarketGachaPrize[] = [
  { key: "superchat", label: "サプボ", probability: 15, audioCategory: "superchat" },
  { key: "song_cover", label: "歌みた", probability: 15, audioCategory: "song_cover" },
  { key: "idol_collab", label: "アイドルコラボ", probability: 3 },
  { key: "superchat_nomination", label: "サプボ指名", probability: 4 },
  { key: "voice_message_nomination", label: "ボイメ指名", probability: 4 },
  { key: "letter", label: "お手紙", probability: 3 },
  { key: "private_call", label: "個通強制券", probability: 3 },
  { key: "game_free_1", label: "遊戯チケット1枚", probability: 6, itemKey: ITEM_KEY.GAME_SHORT_FREE, quantity: 1 },
  { key: "game_free_3", label: "遊戯チケット3枚", probability: 3, itemKey: ITEM_KEY.GAME_SHORT_FREE, quantity: 3 },
  { key: "secret_free_1", label: "シークレット無料チケット1枚", probability: 5, itemKey: ITEM_KEY.HOTEL_SECRET_FREE, quantity: 1 },
  { key: "secret_free_3", label: "シークレット無料チケット3枚", probability: 3, itemKey: ITEM_KEY.HOTEL_SECRET_FREE, quantity: 3 },
  { key: "freedom_free_1", label: "フリーダム無料チケット1枚", probability: 3, itemKey: ITEM_KEY.HOTEL_FREEDOM_FREE, quantity: 1 },
  { key: "discount_5", label: "市場5%割引券", probability: 5, itemKey: ITEM_KEY.SHOP_DISCOUNT_5, quantity: 1 },
  { key: "discount_10", label: "市場10%割引券", probability: 2.5, itemKey: ITEM_KEY.SHOP_DISCOUNT_10, quantity: 1 },
  { key: "detention_pass_3_days", label: "どこでも通行券（3日）", probability: 5 },
  { key: "custom_role_week", label: "カスタムロール（1週間）", probability: 0.5 },
  { key: "soundboard_week", label: "サウンドボード追加券（1週間）", probability: 0.5 },
  { key: "one_more_chance", label: "もう1回", probability: 6 },
  { key: "miss", label: "ハズレ", probability: 2 },
  { key: "gacha_coin_2", label: "ガチャコイン2枚", probability: 7, coins: 2 },
  { key: "gacha_coin_4", label: "ガチャコイン4枚", probability: 3, coins: 4 },
  { key: "gacha_coin_6", label: "ガチャコイン6枚", probability: 1.5, coins: 6 },
];

export function selectMarketGachaPrize(randomValue: number): MarketGachaPrize {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error("ガチャ乱数の値が不正です。");
  }

  const threshold = randomValue * 100;
  let cumulative = 0;
  for (const prize of MARKET_GACHA_PRIZES) {
    cumulative += prize.probability;
    if (threshold < cumulative) {
      return prize;
    }
  }

  // 景品確率を変更したときに、設定漏れを見逃さないための保険。
  throw new Error("市場ガチャの景品確率設定が不正です。");
}

export const GENERAL_INQUIRY_CHANNEL_MENTION = `<#${TEXT_CHANNEL_IDS.GENERAL_INQUIRY}>`;

export const MARKET_TICKET_GUIDANCE = `${GENERAL_INQUIRY_CHANNEL_MENTION}にて市場チケットを切り、当選メッセージをスクショしてチケット内に送信してください。`;

export const AUDIO_PRIZE_PROHIBITION_NOTICE =
  "※転載・転送・保存・画面録画等は禁止です。";
