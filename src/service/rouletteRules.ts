import { RouletteBet, RouletteBetKind, RouletteStage } from "../type/roulette";

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteResultColor = "red" | "black" | "green";

const STAGE_BET_KINDS: Record<RouletteStage, RouletteBetKind[]> = {
  1: ["red", "black", "even", "odd"],
  2: ["red", "black", "even", "odd", "dozen"],
  3: ["red", "black", "even", "odd", "dozen", "straight", "split"],
};

export const ROULETTE_BET_LABELS: Record<RouletteBetKind, string> = {
  red: "赤",
  black: "黒",
  even: "偶数",
  odd: "奇数",
  dozen: "1〜12",
  straight: "ストレートアップ",
  split: "スプリット",
};

export function isRouletteStage(value: number): value is RouletteStage {
  return value === 1 || value === 2 || value === 3;
}

export function getAllowedBetKinds(stage: RouletteStage): RouletteBetKind[] {
  return STAGE_BET_KINDS[stage];
}

export function getRouletteResultColor(result: number): RouletteResultColor {
  if (!Number.isInteger(result) || result < 0 || result > 36) {
    throw new Error("結果は0〜36の整数で指定してください。");
  }
  if (result === 0) return "green";
  return RED_NUMBERS.has(result) ? "red" : "black";
}

export function normalizeRouletteResultColor(value: string): RouletteResultColor | null {
  if (["赤", "あか", "アカ"].includes(value)) return "red";
  if (["黒", "くろ", "クロ"].includes(value)) return "black";
  if (["緑", "みどり", "ミドリ"].includes(value)) return "green";
  return null;
}

export function getBetLabel(bet: Pick<RouletteBet, "kind" | "selection">): string {
  if (bet.kind === "dozen") return bet.selection;
  if (bet.kind === "straight") return `${bet.selection} に一点`;
  if (bet.kind === "split") return `${bet.selection.replace("-", " と ")}`;
  return ROULETTE_BET_LABELS[bet.kind];
}

export function validateRouletteBet(
  stage: RouletteStage,
  kind: RouletteBetKind,
  selection: string,
  amount: number,
): void {
  if (!getAllowedBetKinds(stage).includes(kind)) {
    throw new Error("この部では選択できない賭け方です。");
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("賭け金は1以上の整数で入力してください。");
  }

  if (["red", "black", "even", "odd"].includes(kind)) {
    if (selection !== kind) throw new Error("賭け方の指定が不正です。");
    return;
  }

  if (kind === "dozen") {
    if (!["1-12", "13-24", "25-36"].includes(selection)) {
      throw new Error("ダズンは「1-12」「13-24」「25-36」から選択してください。");
    }
    return;
  }

  if (kind === "straight") {
    const number = Number(selection);
    if (!Number.isInteger(number) || number < 1 || number > 36) {
      throw new Error("ストレートアップは1〜36の数字を指定してください。");
    }
    return;
  }

  const [first, second, ...rest] = selection.split("-").map(Number);
  if (
    rest.length > 0 ||
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 1 || first > 36 || second < 1 || second > 36 || first === second
  ) {
    throw new Error("スプリットは異なる二つの1〜36の数字を指定してください。");
  }
}

export function calculateRoulettePayout(bet: RouletteBet, result: number): number {
  if (!Number.isInteger(result) || result < 0 || result > 36) {
    throw new Error("結果は0〜36の整数で指定してください。");
  }
  if (result === 0) return 0;

  switch (bet.kind) {
    case "red":
      return RED_NUMBERS.has(result) ? bet.amount * 2 : 0;
    case "black":
      return !RED_NUMBERS.has(result) ? bet.amount * 2 : 0;
    case "even":
      return result % 2 === 0 ? bet.amount * 2 : 0;
    case "odd":
      return result % 2 === 1 ? bet.amount * 2 : 0;
    case "dozen": {
      const [from, to] = bet.selection.split("-").map(Number);
      return result >= from && result <= to ? bet.amount * 3 : 0;
    }
    case "straight":
      return Number(bet.selection) === result ? bet.amount * 36 : 0;
    case "split":
      return bet.selection.split("-").map(Number).includes(result)
        ? bet.amount * 18
        : 0;
  }
}
