/** 2026-09-22 00:00:00 JST。DBのUnix秒と比較してタイムゾーン差を避ける。 */
export const GACHA_COIN_ACTIVATION_EPOCH = 1_790_002_800;
export const GACHA_COIN_ROLLOUT_KEY = "20260922";
export const GACHA_COIN_HISTORY_OVERRIDES: Readonly<Record<string, number>> = {
  "1548643376184823871": 30, // 綾目: 旧アカウント25回 + 現アカウント5回。通常集計へ上乗せしない。
};
