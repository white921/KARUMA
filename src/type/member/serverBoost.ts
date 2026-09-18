import type { RowDataPacket } from "mysql2";

export type BoostAccountRow = RowDataPacket & {
  user_id: string;
  wallet: number;
  boost_count: number;
};

export type ServerBoostReward = {
  amount: number;
  boostCount: number;
  comment: string;
};
