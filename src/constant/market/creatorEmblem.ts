import { ROLE_IDS } from "../shared/id";
import type { EmblemPricingTier, EmblemProduct, EmblemProductDefinition } from "../../type/market/creatorEmblemPayment";

export const CREATOR_EMBLEM_ENABLED = true;
export const CREATOR_EMBLEM_RECIPIENT_ID = "1400304116152139837";

export const CREATOR_EMBLEM_PRICING_ROLES: Record<EmblemPricingTier, { id: string; label: string }> = {
  noble: { id: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, label: "貴族" },
  knight: { id: ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN, label: "騎士" },
};

export const CREATOR_EMBLEM_NOBLE_PRICING_ROLES = [
  CREATOR_EMBLEM_PRICING_ROLES.noble,
  { id: ROLE_IDS.KANRISYA, label: "英傑" },
  { id: ROLE_IDS.SABANUSI, label: "皇帝" },
];

export const PRODUCTS: Record<EmblemProduct, EmblemProductDefinition> = {
  personal: { label: "個人紋章", prices: { noble: 60_000, knight: 100_000 } },
  large: { label: "デカ紋章", prices: { noble: 200_000 } },
};

export const CREATOR_EMBLEM_PRODUCT_SELECT_ID = "creatorEmblemProductSelect";
export const CREATOR_EMBLEM_CONFIRM_PREFIX = "creatorEmblemConfirm";
export const CREATOR_EMBLEM_CANCEL_ID = "creatorEmblemCancel";
