export const GAME_FREE_TICKET_TYPE = {
  VC_CREATE: "VC_CREATE",
} as const;

export type GameFreeTicketType =
  (typeof GAME_FREE_TICKET_TYPE)[keyof typeof GAME_FREE_TICKET_TYPE];
