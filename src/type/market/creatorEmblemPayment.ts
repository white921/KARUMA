import type { RowDataPacket } from "mysql2";

export type EmblemProduct = "personal" | "large";
export type EmblemPricingTier = "noble" | "knight";

export type EmblemProductDefinition = {
  label: string;
  prices: Partial<Record<EmblemPricingTier, number>>;
};

export type EmblemPaymentDetails = {
  payerId: string;
  avatarUrl: string;
  product: EmblemProduct;
  amount: number;
  pricingTier: EmblemPricingTier;
  roleIds: string[];
  confirmationId: string;
};

export type EmblemPaymentActionRow = RowDataPacket & { id: number };
