import type { RowDataPacket } from "mysql2";

export type ManagedVcRow = RowDataPacket & {
  owner_id: string;
  type: string;
};
