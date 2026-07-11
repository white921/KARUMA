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
