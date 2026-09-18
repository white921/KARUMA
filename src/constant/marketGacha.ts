import type { MarketGachaPrize } from "../type/marketGacha";
import { TEXT_CHANNEL_IDS } from "./id";

export const MARKET_GACHA_PRICE = 5_000;

export const MARKET_GACHA_DAILY_LIMIT = 5;

/** 確率の単位は %。合計が100になることをテストで保証する。 */
export const MARKET_GACHA_PRIZES: readonly MarketGachaPrize[] = [
  {
    key: "superchat",
    label: "サプボ",
    probability: 18,
    audioCategory: "superchat",
  },
  {
    key: "song_cover",
    label: "歌みた",
    probability: 18,
    audioCategory: "song_cover",
  },
  { key: "idol_collab", label: "アイドルコラボ", probability: 3 },
  { key: "superchat_nomination", label: "サプボ指名", probability: 5 },
  { key: "game_free_1", label: "遊戯チケット 1枚", probability: 12.5 },
  { key: "game_free_3", label: "遊戯チケット 3枚", probability: 6.5 },
  { key: "secret_free_1", label: "シークレット無料チケット 1枚", probability: 6.5 },
  { key: "secret_free_3", label: "シークレット無料チケット 3枚", probability: 3 },
  { key: "freedom_free_1", label: "フリーダム無料チケット 1枚", probability: 3 },
  {
    key: "discount_5",
    label: "市場割引 5%OFF（100万LIA以上の商品は利用不可）",
    probability: 5,
  },
  {
    key: "discount_10",
    label: "市場割引 10%OFF（100万LIA以上の商品は利用不可）",
    probability: 2,
  },
  { key: "detention_pass_3_days", label: "どこでも通行券", probability: 7 },
  { key: "custom_role_week", label: "カスタムロール（1週間）", probability: 0.5 },
  { key: "one_more_chance", label: "ワンモアチャンス", probability: 5 },
  { key: "day_off", label: "1日休み", probability: 2 },
  { key: "event_proposal", label: "イベント提案券", probability: 3 },
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
