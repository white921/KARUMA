import {
  ButtonInteraction,
  ChannelType,
  Client,
  ForumChannel,
  GuildMember,
  Message,
  MessageFlags,
  ModalSubmitInteraction,
  ThreadChannel,
} from "discord.js";
import { RowDataPacket } from "mysql2/promise";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { DiaryRow } from "../type/diary";

import { hasRole } from "../util/role";

import {
  DIARY_MESSAGES,
  DIARY_PRICE,
  DIARY_TYPE,
  DIARY_TYPE_NAMES,
  DiaryType,
} from "../constant/diary";
import { BOT_ID, FORUM_IDS, ROLE_IDS } from "../constant/id";
import { ACCOUNT_MESSAGES } from "../constant/account";

type DiaryExecutionInteraction = ModalSubmitInteraction | ButtonInteraction;
type PendingDiaryAction = {
  commandId: string;
  title: string;
  body: string;
  createdAt: number;
};

export class DiaryService {
  private static readonly INACTIVE_DAYS = 3;
  private static readonly INACTIVE_MS =
    DiaryService.INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  private static readonly PENDING_EXPIRATION_MS = 10 * 60 * 1000;
  private static readonly pendingDiaryActions = new Map<
    string,
    PendingDiaryAction
  >();

  static setPendingDiaryAction(
    userId: string,
    commandId: string,
    title: string,
    body: string,
  ) {
    this.pendingDiaryActions.set(userId, {
      commandId,
      title,
      body,
      createdAt: Date.now(),
    });
  }

  static consumePendingDiaryAction(userId: string, commandId: string) {
    const pending = this.pendingDiaryActions.get(userId);
    if (!pending) {
      return null;
    }

    this.pendingDiaryActions.delete(userId);

    if (pending.commandId !== commandId) {
      return null;
    }

    if (Date.now() - pending.createdAt > this.PENDING_EXPIRATION_MS) {
      return null;
    }

    return pending;
  }

  /**
   * 日記作成
   * @param interaction
   * @param diaryType (private, public)
   * @param title
   * @param body
   * @returns
   */
  static async createDiary(
    interaction: DiaryExecutionInteraction,
    diaryType: DiaryType,
    title: string,
    body: string,
  ) {
    const creatorUserId = interaction.user.id;
    const member = interaction.member as GuildMember;
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();

    if (await hasRole(member, ROLE_IDS.SUB_ACCOUNT)) {
      throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
    }

    const userAccount = (
      await AccountService.getAccountByUserId(creatorUserId)
    )[0];
    const botAccount = (
      await AccountService.getAccountByUserId(BOT_ID)
    )[0];
    if (!userAccount) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }
    if (!botAccount) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    const existingDiary = await this.getDiaryByCreatorId(creatorUserId);
    const isFree = await this.isFree(member);
    const forum = await this.fetchTestDiaryForum(interaction.client);
    if (!existingDiary) {
      await this.createNewDiary(
        interaction,
        forum,
        creatorUserId,
        diaryType,
        normalizedTitle,
        normalizedBody,
        isFree,
        userAccount.wallet,
        botAccount.user_id,
      );
      return;
    }

    if (existingDiary) {
      const existingThread = await this.fetchDiaryThread(
        interaction.client,
        existingDiary.thread_id,
      );
      if (!existingThread || !existingThread.isThread()) {
        await this.setDiaryIsActive(existingDiary.thread_id, false);
        if (existingDiary.type !== diaryType) {
          throw new Error(DIARY_MESSAGES.ALREADY_EXISTS);
        }
        await this.createNewDiary(
          interaction,
          forum,
          creatorUserId,
          diaryType,
          normalizedTitle,
          normalizedBody,
          isFree,
          userAccount.wallet,
          botAccount.user_id,
        );
        return;
      }

      if (existingDiary.is_active) {
        throw new Error(DIARY_MESSAGES.ALREADY_EXISTS);
      }

      await this.reopenDiary(
        interaction,
        existingDiary,
        existingThread as ThreadChannel,
        diaryType,
        normalizedTitle,
        normalizedBody,
        isFree,
        userAccount.wallet,
        botAccount.user_id,
      );
    }
  }

  static async updateDiary(
    interaction: DiaryExecutionInteraction,
    title: string,
    body: string,
  ) {
    const creatorUserId = interaction.user.id;
    const member = interaction.member as GuildMember;
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();

    if (await hasRole(member, ROLE_IDS.SUB_ACCOUNT)) {
      throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
    }

    const diary = await this.getDiaryByCreatorId(creatorUserId);
    if (!diary) {
      throw new Error(DIARY_MESSAGES.NO_DIARY_TO_UPDATE);
    }

    if (!diary.is_active) {
      throw new Error(DIARY_MESSAGES.NO_ACTIVE);
    }

    if (diary.type === DIARY_TYPE.PUBLIC) {
      throw new Error(DIARY_MESSAGES.ALREADY_PUBLIC);
    }

    const userAccount = (
      await AccountService.getAccountByUserId(creatorUserId)
    )[0];
    const botAccount = (
      await AccountService.getAccountByUserId(BOT_ID)
    )[0];
    if (!userAccount || !botAccount) {
      throw new Error(DIARY_MESSAGES.CREATE_ERROR);
    }

    const threadChannel = await this.fetchDiaryThread(
      interaction.client,
      diary.thread_id,
    );
    if (!threadChannel || !threadChannel.isThread()) {
      await this.setDiaryIsActive(diary.thread_id, false);
      throw new Error(DIARY_MESSAGES.NO_ACTIVE);
    }

    const isFree = await this.isFree(member);

    await this.upgradeDiary(
      interaction,
      diary,
      threadChannel as ThreadChannel,
      normalizedTitle,
      normalizedBody,
      isFree,
      userAccount.wallet,
      botAccount.user_id,
    );
  }

  /**
   * 通常日記にて作成者の本アカorサブアカ以外の人が送信したメッセージを削除
   * @param message 日記メッセージ
   */
  static async handleDiaryMessage(message: Message) {
    if (
      message.author.bot ||
      !message.inGuild() ||
      !message.channel.isThread()
    ) {
      return;
    }

    const diary = await this.getDiaryByThreadId(message.channel.id);
    // 日記レコードが無い or VIP日記の場合はスキップ
    if (!diary || !diary.is_private) {
      return;
    }

    const linkedUserIds = await AccountService.getLinkedAccountUserIds(
      diary.creator_user_id,
    );
    if (linkedUserIds.includes(message.author.id)) {
      return;
    }

    await message.delete();
  }

  static async closeInactiveDiaries(client: Client) {
    try {
      const diaries = await this.getDiaries();
      for (const diary of diaries) {
        await this.closeDiaryIfInactive(client, diary);
      }
    } catch (error) {
      console.error("closeInactiveDiaries error:", error);
    }
  }

  static async syncDiaryThreadStates(client: Client) {
    try {
      const diaries = await this.getDiaries();
      for (const diary of diaries) {
        await this.syncDiaryThreadState(client, diary);
      }
    } catch (error) {
      console.error("syncDiaryThreadStates error:", error);
    }
  }

  static async isFree(member: GuildMember): Promise<boolean> {
    return (
      hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.HONMEN) ||
      hasRole(member, ROLE_IDS.SABANUSI) ||
      hasRole(member, ROLE_IDS.KANRISYA)
    );
  }

  private static async createNewDiary(
    interaction: DiaryExecutionInteraction,
    forum: ForumChannel,
    creatorUserId: string,
    diaryType: DiaryType,
    title: string,
    body: string,
    isFree: boolean,
    currentWallet: number,
    botUserId: string,
  ) {
    const price = isFree ? 0 : this.getDiaryPrice(diaryType);
    if (!isFree && currentWallet < price) {
      throw new Error(DIARY_MESSAGES.INSUFFICIENT_WALLET);
    }

    const initialBody = body || DIARY_MESSAGES.BODY_DEFAULT;
    const thread = await forum.threads.create({
      name: this.buildThreadName(title, diaryType === DIARY_TYPE.PRIVATE),
      message: {
        content: initialBody,
      },
    });
    if (!isFree) {
      await this.payDiaryPrice(creatorUserId, price);
      await ActionService.executeActionLog(
        interaction,
        diaryType,
        price,
        creatorUserId,
        botUserId,
        currentWallet - price,
        0,
        `${DIARY_TYPE_NAMES[diaryType]}を作成しました。`,
      );
    }

    await this.insertDiary(
      thread.id,
      creatorUserId,
      diaryType,
      diaryType === DIARY_TYPE.PRIVATE,
      true,
    );

    await this.replyWithDiaryMessage(
      interaction,
      DIARY_MESSAGES.CREATED.replace(
        "{type}",
        DIARY_TYPE_NAMES[diaryType],
      ).replace("{thread}", `<#${thread.id}>`),
    );
  }

  private static async upgradeDiary(
    interaction: DiaryExecutionInteraction,
    diary: DiaryRow,
    thread: ThreadChannel,
    title: string,
    body: string,
    isFree: boolean,
    currentWallet: number,
    botUserId: string,
  ) {
    const upgradePrice = isFree ? 0 : this.getUpgradePrice();
    if (!isFree && currentWallet < upgradePrice) {
      throw new Error(DIARY_MESSAGES.INSUFFICIENT_WALLET);
    }

    await thread.setName(this.buildThreadName(title, false));
    if (body) {
      await thread.send({ content: body });
    }

    if (!isFree) {
      await this.payDiaryPrice(diary.creator_user_id, upgradePrice);
      await ActionService.executeActionLog(
        interaction,
        DIARY_TYPE.PUBLIC,
        upgradePrice,
        diary.creator_user_id,
        botUserId,
        currentWallet - upgradePrice,
        0,
        `${DIARY_TYPE_NAMES[DIARY_TYPE.PUBLIC]}へアップグレードしました。`,
      );
    }

    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE diaries
         SET type = ?, is_private = ?, updated_at = CURRENT_TIMESTAMP
         WHERE thread_id = ?`,
        [DIARY_TYPE.PUBLIC, false, thread.id],
      );
    } finally {
      connection.release();
    }

    await this.replyWithDiaryMessage(
      interaction,
      DIARY_MESSAGES.UPGRADED.replace("{thread}", `<#${thread.id}>`),
    );
  }

  private static async reopenDiary(
    interaction: DiaryExecutionInteraction,
    diary: DiaryRow,
    thread: ThreadChannel,
    requestedType: DiaryType,
    title: string,
    body: string,
    isFree: boolean,
    currentWallet: number,
    botUserId: string,
  ) {
    // 以前は通常でVIPを選んだ時trueになる
    const shouldUpgrade =
      diary.type === DIARY_TYPE.PRIVATE && requestedType === DIARY_TYPE.PUBLIC;

    const price = isFree ? 0 : this.getDiaryPrice(requestedType);

    if (!isFree && currentWallet < price) {
      throw new Error(DIARY_MESSAGES.INSUFFICIENT_WALLET);
    }

    // Archived threads must be reopened before their lock state can be changed.
    await thread.setArchived(false);
    await thread.setLocked(false);
    await thread.setName(
      this.buildThreadName(title, !shouldUpgrade && Boolean(diary.is_private)),
    );
    if (body) {
      await thread.send({ content: body });
    }

    if (price > 0) {
      await this.payDiaryPrice(diary.creator_user_id, price);
      await ActionService.executeActionLog(
        interaction,
        DIARY_TYPE.PUBLIC,
        price,
        diary.creator_user_id,
        botUserId,
        currentWallet - price,
        0,
        `${DIARY_TYPE_NAMES[requestedType]}を作成しました。`,
      );
    }

    await this.updateReopenedDiary(
      diary.thread_id,
      requestedType,
      requestedType === DIARY_TYPE.PRIVATE,
    );

    const reopenText = DIARY_MESSAGES.REOPENED.replace(
      "{thread}",
      `<#${thread.id}>`,
    );

    await this.replyWithDiaryMessage(
      interaction,
      reopenText.replace("{thread}", `<#${thread.id}>`),
    );
  }

  private static getDiaryPrice(diaryType: DiaryType): number {
    const price = DIARY_PRICE[diaryType];
    if (price === null) {
      throw new Error(DIARY_MESSAGES.PRICE_NOT_CONFIGURED);
    }
    return price;
  }

  private static getUpgradePrice(): number {
    return (
      this.getDiaryPrice(DIARY_TYPE.PUBLIC) -
      this.getDiaryPrice(DIARY_TYPE.PRIVATE)
    );
  }

  private static buildThreadName(title: string, isPrivate: boolean) {
    return isPrivate ? `${DIARY_MESSAGES.PRIVATE_TITLE_PREFIX}${title}` : title;
  }

  private static async fetchTestDiaryForum(
    client: Client,
  ): Promise<ForumChannel> {
    const forum = (await client.channels.fetch(
      FORUM_IDS.DIARY,
    )) as ForumChannel | null;

    if (!forum || forum.type !== ChannelType.GuildForum) {
      throw new Error(DIARY_MESSAGES.FORUM_INVALID);
    }

    return forum;
  }

  private static async fetchDiaryThread(client: Client, threadId: string) {
    try {
      return await client.channels.fetch(threadId);
    } catch (error) {
      if (this.isUnknownChannelError(error)) {
        return null;
      }
      throw error;
    }
  }

  private static async insertDiary(
    threadId: string,
    creatorUserId: string,
    diaryType: DiaryType,
    isPrivate: boolean,
    isActive: boolean,
  ) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO diaries
         (thread_id, creator_user_id, type, is_private, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [threadId, creatorUserId, diaryType, isPrivate, isActive],
      );
    } finally {
      connection.release();
    }
  }

  private static async getDiaries(): Promise<DiaryRow[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<DiaryRow[] & RowDataPacket[]>(
        "SELECT * FROM diaries",
      );
      return rows as DiaryRow[];
    } finally {
      connection.release();
    }
  }

  private static async getDiaryByThreadId(
    threadId: string,
  ): Promise<DiaryRow | null> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<DiaryRow[] & RowDataPacket[]>(
        "SELECT * FROM diaries WHERE thread_id = ? LIMIT 1",
        [threadId],
      );
      return rows[0] ?? null;
    } finally {
      connection.release();
    }
  }

  private static async getDiaryByCreatorId(
    creatorUserId: string,
  ): Promise<DiaryRow | null> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<DiaryRow[] & RowDataPacket[]>(
        "SELECT * FROM diaries WHERE creator_user_id = ? LIMIT 1",
        [creatorUserId],
      );
      return rows[0] ?? null;
    } finally {
      connection.release();
    }
  }

  private static async closeDiaryIfInactive(client: Client, diary: DiaryRow) {
    try {
      if (!diary.is_active) {
        return;
      }

      const channel = await this.fetchDiaryThread(client, diary.thread_id);
      if (!channel || !channel.isThread()) {
        await this.setDiaryIsActive(diary.thread_id, false);
        return;
      }

      if (channel.archived) {
        await this.setDiaryIsActive(diary.thread_id, false);
        return;
      }

      const linkedUserIds = await AccountService.getLinkedAccountUserIds(
        diary.creator_user_id,
      );
      const hasRecentPost = await this.hasRecentPostFromLinkedAccounts(
        channel as ThreadChannel,
        linkedUserIds,
      );
      if (hasRecentPost) {
        return;
      }

      await (channel as ThreadChannel).setLocked(
        true,
        DIARY_MESSAGES.INACTIVE_CLOSE_REASON,
      );
      await (channel as ThreadChannel).setArchived(
        true,
        DIARY_MESSAGES.INACTIVE_CLOSE_REASON,
      );
      await this.setDiaryIsActive(diary.thread_id, false);
    } catch (error) {
      if (this.isUnknownChannelError(error)) {
        await this.setDiaryIsActive(diary.thread_id, false);
        return;
      }
      console.error(
        `closeDiaryIfInactive error: threadId=${diary.thread_id}`,
        error,
      );
    }
  }

  private static async syncDiaryThreadState(client: Client, diary: DiaryRow) {
    try {
      const channel = await this.fetchDiaryThread(client, diary.thread_id);
      if (!channel || !channel.isThread()) {
        await this.setDiaryIsActive(diary.thread_id, false);
        return;
      }
    } catch (error) {
      if (this.isUnknownChannelError(error)) {
        await this.setDiaryIsActive(diary.thread_id, false);
        return;
      }
      console.error(
        `syncDiaryThreadState error: threadId=${diary.thread_id}`,
        error,
      );
    }
  }

  private static isUnknownChannelError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 10003
    );
  }

  private static async hasRecentPostFromLinkedAccounts(
    thread: ThreadChannel,
    linkedUserIds: string[],
  ): Promise<boolean> {
    const threshold = Date.now() - this.INACTIVE_MS;
    let before: string | undefined;

    while (true) {
      const messages = await thread.messages.fetch({
        limit: 100,
        before,
      });

      if (messages.size === 0) {
        return false;
      }

      for (const message of messages.values()) {
        if (message.createdTimestamp < threshold) {
          return false;
        }

        if (linkedUserIds.includes(message.author.id)) {
          return true;
        }
      }

      before = messages.last()?.id;
      if (!before) {
        return false;
      }
    }
  }

  /**
   * 再開した日記レコードを更新
   * @param threadId 再開した日記のスレッドID
   * @param diaryType 再開した日記の種別
   * @param isPrivate 再開した日記の種別がprivateかどうか
   */
  private static async updateReopenedDiary(
    threadId: string,
    diaryType: DiaryType,
    isPrivate: boolean,
  ) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE diaries
         SET is_active = ?, type = ?, is_private = ?, updated_at = CURRENT_TIMESTAMP
         WHERE thread_id = ?`,
        [true, diaryType, isPrivate, threadId],
      );
    } finally {
      connection.release();
    }
  }

  private static async setDiaryIsActive(threadId: string, isActive: boolean) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        "UPDATE diaries SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE thread_id = ?",
        [isActive, threadId],
      );
    } finally {
      connection.release();
    }
  }

  private static async deleteDiaryRecord(threadId: string) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute("DELETE FROM diaries WHERE thread_id = ?", [
        threadId,
      ]);
    } finally {
      connection.release();
    }
  }

  private static async payDiaryPrice(userId: string, price: number) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE accounts
         SET wallet = wallet - ?
         WHERE user_id = ?`,
        [price, userId],
      );
    } finally {
      connection.release();
    }
  }

  private static async replyWithDiaryMessage(
    interaction: DiaryExecutionInteraction,
    mainMessage: string,
  ) {
    const content = mainMessage;

    if (interaction.deferred) {
      await interaction.editReply({ content });
      return;
    }

    await interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
    });
  }
}
