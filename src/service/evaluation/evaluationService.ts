import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  ChannelType,
  ChatInputCommandInteraction,
  ForumChannel,
  GuildMember,
  Message,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { EVALUATION_SHEET_EXTEND_DELAY_MS } from "../../constant/evaluation/evaluationSheet";

import { BASE_EVALUATION_DAYS } from "../../constant/evaluation/evaluation";
import {
  EVALUATION_SHEET_FORUM_IDS,
  EVALUATION_SHEET_MESSAGES,
} from "../../constant/evaluation/evaluationSheet";
import { CATEGORY_IDS, ROLE_IDS, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { hasSystemAdminRole } from "../../util/shared/operatorPermission";
import { hasRole } from "../../util/member/role";
import { EvaluationSheetArchiveService } from "./evaluationSheetArchiveService";

dayjs.extend(utc);
dayjs.extend(timezone);

export class EvaluationService {
  static validateCommandCategory(interaction: ChatInputCommandInteraction) {
    if (hasSystemAdminRole(interaction.member)) return;
    const channel = interaction.channel;
    const parentId =
      channel && "parentId" in channel ? channel.parentId : undefined;

    if (parentId !== CATEGORY_IDS.INTERVIEW) {
      throw new Error(EVALUATION_SHEET_MESSAGES.INVALID_CATEGORY);
    }
  }

  static getVoiceChannelOrThrow(member: GuildMember) {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error(EVALUATION_SHEET_MESSAGES.NOT_IN_VOICE_CHANNEL);
    }
    return voiceChannel;
  }

  static async getEvaluationTargetMembers(
    member: GuildMember,
  ): Promise<GuildMember[]> {
    const voiceChannel = this.getVoiceChannelOrThrow(member);
    const targets: GuildMember[] = [];

    for (const target of voiceChannel.members.values()) {
      if (target.user.bot) {
        continue;
      }
      if (await hasRole(target, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN)) {
        targets.push(target);
      }
    }

    return targets;
  }

  static async resolveEvaluationTargetMembers(
    operator: GuildMember,
    targetMember?: GuildMember | null,
  ): Promise<GuildMember[]> {
    if (targetMember) {
      return [targetMember];
    }

    return this.getEvaluationTargetMembers(operator);
  }

  static async validateEvaluationTarget(targetMember: GuildMember) {
    if (!(await hasRole(targetMember, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN))) {
      throw new Error(EVALUATION_SHEET_MESSAGES.NO_KARIMEN_ROLE);
    }
  }

  static getEvaluationForumIds() {
    return [...EVALUATION_SHEET_FORUM_IDS];
  }

  static async getIntroductionChannelId(
    targetMember: GuildMember,
  ): Promise<string> {
    const hasMaleRole = await hasRole(
      targetMember,
      ROLE_IDS.BASIC_ROLE_IDS.OSU,
    );
    const hasFemaleRole = await hasRole(
      targetMember,
      ROLE_IDS.BASIC_ROLE_IDS.MESU,
    );

    if ((hasMaleRole && hasFemaleRole) || (!hasMaleRole && !hasFemaleRole)) {
      throw new Error(EVALUATION_SHEET_MESSAGES.INVALID_GENDER_ROLE);
    }

    if (hasMaleRole) {
      return TEXT_CHANNEL_IDS.INTRO_MALE;
    }

    return TEXT_CHANNEL_IDS.INTRO_FEMALE;
  }

  static async findLatestIntroductionMessage(
    targetMember: GuildMember,
  ): Promise<Message<true>> {
    const channelId = await this.getIntroductionChannelId(targetMember);
    const channel = await targetMember.client.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(EVALUATION_SHEET_MESSAGES.INTRODUCTION_NOT_FOUND);
    }

    let before: string | undefined;

    while (true) {
      const messages = await (channel as TextChannel).messages.fetch({
        limit: 30,
        before,
      });

      if (messages.size === 0) {
        break;
      }

      const introductionMessage = messages.find(
        (message) => message.author.id === targetMember.id,
      );

      if (introductionMessage) {
        return introductionMessage;
      }

      before = messages.last()?.id;
    }

    throw new Error(EVALUATION_SHEET_MESSAGES.INTRODUCTION_NOT_FOUND);
  }

  static createIntroductionMessageUrl(message: Message<true>): string {
    return `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
  }

  static createEvaluationPeriodText(): string {
    return `〜${this.createEvaluationEndDateText()}`;
  }

  static createEvaluationEndDateText(): string {
    return dayjs()
      .tz("Asia/Tokyo")
      .add(BASE_EVALUATION_DAYS, "day")
      .format("MM/DD");
  }

  static createEvaluationSheetContent(
    targetMember: GuildMember,
    introductionMessageUrl: string,
    endDateText = this.createEvaluationEndDateText(),
  ): string {
    return EVALUATION_SHEET_MESSAGES.TEMPLATE
      .replace("{introductionLink}", introductionMessageUrl)
      .replace("{userId}", targetMember.id)
      .replace("{endDate}", endDateText);
  }

  static async createEvaluationSheets(
    targetMember: GuildMember,
    introductionMessageUrl: string,
    createdByUserId: string,
  ) {
    const forumIds = this.getEvaluationForumIds();
    const createdThreads: { forumId: string; threadId: string }[] = [];
    const endDateText = this.createEvaluationEndDateText();
    const content = this.createEvaluationSheetContent(
      targetMember,
      introductionMessageUrl,
      endDateText,
    );

    try {
      for (const forumId of forumIds) {
        const forum = await targetMember.client.channels.fetch(forumId);
        if (!forum || forum.type !== ChannelType.GuildForum) {
          throw new Error(
            EVALUATION_SHEET_MESSAGES.CREATE_EVALUATION_SHEET_ERROR,
          );
        }

        const thread = await (forum as ForumChannel).threads.create({
          name: `${targetMember.displayName}〜${endDateText}`,
          message: {
            content,
          },
        });
        createdThreads.push({ forumId, threadId: thread.id });
      }

      await EvaluationSheetArchiveService.registerActiveSheets(
        targetMember.id,
        createdByUserId,
        createdThreads,
      );
    } catch (error) {
      await Promise.all(
        createdThreads.map(async ({ threadId }) => {
          const channel = await targetMember.client.channels.fetch(threadId).catch(() => null);
          if (channel?.isThread()) {
            await channel.delete("評価シートのDB登録に失敗したため削除").catch(() => undefined);
          }
        }),
      );
      throw error;
    }

    const restoredForumIds: string[] = [];
    const restoreFailures: { forumId: string; reason: string }[] = [];
    for (const { forumId, threadId } of createdThreads) {
      try {
        const channel = await targetMember.client.channels.fetch(threadId);
        if (channel?.isThread()) {
          const restored = await EvaluationSheetArchiveService.attachLatestArchiveToThread(
            targetMember.id,
            channel,
          );
          if (restored) {
            restoredForumIds.push(forumId);
          }
        }
      } catch (error: any) {
        restoreFailures.push({
          forumId,
          reason: error?.message ?? String(error),
        });
      }
    }

    return {
      createdForumIds: createdThreads.map(({ forumId }) => forumId),
      restoredForumIds,
      restoreFailures,
    };
  }

  static parseTitleEndDate(
    title: string,
    today: dayjs.Dayjs,
  ): { base: string; endDate: dayjs.Dayjs } | null {
    const match = title.match(/^(.*[〜～]\s*)(\d{1,2})\/(\d{1,2})\s*$/);
    if (!match) {
      return null;
    }
    const [, base, mm, dd] = match;
    const month = Number(mm);
    const day = Number(dd);

    const candidates = [today.year() - 1, today.year(), today.year() + 1]
      .map((year) => today.date(1).year(year).month(month - 1).date(day).startOf("day"))
      .filter((candidate) => candidate.month() === month - 1 && candidate.date() === day);
    if (!candidates.length) return null;
    const endDate = candidates.reduce((best, cur) =>
      Math.abs(cur.diff(today, "day")) < Math.abs(best.diff(today, "day"))
        ? cur
        : best,
    );

    return { base, endDate };
  }

  static async updateStarterMessageEndDate(
    thread: Pick<ThreadChannel, "fetchStarterMessage">,
    endDateText: string,
  ): Promise<boolean> {
    const starterMessage = await thread.fetchStarterMessage();
    if (!starterMessage) {
      return false;
    }

    const updatedContent = starterMessage.content.replace(
      /(^|\n)終了日:\s*\d{1,2}\/\d{1,2}(?=\s*(?:\n|$))/,
      `$1終了日: ${endDateText}`,
    );
    if (updatedContent === starterMessage.content) {
      return false;
    }

    await starterMessage.edit({ content: updatedContent });
    return true;
  }

  static createEvaluationExtensionLog(
    days: number,
    previousEndDate: string,
    newEndDate: string,
    operatorDisplayName: string,
    reason?: string | null,
  ): string {
    const operation = days < 0 ? "短縮" : "延長";
    const displayDays = Math.abs(days);
    const lines = [
      `📅 評価期間を ${displayDays}日 ${operation}しました: ${previousEndDate} → ${newEndDate}`,
      `by ${operatorDisplayName}`,
    ];
    if (reason) {
      lines.push(`理由: ${reason}`);
    }
    return lines.join("\n");
  }

  /** 更新中にアーカイブ順が変わっても漏れないよう、変更前に全ページを読み切る。 */
  static async fetchAllEvaluationThreads(forum: ForumChannel): Promise<ThreadChannel[]> {
    const threads = new Map<string, ThreadChannel>();
    const active = await forum.threads.fetchActive();
    for (const thread of active.threads.values()) {
      if (thread.parentId === forum.id) threads.set(thread.id, thread);
    }
    let before: Date | undefined;
    while (true) {
      const archived = await forum.threads.fetchArchived({ type: "public", limit: 100, before });
      for (const thread of archived.threads.values()) {
        if (thread.parentId === forum.id) threads.set(thread.id, thread);
      }
      if (!archived.hasMore) break;
      const timestamp = archived.threads.last()?.archiveTimestamp;
      if (!timestamp || (before && timestamp >= before.getTime())) {
        throw new Error("アーカイブ一覧を最後まで取得できませんでした");
      }
      before = new Date(timestamp);
    }
    return [...threads.values()];
  }

  /** ロックは変更しない。管理権限で一時的に開き、失敗時もアーカイブ状態を戻す。 */
  static async applyEvaluationExtension(
    thread: ThreadChannel, newTitle: string, newEndDate: string, log: string,
  ): Promise<void> {
    const wasArchived = thread.archived === true;
    const errors: string[] = [];
    let titleUpdated = false;
    let bodyUpdated = false;
    let restoreArchive = false;
    try {
      const starter = await thread.fetchStarterMessage();
      if (!starter || !/(^|\n)終了日:\s*\d{1,2}\/\d{1,2}(?=\s*(?:\n|$))/.test(starter.content)) {
        throw new Error("最初の投稿の終了日を取得できません");
      }
      if (starter.author.id !== thread.client.user?.id) throw new Error("最初の投稿をBotが編集できません");
      if (wasArchived) {
        restoreArchive = true;
        await thread.setArchived(false, "評価期間の変更のため一時的に開く");
      }
      if (!starter.editable) throw new Error("最初の投稿をBotが編集できません");
      await thread.setName(newTitle);
      titleUpdated = true;
      const content = starter.content.replace(
        /(^|\n)終了日:\s*\d{1,2}\/\d{1,2}(?=\s*(?:\n|$))/, `$1終了日: ${newEndDate}`,
      );
      await starter.edit({ content });
      bodyUpdated = true;
      await thread.send({ content: log, allowedMentions: { parse: [] } });
    } catch (error: any) {
      errors.push(`${error?.message ?? String(error)}（タイトル${titleUpdated ? "更新済み" : "未更新"}・本文${bodyUpdated ? "更新済み" : "未更新"}）`);
    } finally {
      if (restoreArchive) {
        try { await thread.setArchived(true, "評価期間の変更後、元のアーカイブ状態に戻す"); }
        catch (error: any) { errors.push(`元のアーカイブ状態への復帰に失敗: ${error?.message ?? String(error)}`); }
      }
    }
    if (errors.length) throw new Error(errors.join(" / "));
  }

  static async extendAllEvaluationSheets(
    client: import("discord.js").Client,
    days: number,
    operatorDisplayName: string,
    options: { targetMember?: GuildMember | null; reason?: string | null } = {},
  ) {
    const { targetMember, reason } = options;
    const forumIds = this.getEvaluationForumIds();
    const today = dayjs().tz("Asia/Tokyo");
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    let extendedCount = 0;
    const skipped: { thread: string; reason: string }[] = [];
    const failed: { thread: string; url: string; reason: string }[] = [];

    // 各フォーラム内は順番に処理し、4フォーラムを並行して待ち時間を抑える。
    // 実際のAPIレート制限はdiscord.jsに任せ、各フォーラムの処理間隔も維持する。
    await Promise.all(forumIds.map(async (forumId) => {
      let forum;
      try {
        forum = await client.channels.fetch(forumId, { force: true });
      } catch (error: any) {
        failed.push({
          thread: `(forum:${forumId})`,
          url: "",
          reason: `フォーラム取得失敗: ${error.message}`,
        });
        return;
      }
      if (!forum || forum.type !== ChannelType.GuildForum) {
        failed.push({ thread: `(forum:${forumId})`, url: "", reason: "評価フォーラムが見つかりません" });
        return;
      }

      let threads: ThreadChannel[];
      try {
        threads = await this.fetchAllEvaluationThreads(forum as ForumChannel);
      } catch (error: any) {
        failed.push({
          thread: `(forum:${forumId})`,
          url: "",
          reason: `スレッド一覧取得失敗: ${error.message}`,
        });
        return;
      }

      for (const candidate of threads) {
        if (targetMember) {
          const candidateDate = this.parseTitleEndDate(candidate.name, today);
          if (candidateDate?.base.replace(/[〜～]\s*$/, "").trimEnd() !== targetMember.displayName) continue;
        }
        let thread: ThreadChannel;
        try {
          // 収集中のアーカイブ・改名を反映した状態を保存してから更新する。
          thread = await candidate.fetch(true);
        } catch (error: any) {
          failed.push({ thread: candidate.name, url: candidate.url, reason: `スレッド再取得失敗: ${error.message}` });
          continue;
        }
        const parsed = this.parseTitleEndDate(thread.name, today);
        if (!parsed) {
          skipped.push({
            thread: thread.name,
            reason: "タイトルのフォーマット不一致",
          });
          continue;
        }

        if (targetMember && parsed.base.replace(/[〜～]\s*$/, "").trimEnd() !== targetMember.displayName) {
          continue;
        }

        const newEnd = parsed.endDate.add(days, "day");
        const newTitle = `${parsed.base.trimEnd()}${newEnd.format("MM/DD")}`;
        const threadUrl = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

        try {
          await this.applyEvaluationExtension(
            thread, newTitle, newEnd.format("MM/DD"),
            this.createEvaluationExtensionLog(
              days,
              parsed.endDate.format("MM/DD"),
              newEnd.format("MM/DD"),
              operatorDisplayName,
              reason,
            ),
          );
          extendedCount++;
        } catch (error: any) {
          failed.push({
            thread: thread.name,
            url: threadUrl,
            reason: error.message ?? String(error),
          });
        }

        await sleep(EVALUATION_SHEET_EXTEND_DELAY_MS);
      }
    }));

    return { extendedCount, skipped, failed };
  }

  /*
   * LEVELIAでは評価DBを使っていないため、旧評価管理機能は一旦停止。
   * 必要になったら以下を復活させる:
   * - evaluations テーブルのCRUD
   * - 招待/ボーナスによる評価期間延長
   * - 評価期間表示系コマンド
   */
}
