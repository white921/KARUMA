import type { RowDataPacket } from "mysql2/promise";

export type AccountRow = RowDataPacket & { user_id: string };

export type InvitePointBalanceRow = RowDataPacket & { points: number };
