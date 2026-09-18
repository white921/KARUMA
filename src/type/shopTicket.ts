import type { SHOP_TICKET_TYPE } from "../constant/shopTicket";

export type ShopTicketType =
  (typeof SHOP_TICKET_TYPE)[keyof typeof SHOP_TICKET_TYPE];

export type ShopTicket = {
  type: ShopTicketType;
  label: string;
  discountRate: number;
};

export type OwnedShopTicket = {
  type: ShopTicketType;
  quantity: number;
};
