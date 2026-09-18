import type { RouletteBetKind, RouletteStage } from "../type/roulette";
import { ROLE_IDS } from "./id";

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

export const STAGE_DESCRIPTIONS: Record<RouletteStage, string> = {
  1: "赤・黒・偶数・奇数から選んでベットできます。\n各ラウンド一人一賭け、確定後の変更はできません。",
  2: "赤・黒・偶数・奇数に加え、ダズン（1〜12／13〜24／25〜36）を選べます。\n各ラウンド一人一賭け、確定後の変更はできません。",
  3: "赤・黒・偶数・奇数・ダズンに加え、ストレートアップとスプリットを選べます。\nストレートアップ：数字を1つ指定（36倍）\nスプリット：異なる数字を2つ指定（18倍）\n各ラウンド一人一賭け、確定後の変更はできません。",
};

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export const STAGE_BET_KINDS: Record<RouletteStage, RouletteBetKind[]> = {
  1: ["red", "black", "even", "odd"],
  2: ["red", "black", "even", "odd", "dozen"],
  3: ["red", "black", "even", "odd", "dozen", "straight", "split"],
};

export const ROULETTE_BET_LABELS: Record<RouletteBetKind, string> = {
  red: "赤",
  black: "黒",
  even: "偶数",
  odd: "奇数",
  dozen: "ダズン",
  straight: "ストレートアップ",
  split: "スプリット",
};

export const ROULETTE_DOZEN_RANGES: Record<string, string> = {
  1: "1-12",
  2: "13-24",
  3: "25-36",
};

export const ROULETTE_BET_KINDS: RouletteBetKind[] = [
  "red", "black", "even", "odd", "dozen", "straight", "split",
];

export const ROULETTE_OPERATOR_ROLE_IDS = [
  ROLE_IDS.EVENT_LEADER,
  ROLE_IDS.EVENT_STAFF,
  ROLE_IDS.GIJUTU_LEADER,
];
