export type EvaluationSheetSessionStatus = "active" | "saved" | "deleted";

export interface EvaluationSheetThreadRecord {
  forumId: string;
  threadId: string;
}

export interface EvaluationSheetArchiveRecord {
  html: string;
  messageCount: number;
  archivedAt: Date;
  sourceThreadId: string;
}
