import type { GAME_FREE_TICKET_TYPE } from "../constant/gameTicket";

export type GameFreeTicketType =
  (typeof GAME_FREE_TICKET_TYPE)[keyof typeof GAME_FREE_TICKET_TYPE];
