import type { HOTEL_FREE_TICKET_TYPE } from "../../constant/hotel/hotel";

export type HotelFreeTicketType =
  (typeof HOTEL_FREE_TICKET_TYPE)[keyof typeof HOTEL_FREE_TICKET_TYPE];
