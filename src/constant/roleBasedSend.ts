import { formatNumber } from "../util/number";
import { CURRENCY_NAMES } from "./currency";

export const ROLE_BASED_SEND_MESSAGES = {
  NO_PERMISSION:
    "あなたは執行官、創造主、技術統括のいずれの権限も持っていません。",
  ROLE_NOT_FOUND: "指定されたロールが見つかりません。",
  NO_TARGETS: "指定ロールを持つ対象ユーザーがいません。",
  NOT_ENOUGH_BALANCE: (requiredAmount: number, currentWallet: number) =>
    `残高が不足しています。\n必要額: ${formatNumber(requiredAmount)}${CURRENCY_NAMES}\n現在の残高: ${formatNumber(currentWallet)}${CURRENCY_NAMES}`,
};
