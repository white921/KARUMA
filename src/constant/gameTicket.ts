export const GAME_FREE_TICKET_TYPE = {
  SHORT: "SHORT",
} as const;

export type GameFreeTicketType =
  (typeof GAME_FREE_TICKET_TYPE)[keyof typeof GAME_FREE_TICKET_TYPE];
