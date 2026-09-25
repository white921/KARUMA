import type { RowDataPacket } from "mysql2";

export type SolitaryCellTier = {
  label: string;
  price: number;
};

export type WalletRow = RowDataPacket & { wallet: number };

export type SolitaryCellConfirmation = {
  userId: string;
  guildId: string | null;
  channelId: string;
  expiresAt: number;
  tier: SolitaryCellTier;
  useTicket: boolean;
};
