export const SHOP_TICKET_TYPE = {
  DISCOUNT_5: "DISCOUNT_5",
  DISCOUNT_10: "DISCOUNT_10",
} as const;

export type ShopTicketType =
  (typeof SHOP_TICKET_TYPE)[keyof typeof SHOP_TICKET_TYPE];

export const SHOP_TICKET_NONE = "none";

export type ShopTicket = {
  type: ShopTicketType;
  label: string;
  discountRate: number;
};

export const SHOP_TICKETS: readonly ShopTicket[] = [
  {
    type: SHOP_TICKET_TYPE.DISCOUNT_5,
    label: "ショップ割引 5%OFF",
    discountRate: 5,
  },
  {
    type: SHOP_TICKET_TYPE.DISCOUNT_10,
    label: "ショップ割引 10%OFF",
    discountRate: 10,
  },
];

export const SHOP_TICKET_MAX_APPLICABLE_AMOUNT = 1_000_000;

export function isShopTicketType(value: string): value is ShopTicketType {
  return SHOP_TICKETS.some((ticket) => ticket.type === value);
}

export function getShopTicket(type: ShopTicketType): ShopTicket {
  const ticket = SHOP_TICKETS.find((candidate) => candidate.type === type);
  if (!ticket) {
    throw new Error("無効なショップチケットです。");
  }
  return ticket;
}

export function calculateShopTicketDiscount(
  amount: number,
  ticketType: ShopTicketType,
): { discountAmount: number; paymentAmount: number } {
  const ticket = getShopTicket(ticketType);
  const discountAmount = Math.floor((amount * ticket.discountRate) / 100);
  return { discountAmount, paymentAmount: amount - discountAmount };
}
