import { HOTEL_PRICE, HOTEL_TYPE, HOTEL_TYPE_NAMES } from "./hotel";
import { ITEM_KEY } from "../inventory/item";

export const PRIVATE_HOTEL_PREFIX = "privateHotel:";
export const PRIVATE_HOTEL_TITLE = "VIP・フリーダムホテル";
export type PrivateHotelKind = "vip" | "freedom";
export type PrivateHotelHours = 12 | 24;

export function getPrivateHotelPlan(kind: PrivateHotelKind, hours: PrivateHotelHours) {
  const type = kind === "vip"
    ? hours === 12 ? HOTEL_TYPE.SECRET : HOTEL_TYPE.SECRETLONG
    : hours === 12 ? HOTEL_TYPE.FREEDOM : HOTEL_TYPE.FREEDOMLONG;
  const key = type as keyof typeof HOTEL_PRICE;
  return {
    type,
    name: HOTEL_TYPE_NAMES[key],
    price: HOTEL_PRICE[key],
    hours,
    ticketCount: hours === 12 ? 1 : 2,
    itemKey: kind === "vip" ? ITEM_KEY.HOTEL_SECRET_FREE : ITEM_KEY.HOTEL_FREEDOM_FREE,
  };
}

export function resolvePrivateHotelPayment(quantity: number, required: number): "ticket" | "money" {
  return quantity >= required ? "ticket" : "money";
}
