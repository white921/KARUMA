import type { RowDataPacket } from "mysql2";

export type GameVcPayment = "money" | "ticket" | "pass" | "staff";

export type GamePassPlan = "twoWeeks" | "oneMonth";

export type GameVcTier = {
  label: string;
  price: number;
};

export type WalletRow = RowDataPacket & { wallet: number };

export type PassRow = RowDataPacket & { expire_at: Date | null; is_deleted: number };
