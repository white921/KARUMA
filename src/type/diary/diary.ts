import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { RowDataPacket } from "mysql2";
import type { DIARY_TYPE } from "../../constant/diary/diary";

export type DiaryRow = RowDataPacket & {
  id: number;
  thread_id: string;
  creator_user_id: string;
  type: DiaryType;
  is_private: number;
  is_active: number;
};

export type DiaryType = (typeof DIARY_TYPE)[keyof typeof DIARY_TYPE];

export type DiaryExecutionInteraction = ModalSubmitInteraction | ButtonInteraction;

export type PendingDiaryAction = {
  commandId: string;
  title: string;
  body: string;
  createdAt: number;
};
