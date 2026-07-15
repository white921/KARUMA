import {
  Client,
  Collection,
  Message,
  ThreadChannel,
} from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { DbService } from "./dbService";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import {
  EvaluationSheetArchiveRecord,
  EvaluationSheetThreadRecord,
} from "../type/evaluationSheetArchive";

interface SessionRow extends RowDataPacket {
  id: number;
  user_id: string;
  status: "active" | "saved" | "deleted";
}

interface ThreadRow extends RowDataPacket {
  forum_id: string;
  thread_id: string;
}

interface ArchiveRow extends RowDataPacket {
  transcript_html: string;
  message_count: number;
  archived_at: Date;
  source_thread_id: string;
}

export class EvaluationSheetArchiveService {
  static async attachLatestArchiveToThread(
    userId: string,
    thread: ThreadChannel,
  ): Promise<boolean> {
    const forumId = thread.parentId;
    if (!forumId) {
      return false;
    }
    const archive = await this.getLatestArchiveForForum(userId, forumId);
    if (!archive) {
      return false;
    }
    await thread.send({
      content: `📄 <@${userId}> の過去評価を添付します。`,
      files: [
        {
          attachment: Buffer.from(archive.html, "utf8"),
          name: this.createArchiveFileName(userId),
        },
      ],
    });
    return true;
  }

  static createArchiveFileName(userId: string): string {
    return `past-evaluation-${userId}.html`;
  }

  static async registerActiveSheets(
    userId: string,
    createdByUserId: string,
    threads: EvaluationSheetThreadRecord[],
  ): Promise<void> {
    if (threads.length !== 2 || new Set(threads.map((thread) => thread.forumId)).size !== 2) {
      throw new Error(EVALUATION_SHEET_MESSAGES.CREATE_EVALUATION_SHEET_ERROR);
    }

    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [activeSessions] = await connection.execute<SessionRow[]>(
        `SELECT id FROM evaluation_sheet_sessions
         WHERE user_id = ? AND status IN ('active', 'saved')
         FOR UPDATE`,
        [userId],
      );
      if (activeSessions.length > 0) {
        throw new Error(EVALUATION_SHEET_MESSAGES.ACTIVE_SHEET_ALREADY_EXISTS);
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO evaluation_sheet_sessions (user_id, created_by_user_id, status)
         VALUES (?, ?, 'active')`,
        [userId, createdByUserId],
      );

      for (const thread of threads) {
        await connection.execute(
          `INSERT INTO evaluation_sheet_threads (session_id, forum_id, thread_id)
           VALUES (?, ?, ?)`,
          [result.insertId, thread.forumId, thread.threadId],
        );
        await connection.execute(
          `INSERT INTO evaluation_sheet_current_threads
           (user_id, forum_id, thread_id, session_id, status)
           VALUES (?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE
             thread_id = VALUES(thread_id),
             session_id = VALUES(session_id),
             status = 'active',
             updated_at = CURRENT_TIMESTAMP`,
          [userId, thread.forumId, thread.threadId, result.insertId],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async saveAndDelete(
    client: Client,
    userId: string,
    operatorId: string,
    reason: string | null,
  ): Promise<{ savedCount: number; deletedCount: number; pendingDeletionCount: number }> {
    const session = await this.findLatestOpenSession(userId);
    if (!session) {
      throw new Error(EVALUATION_SHEET_MESSAGES.ACTIVE_SHEET_NOT_FOUND);
    }
    const threads = await this.getCurrentThreads(userId, session.id);
    if (threads.length !== 2) {
      throw new Error(EVALUATION_SHEET_MESSAGES.ACTIVE_SHEET_NOT_FOUND);
    }

    let savedCount = 0;
    if (session.status === "active") {
      const archives: Array<EvaluationSheetArchiveRecord & { forumId: string }> = [];
      for (const thread of threads) {
        const channel = await client.channels.fetch(thread.threadId);
        if (!channel || !channel.isThread()) {
          throw new Error(`❌ 評価スレッドを取得できませんでした。(${thread.threadId})`);
        }
        const messages = await this.fetchAllMessages(channel);
        archives.push({
          forumId: thread.forumId,
          sourceThreadId: thread.threadId,
          messageCount: messages.length,
          archivedAt: new Date(),
          html: this.createTranscriptHtml(userId, channel.name, messages),
        });
      }
      await this.storeArchives(session.id, userId, operatorId, reason, archives);
      savedCount = archives.length;
    }

    let deletedCount = 0;
    for (const thread of threads) {
      const channel = await client.channels.fetch(thread.threadId).catch(() => null);
      if (!channel) {
        deletedCount++;
        continue;
      }
      if (!channel.isThread()) {
        throw new Error(`❌ 評価スレッドの形式が不正です。(${thread.threadId})`);
      }
      await channel.delete(`評価シートを保存して削除: ${operatorId}`);
      deletedCount++;
    }

    if (deletedCount === threads.length) {
      await this.markDeleted(userId, session.id);
    }
    return {
      savedCount,
      deletedCount,
      pendingDeletionCount: threads.length - deletedCount,
    };
  }

  static async getLatestArchiveForForum(
    userId: string,
    forumId: string,
  ): Promise<EvaluationSheetArchiveRecord | null> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<ArchiveRow[]>(
        `SELECT archive.transcript_html, archive.message_count, archive.archived_at,
                archive.source_thread_id
         FROM evaluation_sheet_archives archive
         INNER JOIN evaluation_sheet_sessions session ON session.id = archive.session_id
         WHERE archive.user_id = ? AND archive.forum_id = ? AND session.status = 'deleted'
         ORDER BY archive.archived_at DESC
         LIMIT 1`,
        [userId, forumId],
      );
      if (rows.length === 0) {
        return null;
      }
      return {
        html: rows[0].transcript_html,
        messageCount: rows[0].message_count,
        archivedAt: rows[0].archived_at,
        sourceThreadId: rows[0].source_thread_id,
      };
    } finally {
      connection.release();
    }
  }

  static async fetchAllMessages(thread: ThreadChannel): Promise<Message[]> {
    const allMessages: Message[] = [];
    let before: string | undefined;
    while (true) {
      const batch: Collection<string, Message> = await thread.messages.fetch({
        limit: 100,
        before,
      });
      if (batch.size === 0) {
        break;
      }
      allMessages.push(...batch.values());
      before = batch.last()?.id;
    }
    return allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  }

  static createTranscriptHtml(
    userId: string,
    threadName: string,
    messages: Message[],
  ): string {
    const entries = messages.map((message) => this.createMessageHtml(message)).join("\n");
    return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${this.escapeHtml(threadName)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:900px;margin:32px auto;padding:0 16px;background:#f5f6f8;color:#202124}h1{font-size:22px;margin-bottom:6px}.meta{color:#6b7280;font-size:13px}article{background:#fff;border:1px solid #e2e5e9;border-radius:10px;margin:12px 0;padding:14px}header{display:flex;gap:10px;align-items:center}.avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#e5e7eb}.author{display:flex;flex-direction:column;gap:2px;min-width:0}.author strong{font-size:14px}.author span,time{color:#6b7280;font-size:12px}time{margin-left:auto;text-align:right}.content{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0;line-height:1.55}.attachments{margin:8px 0 0;padding-left:20px}</style>
</head><body><h1>${this.escapeHtml(threadName)}</h1><p class="meta">対象ユーザーID: ${this.escapeHtml(userId)}<br>保存日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>${entries || "<p>メッセージはありません。</p>"}</body></html>`;
  }

  private static async findLatestOpenSession(userId: string): Promise<SessionRow | null> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<SessionRow[]>(
        `SELECT id, user_id, status FROM evaluation_sheet_sessions
         WHERE user_id = ? AND status IN ('active', 'saved')
         ORDER BY id DESC LIMIT 1`,
        [userId],
      );
      return rows[0] ?? null;
    } finally {
      connection.release();
    }
  }

  private static async getCurrentThreads(
    userId: string,
    sessionId: number,
  ): Promise<EvaluationSheetThreadRecord[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<ThreadRow[]>(
        `SELECT forum_id, thread_id FROM evaluation_sheet_current_threads
         WHERE user_id = ? AND session_id = ? AND status = 'active'
         ORDER BY forum_id`,
        [userId, sessionId],
      );
      return rows.map((row) => ({ forumId: row.forum_id, threadId: row.thread_id }));
    } finally {
      connection.release();
    }
  }

  private static async storeArchives(
    sessionId: number,
    userId: string,
    operatorId: string,
    reason: string | null,
    archives: Array<EvaluationSheetArchiveRecord & { forumId: string }>,
  ): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      for (const archive of archives) {
        await connection.execute(
          `INSERT INTO evaluation_sheet_archives
           (session_id, user_id, forum_id, source_thread_id, transcript_html, message_count)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sessionId, userId, archive.forumId, archive.sourceThreadId, archive.html, archive.messageCount],
        );
      }
      await connection.execute(
        `UPDATE evaluation_sheet_sessions
         SET status = 'saved', saved_by_user_id = ?, saved_reason = ?, saved_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'active'`,
        [operatorId, reason, sessionId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static async markDeleted(userId: string, sessionId: number): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE evaluation_sheet_sessions
         SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'saved'`,
        [sessionId],
      );
      await connection.execute(
        `UPDATE evaluation_sheet_current_threads
         SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND session_id = ? AND status = 'active'`,
        [userId, sessionId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static createMessageHtml(message: Message): string {
    const displayName = this.escapeHtml(
      message.member?.displayName ??
        message.author.globalName ??
        message.author.username,
    );
    const username = this.escapeHtml(`@${message.author.username}`);
    const avatarUrl = this.escapeHtml(
      message.author.displayAvatarURL({ extension: "png", size: 128 }),
    );
    const time = this.escapeHtml(new Date(message.createdTimestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
    const contentParts = [message.content, ...message.embeds.map((embed) => [embed.title, embed.description, ...(embed.fields?.map((field) => `${field.name}: ${field.value}`) ?? [])].filter(Boolean).join("\n"))].filter(Boolean);
    const attachments = [...message.attachments.values()].map((attachment) =>
      `<li><a href="${this.escapeHtml(attachment.url)}">${this.escapeHtml(attachment.name ?? attachment.url)}</a></li>`,
    ).join("");
    return `<article><header><img class="avatar" src="${avatarUrl}" alt=""><div class="author"><strong>${displayName}</strong><span>${username}</span></div><time>${time}</time></header><div class="content">${this.escapeHtml(contentParts.join("\n\n") || "（本文なし）")}</div>${attachments ? `<ul class="attachments">${attachments}</ul>` : ""}</article>`;
  }

  private static escapeHtml(value: string): string {
    return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] ?? char));
  }
}
