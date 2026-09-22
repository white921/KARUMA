import { ROLE_IDS } from "../shared/id";

export const DARK_MESSAGE_PREFIX = "darkMessage";
export const DARK_MESSAGE_PRICE = 20_000;
export const DARK_DISCLOSURE_PREFIX = "darkDisclosure";
export const DARK_MESSAGE_CLOSE_PREFIX = "darkClose";
export const DARK_DISCLOSURE_PRICE = 35_000;
export const DARK_MESSAGE_MAX_AUDIO_BYTES = 10_000_000;
export const DARK_MESSAGE_OPERATOR_ROLES = [
  ROLE_IDS.DARK_SHOP_LEADER, ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI, ROLE_IDS.GIJUTU_LEADER,
] as const;
export const DARK_MESSAGE_PRODUCTS = {
  letter: { title: "闇手紙", command: "闇手紙パネル" },
  whisper: { title: "悪魔の囁き", command: "悪魔ささやきパネル" },
} as const;
export type DarkMessageKind = keyof typeof DARK_MESSAGE_PRODUCTS;
