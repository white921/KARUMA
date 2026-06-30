import { RowDataPacket } from "mysql2";
import { DiaryType } from "../constant/diary";

export type DiaryRow = RowDataPacket & {
  id: number;
  thread_id: string;
  creator_user_id: string;
  type: DiaryType;
  is_private: number;
  is_active: number;
};