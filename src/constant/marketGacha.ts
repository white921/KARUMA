export const MARKET_GACHA_PRICE = 5_000;
export const MARKET_GACHA_DAILY_LIMIT = 5;

export type MarketGachaPrizeKey =
  | "secret_free_1"
  | "secret_free_3"
  | "freedom_free_1"
  | "cult_chat_free"
  | "custom_role_week"
  | "discount_5"
  | "discount_10"
  | "superchat"
  | "song_cover"
  | "remote_control";

export type MarketGachaAudioCategory = "superchat" | "song_cover";

export type MarketGachaPrize = {
  key: MarketGachaPrizeKey;
  label: string;
  probability: number;
  /** R2上の当選ファイルをDBから選んで渡す景品かどうか */
  audioCategory?: MarketGachaAudioCategory;
};

/** 確率の単位は %。合計が100になることをテストで保証する。 */
export const MARKET_GACHA_PRIZES: readonly MarketGachaPrize[] = [
  { key: "secret_free_1", label: "シークレット無料 1回", probability: 10 },
  { key: "secret_free_3", label: "シークレット無料 3回", probability: 6 },
  { key: "freedom_free_1", label: "フリーダム無料 1回", probability: 3 },
  { key: "cult_chat_free", label: "教祖雑談無料", probability: 10 },
  { key: "custom_role_week", label: "カスタムロール 一週間", probability: 1 },
  {
    key: "discount_5",
    label: "ショップ割引 5%OFF（100万krm以上の商品は利用不可）",
    probability: 10,
  },
  {
    key: "discount_10",
    label: "ショップ割引 10%OFF（100万krm以上の商品は利用不可）",
    probability: 5,
  },
  {
    key: "superchat",
    label: "準メン以上 サプボ",
    probability: 25,
    audioCategory: "superchat",
  },
  {
    key: "song_cover",
    label: "準メン以上 歌みた",
    probability: 25,
    audioCategory: "song_cover",
  },
  { key: "remote_control", label: "教祖遠隔", probability: 5 },
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
