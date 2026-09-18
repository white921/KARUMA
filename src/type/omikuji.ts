import type { RowDataPacket } from "mysql2";

export type OmikujiPrize = {
  fortune: "小吉" | "中吉" | "大吉" | "凶" | "超大吉";
  amount: number;
  probability: number;
};

export type WalletRow = RowDataPacket & { wallet: number };
