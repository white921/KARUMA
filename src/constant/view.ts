import { CURRENCY_NAMES } from "./currency";
import { formatNumber } from "../util/number";

export const VIEW_MESSAGES = {
  BALANCE: (wallet: number) =>
    `残高確認\nあなたの残高は${formatNumber(wallet)}${CURRENCY_NAMES}です。`,
  BALANCE_OF_USER: (userId: string, wallet: number) =>
    `残高確認\n<@${userId}>の残高は **${formatNumber(wallet)}** ${CURRENCY_NAMES} です。`,
};
