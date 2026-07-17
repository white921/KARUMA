export type OmikujiPrize = {
  fortune: "小吉" | "中吉" | "大吉" | "凶" | "超大吉";
  amount: number;
  probability: number;
};

/** 確率の単位は %。合計が100になることをテストで保証する。 */
export const OMIKUJI_PRIZES: readonly OmikujiPrize[] = [
  { fortune: "小吉", amount: 1_000, probability: 34.5 },
  { fortune: "中吉", amount: 2_000, probability: 59 },
  { fortune: "大吉", amount: 5_000, probability: 5 },
  { fortune: "凶", amount: -3_000, probability: 1 },
  { fortune: "超大吉", amount: 50_000, probability: 0.5 },
];

export const OMIKUJI_MESSAGES = {
  SUB_ACCOUNT_NOT_ALLOWED: "サブアカウントではおみくじを引けません。",
};

export function selectOmikujiPrize(randomValue: number): OmikujiPrize {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error("おみくじ乱数の値が不正です。");
  }

  const threshold = randomValue * 100;
  let cumulative = 0;
  for (const prize of OMIKUJI_PRIZES) {
    cumulative += prize.probability;
    if (threshold < cumulative) {
      return prize;
    }
  }

  throw new Error("おみくじの確率設定が不正です。");
}
