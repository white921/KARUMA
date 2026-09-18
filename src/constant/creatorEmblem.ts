import type { EmblemProduct } from "../type/creatorEmblemPayment";

/** 夢印工房の受付を再開するまで false を維持する。 */
export const CREATOR_EMBLEM_ENABLED = false;

export const PRODUCTS: Record<EmblemProduct, { label: string; apostlePrice: number; memberPrice?: number }> = {
  personal: { label: "個人紋章", apostlePrice: 60_000, memberPrice: 100_000 },
  large: { label: "デカ紋章", apostlePrice: 150_000 },
};

export const CREATOR_EMBLEM_PRODUCT_SELECT_ID = "creatorEmblemProductSelect";
export const CREATOR_EMBLEM_CREATOR_SELECT_PREFIX = "creatorEmblemCreatorSelect";
export const CREATOR_EMBLEM_CONFIRM_PREFIX = "creatorEmblemConfirm";
