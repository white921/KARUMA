import type { RowDataPacket } from "mysql2";

export type SolitaryCellTier = {
  label: string;
  price: number;
};

export type WalletRow = RowDataPacket & { wallet: number };
