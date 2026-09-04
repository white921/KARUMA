export const GAME_PRICE = {
  SHORT: 5000,
  LONG: 10000,
  PASS: 100000,
};

export const GAME_VC = {
  TYPE: "GAME",
  DURATION_HOURS: 24,
  PRICES: {
    TRAVELER_OR_ABOVE: 5000,
    VACANT: 6000,
    CRIMINAL: 10000,
  },
  PASS_PRICES: {
    TWO_WEEKS: 50000,
    ONE_MONTH: 100000,
  },
} as const;

export const GAME_MESSAGES = {
  NO_PERMISSION: "あなたは遊戯師の権限を持っていません。",
  GAME_SHORT: "6時間プラン",
  GAME_LONG: "12時間プラン",
  GAME_PASS: "ゲームパス",
  NOT_ENOUGH_BALANCE: "残高が不足しています。",
  INVALID_GAME_TYPE: "無効な遊戯タイプです。",
  INVALID_ROLE: "無効なロールです。",
  ALREADY_HAS_ROLE: "既にロールが付与されています。",
  INVALID_EXPIRE_AT: "有効期限が無効です。",
  HAS_NOT_TICKET: "遊戯チケットがありません。",
  NO_ELIGIBLE_ROLE: "遊戯VCを作成できるロールではありません。",
  PASS_PURCHASE_REQUIRES_TRAVELER: "ゲームパスは旅人以上のみ購入できます。",
};
