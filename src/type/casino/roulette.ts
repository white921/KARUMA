import type { RowDataPacket } from "mysql2";

export type RouletteStage = 1 | 2 | 3;

export type RouletteBetKind =
  | "red"
  | "black"
  | "even"
  | "odd"
  | "dozen"
  | "straight"
  | "split";

export type RouletteBet = {
  kind: RouletteBetKind;
  selection: string;
  amount: number;
};

export type RouletteRoundRow = RowDataPacket & {
  id: number;
  stage: RouletteStage;
  status: "open" | "closed" | "settled";
};

export type RouletteBetRow = RowDataPacket & {
  id: number;
  user_id: string;
  bet_kind: RouletteBetKind;
  selection: string;
  amount: number;
};

export type RouletteBonusBatchRow = RowDataPacket & {
  id: number;
  last_round_id: number;
};

export type AccountRow = RowDataPacket & { wallet: number };

export type RouletteSettlement = {
  roundId: number;
  roundNumber: number;
  stage: RouletteStage;
  result: number;
  winners: Array<{ userId: string; payout: number; bet: RouletteBet }>;
  betCount: number;
};
