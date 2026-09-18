import type { RowDataPacket } from "mysql2";

export type EvaluationSheetSessionStatus = "active" | "saved" | "deleted";

export interface EvaluationSheetThreadRecord {
  forumId: string;
  threadId: string;
}

export interface EvaluationSheetArchiveRecord {
  archiveId?: number;
  html: string;
  messageCount: number;
  archivedAt: Date;
  sourceThreadId: string;
}

export interface EvaluationArchiveR2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export interface SessionRow extends RowDataPacket {
  id: number;
  user_id: string;
  status: "active" | "saved" | "deleted";
}

export interface ThreadRow extends RowDataPacket {
  forum_id: string;
  thread_id: string;
}

export interface ArchiveRow extends RowDataPacket {
  id: number;
  transcript_html: string;
  message_count: number;
  archived_at: Date;
  source_thread_id: string;
}
