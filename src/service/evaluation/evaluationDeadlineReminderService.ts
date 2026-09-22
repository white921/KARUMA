import { createHash } from "node:crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ChannelType, Client, Guild, PermissionFlagsBits, TextChannel } from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import { EVALUATION_SHEET_FORUM_IDS } from "../../constant/evaluation/evaluationSheet";
import { ROLE_IDS, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { DbService } from "../system/dbService";

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = "Asia/Tokyo";
export const EVALUATION_REMINDER_CRON = "*/5 23 * * *";

type CurrentSheet = { userId: string; forumId: string; threadId: string };
type SheetThread = { id: string; parentId: string | null; name: string; createdTimestamp: number | null };
export type ReminderTargets = { twoDays: string[]; oneDay: string[] };
type ReminderPage = { content: string; users: string[]; roles: string[] };
type DeliveryRow = RowDataPacket & { pages: string | ReminderPage[]; message_ids: string | string[]; completed: number };

export function reminderDate(now: Date): string | null {
  const local = dayjs(now).tz(TZ);
  return local.hour() === 23 ? local.format("YYYY-MM-DD") : null;
}

/** 同名ユーザーではなくDBのユーザーIDで集約。アーカイブ状態は判定に使わない。 */
export function selectReminderTargets(
  date: string, sheets: CurrentSheet[], threads: Map<string, SheetThread>, travelers: Set<string>,
) {
  const today = dayjs.tz(date, TZ).startOf("day");
  const targets: ReminderTargets = { twoDays: [], oneDay: [] };
  const issues: { userId: string; reason: string }[] = [];
  const grouped = new Map<string, CurrentSheet[]>();
  for (const sheet of sheets) {
    if (!travelers.has(sheet.userId)) continue;
    const group = grouped.get(sheet.userId) ?? [];
    group.push(sheet);
    grouped.set(sheet.userId, group);
  }
  for (const [userId, group] of grouped) {
    if (group.length !== EVALUATION_SHEET_FORUM_IDS.length ||
      !EVALUATION_SHEET_FORUM_IDS.every(id => group.filter(s => s.forumId === id).length === 1)) {
      issues.push({ userId, reason: "現在の4フォーラムの対応が不完全" });
      continue;
    }
    const dates: string[] = [];
    let issue: string | undefined;
    for (const sheet of group) {
      const thread = threads.get(sheet.threadId);
      if (!thread || thread.parentId !== sheet.forumId) {
        issue = `現在のスレッドが取得できないか親フォーラムが異なります: ${sheet.threadId}`;
        break;
      }
      const match = thread.name.match(/[〜～]\s*(\d{1,2})\/(\d{1,2})\s*$/);
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) < 1 ||
        Number(match[2]) > new Date(Date.UTC(2000, Number(match[1]), 0)).getUTCDate()) {
        issue = `スレッド名の期限形式が不正です: ${thread.name}`;
        break;
      }
      const mmdd = `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
      // 月日しか保存されていないため、1年以上前のスレッドを翌年の期限と誤認しない。
      if (!thread.createdTimestamp || today.diff(dayjs(thread.createdTimestamp).tz(TZ).startOf("day"), "day") >= 365) {
        issue = `作成から365日以上経過、または作成日時不明です: ${sheet.threadId}`;
        break;
      }
      dates.push(mmdd);
    }
    if (issue || new Set(dates).size !== 1) {
      issues.push({ userId, reason: issue ?? `4フォーラムで期限が一致しません: ${dates.join(", ")}` });
      continue;
    }
    if (dates[0] === today.add(2, "day").format("MM/DD")) targets.twoDays.push(userId);
    else if (dates[0] === today.add(1, "day").format("MM/DD")) targets.oneDay.push(userId);
  }
  targets.twoDays.sort();
  targets.oneDay.sort();
  return { ...targets, issues };
}

/** 通常は1投稿。2000文字を超えた場合のみ見出しを付けて分割し、ロール通知は最初だけ。 */
export function buildReminderPages(date: string, targets: ReminderTargets): ReminderPage[] {
  if (!targets.twoDays.length && !targets.oneDay.length) return [];
  const label = `${dayjs.tz(date, TZ).format("M月D日")} 期限直前旅人一覧`;
  const notificationRoles = [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT];
  const pages: ReminderPage[] = [];
  let page: ReminderPage = {
    content: `${notificationRoles.map(roleId => `<@&${roleId}>`).join("\n")}\n${label}`,
    users: [], roles: notificationRoles,
  };
  for (const [heading, users] of [["2日前", targets.twoDays], ["1日前", targets.oneDay]] as const) {
    const lines = users.length ? users : [null];
    for (let i = 0; i < lines.length; i++) {
      const userId = lines[i];
      const line = userId ? `<@${userId}>` : "該当者なし";
      const addition = `${i === 0 ? `\n\n${heading}` : ""}\n${line}`;
      if (page.content.length + addition.length > 2000 || (userId && page.users.length >= 100)) {
        pages.push(page);
        page = { content: `${label}（続き）\n\n${heading}\n${line}`, users: [], roles: [] };
      } else page.content += addition;
      if (userId) page.users.push(userId);
    }
  }
  pages.push(page);
  return pages;
}

export class EvaluationDeadlineReminderService {
  private static running = false;

  /** APIによる読み取りのみ。dry runでもこの経路で対象者と本文を確認できる。 */
  static async preview(client: Client, date: string) {
    const guild = await client.guilds.fetch(process.env.GUILD_ID!);
    // ロール情報も更新し、キャッシュに残った退会者や旧ロールで判定しない。
    await guild.roles.fetch();
    const travelers = new Set<string>();
    let after: string | undefined;
    while (true) {
      const batch = await guild.members.list({ limit: 1000, after, cache: false });
      for (const member of batch.values()) {
        if (!member.user.bot && member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN)) travelers.add(member.id);
      }
      if (batch.size < 1000) break;
      after = batch.lastKey();
    }
    const connection = await DbService.getConnection();
    let sheets: CurrentSheet[];
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT c.user_id, c.forum_id, c.thread_id FROM evaluation_sheet_current_threads c
         JOIN evaluation_sheet_sessions s ON s.id = c.session_id
         WHERE c.status = 'active' AND s.status = 'active'`,
      );
      sheets = rows.map(r => ({ userId: String(r.user_id), forumId: String(r.forum_id), threadId: String(r.thread_id) }));
    } finally { connection.release(); }
    const threads = await this.fetchThreads(guild);
    const targets = selectReminderTargets(date, sheets, threads, travelers);
    return { ...targets, pages: buildReminderPages(date, targets) };
  }

  static async fetchThreads(guild: Guild): Promise<Map<string, SheetThread>> {
    const threads = new Map<string, SheetThread>();
    const active = await guild.channels.fetchActiveThreads(false);
    for (const thread of active.threads.values()) threads.set(thread.id, thread);
    for (const forumId of EVALUATION_SHEET_FORUM_IDS) {
      const forum = await guild.channels.fetch(forumId, { force: true });
      if (forum?.type !== ChannelType.GuildForum) throw new Error(`評価フォーラムを取得できません: ${forumId}`);
      let before: Date | undefined;
      while (true) {
        const batch = await forum.threads.fetchArchived({ type: "public", limit: 100, before }, false);
        for (const thread of batch.threads.values()) threads.set(thread.id, thread);
        if (!batch.hasMore) break;
        const timestamp = batch.threads.last()?.archiveTimestamp;
        if (!timestamp || (before && timestamp >= before.getTime())) throw new Error("アーカイブ一覧のページ送りに失敗");
        before = new Date(timestamp);
      }
    }
    return threads;
  }

  static async getDestination(client: Client): Promise<TextChannel> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE, { force: true });
    if (channel?.type !== ChannelType.GuildText || channel.guildId !== process.env.GUILD_ID) {
      throw new Error("評価期限通知の送信先が不正です");
    }
    await channel.guild.roles.fetch();
    const me = await channel.guild.members.fetchMe({ force: true });
    const permissions = channel.permissionsFor(me);
    const notificationRoles = [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT]
      .map(roleId => channel.guild.roles.cache.get(roleId));
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]) ||
      notificationRoles.some(role => !role) ||
      (notificationRoles.some(role => !role!.mentionable) && !permissions.has(PermissionFlagsBits.MentionEveryone))) {
      throw new Error("評価期限通知の送信・履歴取得・判定官・侍従メンション権限が不足しています");
    }
    return channel;
  }

  /** 送信成功後のDB更新失敗にも備え、23時以降のBot投稿を読み戻す。 */
  static async findDeliveredPages(channel: TextChannel, date: string, pages: ReminderPage[]) {
    const since = dayjs.tz(`${date} 23:00`, TZ).valueOf();
    const found = new Map<number, string>();
    let before: string | undefined;
    while (true) {
      const messages = await channel.messages.fetch({ limit: 100, before, cache: false });
      for (const message of messages.values()) {
        if (message.createdTimestamp < since || message.author.id !== channel.client.user!.id) continue;
        const index = pages.findIndex(page => page.content === message.content);
        if (index !== -1) found.set(index, message.id);
      }
      const last = messages.last();
      if (messages.size < 100 || !last || last.createdTimestamp < since) break;
      before = last.id;
    }
    return found;
  }

  static async run(client: Client, now = new Date()) {
    const date = reminderDate(now);
    if (!date) return;
    const guildId = process.env.GUILD_ID!;
    const connection = await DbService.getConnection();
    const lock = `evaluation-reminder:${guildId}:${date}`;
    let locked = false;
    try {
      const [locks] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS acquired", [lock]);
      locked = Number(locks[0].acquired) === 1;
      if (!locked) return;
      const [rows] = await connection.execute<DeliveryRow[]>(
        "SELECT pages, message_ids, completed FROM evaluation_deadline_reminders WHERE guild_id = ? AND notice_date = ?",
        [guildId, date],
      );
      let row = rows[0];
      if (row?.completed) return;
      const channel = await this.getDestination(client);
      if (!row) {
        const preview = await this.preview(client, date);
        if (preview.issues.length) console.warn("[EvaluationReminder] 要確認の評価シート", preview.issues);
        await connection.execute(
          "INSERT INTO evaluation_deadline_reminders (guild_id, notice_date, pages, message_ids) VALUES (?, ?, ?, '[]')",
          [guildId, date, JSON.stringify(preview.pages)],
        );
        row = { pages: preview.pages, message_ids: [], completed: 0 } as unknown as DeliveryRow;
      }
      const pages: ReminderPage[] = typeof row.pages === "string" ? JSON.parse(row.pages) : row.pages;
      const ids: string[] = typeof row.message_ids === "string" ? JSON.parse(row.message_ids) : row.message_ids;
      const found = pages.length ? await this.findDeliveredPages(channel, date, pages) : new Map<number, string>();
      for (let i = 0; i < pages.length; i++) {
        if (ids[i]) continue;
        const page = pages[i];
        ids[i] = found.get(i) ?? (await channel.send({
          content: page.content,
          allowedMentions: { parse: [], roles: page.roles, users: page.users },
          nonce: createHash("sha256").update(`${guildId}:${date}:${i}`).digest("hex").slice(0, 25),
          enforceNonce: true,
        })).id;
        await connection.execute(
          "UPDATE evaluation_deadline_reminders SET message_ids = ? WHERE guild_id = ? AND notice_date = ?",
          [JSON.stringify(ids), guildId, date],
        );
      }
      await connection.execute(
        "UPDATE evaluation_deadline_reminders SET completed = 1 WHERE guild_id = ? AND notice_date = ?", [guildId, date],
      );
      console.info("[EvaluationReminder] 当日分完了", { date, messages: ids.length });
    } finally {
      try { if (locked) await connection.execute("SELECT RELEASE_LOCK(?)", [lock]); }
      finally { connection.release(); }
    }
  }

  static async runScheduled(client: Client) {
    if (this.running) return;
    this.running = true;
    try { await this.run(client); }
    catch (error) { console.error("[EvaluationReminder] 通知失敗、23時台に再試行", error); }
    finally { this.running = false; }
  }
}
