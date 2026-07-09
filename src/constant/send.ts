import { formatNumber } from "../util/number";
import { CURRENCY_NAMES } from "./currency";

export const MONTHLY_SEND_LIMIT = 500000;

export const SEND_MESSAGES = {
  SAME_USER: "送金元と送金先が同じです。",
  NOT_FOUND_USER: "指定されたユーザーの口座が見つかりません。",
  NOT_ENOUGH_BALANCE: "残高が不足しています。",
  SUCCESS: "送金が完了しました。",
  SUCCESS_TO_USER: (
    toUserId: string,
    amount: number,
    currencyName: string,
    comment = "",
  ) =>
    `✅ <@${toUserId}> に ${formatNumber(amount)}${currencyName}送金しました！${
      comment ? `\n備考: ${comment}` : ""
    }`,
  DO_NOT_SEND_TO_SUB_ACCOUNT: "サブアカウントには送金できません。",
  INVALID_AMOUNT: "送金額が0以下です。",
  IS_NOT_INT: "金額は1以上の整数で入力してください。",
  MONTHLY_LIMIT_EXCEEDED: (currentAmount: number, limit: number) =>
    `同じ相手への月間送金上限は ${formatNumber(limit)} ${CURRENCY_NAMES} です。\n現在の当月送金額: ${formatNumber(currentAmount)} ${CURRENCY_NAMES}`,
};
