import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType,
  Client, EmbedBuilder, MessageFlags, ModalSubmitInteraction, PermissionFlagsBits,
} from "discord.js";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { DIARY_MESSAGES, DIARY_PENDING_EXPIRATION_MS, DIARY_TYPE_NAMES } from "../../constant/diary/diary";
import { ACTION_TYPES } from "../../constant/currency/action";
import { BOT_ID, FORUM_IDS, ROLE_IDS } from "../../constant/shared/id";
import type { DiaryRow } from "../../type/diary/diary";
import { DbService } from "../system/dbService";
import { withDiaryMutation } from "./diaryMutationGuard";

export const DIARY_REBUILD_PRICE = 5000;
const PREFIX = "diaryRebuild";
const BUSY = "前の日記作り直しを確認中です。しばらく待ってからお試しください。";
interface Draft {
  id: string; userId: string; guildId: string; channelId: string;
  messageId?: string; oldThreadId: string; type: string; isPrivate: number;
  title: string; body: string; expiresAt: number;
}
interface RebuildRow extends RowDataPacket {
  id: string; user_id: string; old_thread_id: string; new_thread_id: string | null;
  status: string;
}

export class DiaryRebuildService {
  private static drafts = new Map<string, Draft>();
  private static timer: NodeJS.Timeout | undefined;
  private static recovering = false;

  private static async diary(connection: PoolConnection, userId: string, lock = false) {
    const [rows] = await connection.execute<DiaryRow[]>(
      `SELECT * FROM diaries WHERE creator_user_id = ?${lock ? " FOR UPDATE" : ""}`, [userId]);
    return rows[0];
  }

  private static async checkAccount(connection: PoolConnection, userId: string, lock = false) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT wallet, is_frozen FROM accounts WHERE user_id = ?${lock ? " FOR UPDATE" : ""}`, [userId]);
    if (!rows[0]) throw new Error("口座が見つかりません。");
    if (rows[0].is_frozen) throw new Error("口座が凍結されています。");
    if (Number(rows[0].wallet) < DIARY_REBUILD_PRICE) throw new Error(DIARY_MESSAGES.INSUFFICIENT_WALLET);
    return Number(rows[0].wallet);
  }

  private static async checkMember(interaction: ModalSubmitInteraction | ButtonInteraction) {
    if (!interaction.guild || interaction.guildId !== process.env.GUILD_ID) throw new Error("このサーバーでは利用できません。");
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    if (member.roles.cache.has(ROLE_IDS.SUB_ACCOUNT)) throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
  }

  private static async thread(client: Client, id: string) {
    try {
      const channel = await client.channels.fetch(id, { force: true });
      if (!channel) return null;
      if (!channel.isThread() || channel.parentId !== FORUM_IDS.DIARY) throw new Error("日記のスレッドを確認できません。");
      return channel;
    } catch (error) {
      if ((error as { code?: number }).code === 10003) return null;
      throw error;
    }
  }

  private static async assertNoPending(connection: PoolConnection, userId: string) {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM diary_rebuilds WHERE user_id = ? AND status NOT IN ('complete', 'failed') LIMIT 1", [userId]);
    if (rows.length) throw new Error(BUSY);
  }

  static async showConfirmation(interaction: ModalSubmitInteraction, title: string, body: string) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await this.checkMember(interaction);
    const connection = await DbService.getConnection();
    let diary: DiaryRow;
    try {
      await this.assertNoPending(connection, interaction.user.id);
      diary = await this.diary(connection, interaction.user.id);
      if (!diary) throw new Error("作り直す日記がありません。「日記を作成」から作成してください。");
      await this.checkAccount(connection, interaction.user.id);
    } finally { connection.release(); }
    if (!await this.thread(interaction.client, diary.thread_id)) throw new Error("元の日記が見つかりません。運営にお問い合わせください。");
    title = title.trim(); body = body.trim();
    const name = (diary.is_private ? DIARY_MESSAGES.PRIVATE_TITLE_PREFIX : "") + title;
    if (!title || name.length > 100 || body.length > 200) throw new Error("タイトルは記号を含め100文字以内、本文は200文字以内で入力してください。");
    for (const [id, draft] of this.drafts) {
      if (draft.expiresAt < Date.now() || draft.userId === interaction.user.id) this.drafts.delete(id);
    }
    const draft: Draft = {
      id: randomUUID(), userId: interaction.user.id, guildId: interaction.guildId!,
      channelId: interaction.channelId!, oldThreadId: diary.thread_id, type: diary.type,
      isPrivate: Number(diary.is_private), title: name, body, expiresAt: Date.now() + DIARY_PENDING_EXPIRATION_MS,
    };
    const message = await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle("日記の作り直し確認").setColor(0xed4245)
        .setDescription(`**5,000 LIAを支払い、日記を作り直します。**\n元の日記 <#${diary.thread_id}> と投稿はすべて削除され、元に戻せません。\n投稿内容は引き継がれません。`)
        .addFields({ name: "新しいタイトル", value: name },
          { name: "日記の種類", value: DIARY_TYPE_NAMES[diary.type] },
          { name: "最初の本文", value: body || DIARY_MESSAGES.BODY_DEFAULT })],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${PREFIX}:confirm:${draft.id}`).setLabel("5,000 LIAで作り直す").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${PREFIX}:cancel:${draft.id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary))],
      allowedMentions: { parse: [] },
    });
    draft.messageId = message.id;
    this.drafts.set(draft.id, draft);
  }

  static async handleButton(interaction: ButtonInteraction) {
    const [prefix, action, id, extra] = interaction.customId.split(":");
    const draft = this.drafts.get(id);
    if (prefix !== PREFIX || extra || !["confirm", "cancel"].includes(action) || !draft ||
        draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId ||
        draft.channelId !== interaction.channelId || draft.messageId !== interaction.message.id) {
      await interaction.followUp({ content: "この確認は無効または処理済みです。パネルから開き直してください。", flags: MessageFlags.Ephemeral });
      return;
    }
    this.drafts.delete(id); // Consume before any await: a confirmation can settle only once.
    if (action === "cancel" || draft.expiresAt < Date.now()) {
      await interaction.editReply({ content: action === "cancel" ? "キャンセルしました。支払い・削除は行っていません。" : "確認の有効期限が切れました。パネルからやり直してください。", embeds: [], components: [] });
      return;
    }
    await interaction.editReply({ content: "日記を作り直しています。", embeds: [], components: [] });
    try {
      const result = await withDiaryMutation(draft.userId, () => this.execute(interaction, draft));
      await interaction.editReply({ content: `5,000 LIAで日記を作り直しました。 <#${result.threadId}>\n${result.deleted ? "元の日記を削除しました。" : "元の日記の削除を確認中です。追加の支払いはありません。"}`, allowedMentions: { parse: [] } });
    } catch (error) {
      console.error("[DiaryRebuild] operation failed", { id, error });
      await interaction.editReply({ content: error instanceof Error ? error.message : "処理結果を確認中です。運営にお問い合わせください。", embeds: [], components: [] });
    }
  }

  private static async withLock<T>(userId: string, action: (connection: PoolConnection) => Promise<T>) {
    const connection = await DbService.getConnection();
    const key = `diary-rebuild:${userId}`;
    let locked = false;
    try {
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS acquired", [key]);
      locked = Number(rows[0]?.acquired) === 1;
      if (!locked) throw new Error(BUSY);
      return await action(connection);
    } finally {
      if (locked) {
        try { await connection.execute("SELECT RELEASE_LOCK(?)", [key]); }
        catch { connection.destroy(); }
      }
      connection.release();
    }
  }

  private static async execute(interaction: ButtonInteraction, draft: Draft) {
    return this.withLock(draft.userId, async connection => {
      await this.checkMember(interaction);
      await this.assertNoPending(connection, draft.userId);
      this.assertSameDiary(await this.diary(connection, draft.userId), draft);
      await this.checkAccount(connection, draft.userId);
      const old = await this.thread(interaction.client, draft.oldThreadId);
      if (!old) throw new Error("元の日記が見つかりません。支払いは行っていません。");
      const forum = await interaction.client.channels.fetch(FORUM_IDS.DIARY, { force: true });
      if (!forum || forum.type !== ChannelType.GuildForum || forum.guildId !== draft.guildId) throw new Error(DIARY_MESSAGES.FORUM_INVALID);
      const me = await forum.guild.members.fetchMe();
      if (!old.permissionsFor(me)?.has(PermissionFlagsBits.ManageThreads)) throw new Error("Botに日記を削除する権限がありません。支払いは行っていません。");
      await connection.execute(
        "INSERT INTO diary_rebuilds (id, user_id, old_thread_id, status) VALUES (?, ?, ?, 'creating')",
        [draft.id, draft.userId, draft.oldThreadId]);
      let newThread;
      try {
        newThread = await forum.threads.create({ name: draft.title,
          message: { content: draft.body || DIARY_MESSAGES.BODY_DEFAULT, allowedMentions: { parse: [] } },
          reason: `Diary rebuild ${draft.id}` });
      } catch (error) {
        // An explicit Discord 4xx means nothing was created. A network/5xx failure is ambiguous.
        const status = (error as { status?: number }).status;
        await connection.execute("UPDATE diary_rebuilds SET status = ? WHERE id = ?",
          [status && status >= 400 && status < 500 ? "failed" : "needs_review", draft.id]);
        throw new Error("新しい日記を作成できませんでした。支払い・元の日記の削除は行っていません。再度操作できない場合は運営にお問い合わせください。");
      }
      try {
        await connection.execute("UPDATE diary_rebuilds SET new_thread_id = ?, status = 'prepared' WHERE id = ?", [newThread.id, draft.id]);
      } catch (error) {
        // No settlement has been attempted, so this new thread is safe to remove.
        try { await newThread.delete("Unpaid diary rebuild"); } catch { /* Logged with the known thread ID below. */ }
        console.error("[DiaryRebuild] prepare failed", { id: draft.id, newThreadId: newThread.id, error });
        throw new Error("日記の準備を完了できませんでした。支払い・元の日記の削除は行っていません。運営にお問い合わせください。");
      }
      let commitAttempted = false;
      try {
        await this.checkMember(interaction);
        await connection.beginTransaction();
        const wallet = await this.checkAccount(connection, draft.userId, true);
        this.assertSameDiary(await this.diary(connection, draft.userId, true), draft);
        await connection.execute("UPDATE accounts SET wallet = wallet - ? WHERE user_id = ?", [DIARY_REBUILD_PRICE, draft.userId]);
        await connection.execute("UPDATE diaries SET thread_id = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE creator_user_id = ?", [newThread.id, draft.userId]);
        await connection.execute(
          "INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) VALUES (?, ?, ?, ?, ?, 0, ?)",
          [ACTION_TYPES.DIARY_REBUILD, DIARY_REBUILD_PRICE, draft.userId, BOT_ID, wallet - DIARY_REBUILD_PRICE, `日記作り直し ${draft.id}`]);
        await connection.execute("UPDATE diary_rebuilds SET status = 'pending_delete' WHERE id = ?", [draft.id]);
        commitAttempted = true;
        await connection.commit();
      } catch (error) {
        try { await connection.rollback(); } catch { connection.destroy(); /* Do not return a connection with an open transaction to the pool. */ }
        if (!commitAttempted) {
          // prepared is a durable cleanup job; failures here are retried without charging.
          try {
            await newThread.delete("Unpaid diary rebuild");
            await connection.execute("UPDATE diary_rebuilds SET status = 'failed' WHERE id = ? AND status = 'prepared'", [draft.id]);
          } catch (cleanupError) { console.error("[DiaryRebuild] cleanup deferred", { id: draft.id, cleanupError }); }
          throw new Error(`作り直しを中止しました。支払い・元の日記の削除は行っていません。${error instanceof Error ? error.message : ""}`);
        }
        // Never delete the replacement or charge again after an uncertain COMMIT.
        throw new Error("支払い結果を確認中です。追加操作をせずお待ちください。解消しない場合は運営にお問い合わせください。");
      }
      let deleted = false;
      try {
        deleted = await this.finishDeletion(interaction.client, connection, {
          id: draft.id, user_id: draft.userId, old_thread_id: draft.oldThreadId,
          new_thread_id: newThread.id, status: "pending_delete",
        } as RebuildRow);
      } catch (error) { console.error("[DiaryRebuild] old deletion deferred", { id: draft.id, error }); }
      return { threadId: newThread.id, deleted };
    });
  }

  private static assertSameDiary(diary: DiaryRow | undefined, draft: Draft) {
    if (!diary || diary.thread_id !== draft.oldThreadId || diary.type !== draft.type || Number(diary.is_private) !== draft.isPrivate) {
      throw new Error("確認後に日記が変更されました。パネルから開き直してください。");
    }
  }

  private static async finishDeletion(client: Client, connection: PoolConnection, row: RebuildRow) {
    const current = await this.diary(connection, row.user_id);
    if (!row.new_thread_id || current?.thread_id !== row.new_thread_id ||
        !await this.thread(client, row.new_thread_id) || row.new_thread_id === row.old_thread_id) {
      await connection.execute("UPDATE diary_rebuilds SET status = 'needs_review' WHERE id = ?", [row.id]);
      console.error("[DiaryRebuild] manual review required; old diary preserved", { id: row.id });
      return false;
    }
    const old = await this.thread(client, row.old_thread_id);
    if (old) await old.delete(`Paid diary rebuild ${row.id}`);
    await connection.execute("UPDATE diary_rebuilds SET status = 'complete' WHERE id = ?", [row.id]);
    return true;
  }

  static startRecovery(client: Client) {
    if (this.timer) return;
    void this.recover(client);
    this.timer = setInterval(() => void this.recover(client), 60_000);
    this.timer.unref();
  }

  static async recover(client: Client) {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const connection = await DbService.getConnection();
      let rows: RebuildRow[];
      try {
        [rows] = await connection.execute<RebuildRow[]>(
          "SELECT * FROM diary_rebuilds WHERE status = 'pending_delete' OR (status IN ('creating', 'prepared') AND updated_at < NOW() - INTERVAL 10 MINUTE) LIMIT 50");
      } finally { connection.release(); }
      for (const row of rows) {
        try {
          await withDiaryMutation(row.user_id, () => this.withLock(row.user_id, async connection => {
            const [fresh] = await connection.execute<RebuildRow[]>("SELECT * FROM diary_rebuilds WHERE id = ?", [row.id]);
            const job = fresh[0];
            if (job.status === "pending_delete") return void await this.finishDeletion(client, connection, job);
            if (!["creating", "prepared"].includes(job.status)) return;
            if (!job.new_thread_id) {
              await connection.execute("UPDATE diary_rebuilds SET status = 'needs_review' WHERE id = ?", [job.id]);
              console.error("[DiaryRebuild] interrupted creation requires review", { id: job.id });
              return;
            }
            const current = await this.diary(connection, job.user_id);
            if (current?.thread_id === job.new_thread_id) throw new Error("Paid/current diary must not be cleaned up");
            const abandoned = await this.thread(client, job.new_thread_id);
            if (abandoned) await abandoned.delete(`Unpaid diary rebuild ${job.id}`);
            await connection.execute("UPDATE diary_rebuilds SET status = 'failed' WHERE id = ?", [job.id]);
          }));
        } catch (error) { console.error("[DiaryRebuild] recovery deferred", { id: row.id, error }); }
      }
    } catch (error) { console.error("[DiaryRebuild] recovery failed", error); }
    finally { this.recovering = false; }
  }
}
