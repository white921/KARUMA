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
