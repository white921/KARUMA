import { createHash } from "node:crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  Guild,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ThreadChannel,
} from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import { EVALUATION_SHEET_FORUM_IDS } from "../../constant/evaluation/evaluationSheet";
import { ROLE_IDS, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { DbService } from "../system/dbService";

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = "Asia/Tokyo";
export const EVALUATION_REMINDER_CRON = "*/5 23 * * *";
export const EVALUATION_REMINDER_SHEETS_PREFIX = "evaluationReminderSheets";
export const EVALUATION_REMINDER_LEVEL_PREFIX = "evaluationReminderLevel";

export const EVALUATION_REMINDER_LEVELS = [
  { key: "upper", label: "上級", forumId: EVALUATION_SHEET_FORUM_IDS[2], roleId: ROLE_IDS.EVALUATION_1KYUU },
  { key: "middle", label: "中級", forumId: EVALUATION_SHEET_FORUM_IDS[1], roleId: ROLE_IDS.EVALUATION_2KYUU },
  { key: "lower", label: "下級", forumId: EVALUATION_SHEET_FORUM_IDS[0], roleId: ROLE_IDS.EVALUATION_3KYUU },
  { key: "beginner", label: "見習い", forumId: EVALUATION_SHEET_FORUM_IDS[3], roleId: ROLE_IDS.EVALUATION_BUIGINNER },
] as const;

const EVALUATION_REMINDER_FULL_ACCESS_ROLE_IDS = [
  ROLE_IDS.EVALUATION_LEADER,
  ROLE_IDS.EVALUATION_SUPPORT,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.GIJUTU_LEADER,
] as const;

type CurrentSheet = { userId: string; forumId: string; threadId: string };
type SheetThread = { id: string; parentId: string | null; name: string; createdTimestamp: number | null };
export type ReminderTargets = { twoDays: string[]; oneDay: string[] };
type EvaluationLevelKey = typeof EVALUATION_REMINDER_LEVELS[number]["key"];
export type ReminderSheetLinks = Record<string, Partial<Record<EvaluationLevelKey, string>>>;
type ReminderPage = { content: string; users: string[]; roles: string[]; sheetLinks?: ReminderSheetLinks };
type DeliveryRow = RowDataPacket & { pages: string | ReminderPage[]; message_ids: string | string[]; completed: number };

export function hasEvaluationReminderFullAccess(member: GuildMember) {
  return EVALUATION_REMINDER_FULL_ACCESS_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

export function visibleEvaluationLevels(member: GuildMember) {
  if (hasEvaluationReminderFullAccess(member)) return [...EVALUATION_REMINDER_LEVELS];
  const highestLevel = EVALUATION_REMINDER_LEVELS.find(level => member.roles.cache.has(level.roleId));
  return highestLevel ? [highestLevel] : [];
}

export function buildSheetLinkResponsePages(page: ReminderPage, levels: readonly typeof EVALUATION_REMINDER_LEVELS[number][]) {
  const pages: string[] = [];
  let content = "";
  for (const level of levels) {
    const lines = page.users.flatMap(userId => {
      const threadId = page.sheetLinks?.[userId]?.[level.key];
      return threadId ? [`<@${userId}> → <#${threadId}>`] : [];
    });
    if (!lines.length) continue;
    const heading = `**${level.label}評価シート**`;
    const headingAddition = `${content ? "\n\n" : ""}${heading}`;
    if (content.length + headingAddition.length > 2000) {
      pages.push(content);
      content = heading;
    } else content += headingAddition;
    for (const line of lines) {
      const addition = `\n${line}`;
      if (content.length + addition.length > 2000) {
        pages.push(content);
        content = `${heading}\n${line}`;
      } else content += addition;
    }
  }
  if (content) pages.push(content);
  return pages;
}

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
export function buildReminderPages(
  date: string, targets: ReminderTargets, sheetLinks: ReminderSheetLinks = {},
): ReminderPage[] {
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
      if (userId) {
        page.users.push(userId);
        if (sheetLinks[userId]) {
          page.sheetLinks ??= {};
          page.sheetLinks[userId] = sheetLinks[userId];
        }
      }
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
    const selectedUserIds = new Set([...targets.twoDays, ...targets.oneDay]);
    const sheetLinks: ReminderSheetLinks = {};
    for (const sheet of sheets) {
      if (!selectedUserIds.has(sheet.userId)) continue;
      const level = EVALUATION_REMINDER_LEVELS.find(candidate => candidate.forumId === sheet.forumId);
      if (!level) continue;
      sheetLinks[sheet.userId] ??= {};
      sheetLinks[sheet.userId][level.key] = sheet.threadId;
    }
    return { ...targets, pages: buildReminderPages(date, targets, sheetLinks) };
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

  static async getDestination(client: Client): Promise<ThreadChannel> {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD, { force: true });
    if (!channel?.isThread() || channel.guildId !== process.env.GUILD_ID) {
      throw new Error("評価期限通知の送信先が不正です");
    }
    await channel.guild.roles.fetch();
    const me = await channel.guild.members.fetchMe({ force: true });
    const permissions = channel.permissionsFor(me);
    const notificationRoles = [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT]
      .map(roleId => channel.guild.roles.cache.get(roleId));
    if (!permissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ReadMessageHistory,
    ]) ||
      notificationRoles.some(role => !role) ||
      (notificationRoles.some(role => !role!.mentionable) && !permissions.has(PermissionFlagsBits.MentionEveryone))) {
      throw new Error("評価期限通知の送信・履歴取得・判定官・侍従メンション権限が不足しています");
    }
    return channel;
  }

  /** 送信成功後のDB更新失敗にも備え、23時以降のBot投稿を読み戻す。 */
  static async findDeliveredPages(channel: ThreadChannel, date: string, pages: ReminderPage[]) {
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

  /** 前日分として保存した本文と一致する、このBot自身の投稿だけを削除する。 */
  static async deletePreviousReminderMessages(channel: ThreadChannel, date: string, pages: ReminderPage[]) {
    if (!pages.length) return 0;
    const since = dayjs.tz(`${date} 23:00`, TZ).subtract(1, "day").valueOf();
    const until = dayjs.tz(`${date} 23:00`, TZ).valueOf();
    const contents = new Set(pages.map(page => page.content));
    let deleted = 0;
    let before: string | undefined;
    while (true) {
      const messages = await channel.messages.fetch({ limit: 100, before, cache: false });
      for (const message of messages.values()) {
        if (message.createdTimestamp >= since && message.createdTimestamp < until &&
          message.author.id === channel.client.user!.id && contents.has(message.content)) {
          await message.delete();
          deleted++;
        }
      }
      const last = messages.last();
      if (messages.size < 100 || !last || last.createdTimestamp < since) break;
      before = last.id;
    }
    return deleted;
  }

  static async showSheetLinks(interaction: ButtonInteraction) {
    const match = interaction.customId.match(
      new RegExp(`^${EVALUATION_REMINDER_SHEETS_PREFIX}:(\\d{4}-\\d{2}-\\d{2}):(\\d+)$`),
    );
    if (!match || interaction.guildId !== process.env.GUILD_ID ||
      interaction.channelId !== TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD || !interaction.guild) {
      throw new Error("この評価期限通知から操作してください。");
    }
    const [, date, pageIndexText] = match;
    const pageIndex = Number(pageIndexText);
    const connection = await DbService.getConnection();
    let row: DeliveryRow | undefined;
    try {
      const [rows] = await connection.execute<DeliveryRow[]>(
        "SELECT pages FROM evaluation_deadline_reminders WHERE guild_id = ? AND notice_date = ?",
        [interaction.guildId, date],
      );
      row = rows[0];
    } finally { connection.release(); }
    if (!row) throw new Error("この通知の評価シート情報が見つかりません。");
    const pages: ReminderPage[] = typeof row.pages === "string" ? JSON.parse(row.pages) : row.pages;
    const page = pages[pageIndex];
    if (!page || !page.sheetLinks || interaction.message.author.id !== interaction.client.user.id ||
      interaction.message.content !== page.content) {
      throw new Error("この通知の評価シート情報が一致しません。");
    }
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    if (hasEvaluationReminderFullAccess(member)) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`${EVALUATION_REMINDER_LEVEL_PREFIX}:${date}:${pageIndex}:${interaction.user.id}`)
        .setPlaceholder("表示する階級を選択")
        .addOptions(EVALUATION_REMINDER_LEVELS.map(level => ({ label: `${level.label}評価シート`, value: level.key })));
      await interaction.editReply({
        content: "表示する評価シートの階級を選択してください。",
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        allowedMentions: { parse: [] },
      });
      return;
    }
    const levels = visibleEvaluationLevels(member);
    if (!levels.length) {
      throw new Error("表示できる評価シートがありません。判定官の階級ロールを確認してください。");
    }
    const responsePages = buildSheetLinkResponsePages(page, levels);
    if (!responsePages.length) throw new Error("表示できる評価シートがありません。");
    await interaction.editReply({ content: responsePages[0], allowedMentions: { parse: [] } });
    for (const content of responsePages.slice(1)) {
      await interaction.followUp({ content, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    }
  }

  static async showSelectedSheetLevel(interaction: StringSelectMenuInteraction) {
    const match = interaction.customId.match(
      new RegExp(`^${EVALUATION_REMINDER_LEVEL_PREFIX}:(\\d{4}-\\d{2}-\\d{2}):(\\d+):(\\d+)$`),
    );
    if (!match || interaction.guildId !== process.env.GUILD_ID ||
      interaction.channelId !== TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD || !interaction.guild ||
      match[3] !== interaction.user.id) {
      throw new Error("この評価期限通知から操作してください。");
    }
    await interaction.deferUpdate();
    const [, date, pageIndexText] = match;
    const selectedLevel = EVALUATION_REMINDER_LEVELS.find(level => level.key === interaction.values[0]);
    if (!selectedLevel || interaction.values.length !== 1) throw new Error("表示する階級が不正です。");
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    if (!hasEvaluationReminderFullAccess(member)) {
      throw new Error("階級を選択できる管理ロールがありません。");
    }
    const connection = await DbService.getConnection();
    let row: DeliveryRow | undefined;
    try {
      const [rows] = await connection.execute<DeliveryRow[]>(
        "SELECT pages FROM evaluation_deadline_reminders WHERE guild_id = ? AND notice_date = ?",
        [interaction.guildId, date],
      );
      row = rows[0];
    } finally { connection.release(); }
    if (!row) throw new Error("この通知の評価シート情報が見つかりません。");
    const pages: ReminderPage[] = typeof row.pages === "string" ? JSON.parse(row.pages) : row.pages;
    const page = pages[Number(pageIndexText)];
    if (!page?.sheetLinks) throw new Error("この通知の評価シート情報が一致しません。");
    const responsePages = buildSheetLinkResponsePages(page, [selectedLevel]);
    if (!responsePages.length) throw new Error("表示できる評価シートがありません。");
    await interaction.editReply({ content: responsePages[0], components: [], allowedMentions: { parse: [] } });
    for (const content of responsePages.slice(1)) {
      await interaction.followUp({ content, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    }
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
      const previousDate = dayjs.tz(date, TZ).subtract(1, "day").format("YYYY-MM-DD");
      const [previousRows] = await connection.execute<DeliveryRow[]>(
        "SELECT pages FROM evaluation_deadline_reminders WHERE guild_id = ? AND notice_date = ?",
        [guildId, previousDate],
      );
      if (previousRows[0]) {
        const previousPages: ReminderPage[] = typeof previousRows[0].pages === "string"
          ? JSON.parse(previousRows[0].pages) : previousRows[0].pages;
        const deleted = await this.deletePreviousReminderMessages(channel, date, previousPages);
        if (deleted) console.info("[EvaluationReminder] 前日分を削除", { date: previousDate, messages: deleted });
      }
      const pages: ReminderPage[] = typeof row.pages === "string" ? JSON.parse(row.pages) : row.pages;
      const ids: string[] = typeof row.message_ids === "string" ? JSON.parse(row.message_ids) : row.message_ids;
      const found = pages.length ? await this.findDeliveredPages(channel, date, pages) : new Map<number, string>();
      for (let i = 0; i < pages.length; i++) {
        if (ids[i]) continue;
        const page = pages[i];
        const button = page.sheetLinks && Object.keys(page.sheetLinks).length
          ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`${EVALUATION_REMINDER_SHEETS_PREFIX}:${date}:${i}`)
              .setLabel("評価シートを表示")
              .setStyle(ButtonStyle.Primary),
          )] : [];
        ids[i] = found.get(i) ?? (await channel.send({
          content: page.content,
          components: button,
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
