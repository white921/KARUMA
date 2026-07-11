export function getRouletteEventKey(): string {
  return process.env.ROULETTE_EVENT_KEY?.trim() || "2026-07-17";
}
export const ROULETTE_PARTICIPATION_BONUS = 30_000;

export const ROULETTE_ACTION_NAMES = {
  BET: "rouletteBet",
  PAYOUT: "roulettePayout",
  BONUS: "rouletteBonus",
} as const;

export const ROULETTE_MESSAGES = {
  PANEL_NOT_CONFIGURED: (stage: number) =>
    `ルーレット第${stage}部パネルのチャンネルIDが未設定です。環境変数を設定してください。`,
  OPERATOR_ONLY: "ルーレットの運営操作を実行する権限がありません。",
  NO_OPEN_ROUND: "現在、受付中または締切済みで未精算のルーレットはありません。",
  BETTING_CLOSED: "このラウンドは現在ベットを受け付けていません。",
  BETTING_NOT_OPEN_FOR_STAGE: (stage: number) =>
    `第${stage}部は現在ベットを受け付けていません。運営の「/賭け開始」で受付開始をお待ちください。`,
  ALREADY_BET: "このラウンドではすでにベットを確定しています。賭け直しはできません。",
};
