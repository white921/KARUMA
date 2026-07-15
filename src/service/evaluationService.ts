import {
  ChannelType,
  ChatInputCommandInteraction,
  ForumChannel,
  GuildMember,
  Message,
  TextChannel,
} from "discord.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import {
  ROLE_IDS,
  TEXT_CHANNEL_IDS,
  FORUM_IDS,
  CATEGORY_IDS,
} from "../constant/id";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { BASE_EVALUATION_DAYS } from "../constant/evaluation";
import { hasRole } from "../util/role";
import { EvaluationSheetArchiveService } from "./evaluationSheetArchiveService";

dayjs.extend(utc);
dayjs.extend(timezone);

export class EvaluationService {
  static validateCommandCategory(interaction: ChatInputCommandInteraction) {
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
    return [
      FORUM_IDS.AETHER_001,
      FORUM_IDS.AETHER_002,
    ];
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
    const now = dayjs().tz("Asia/Tokyo");
    const end = now.add(BASE_EVALUATION_DAYS, "day");
    return `〜 ${end.format("MM/DD")}`;
  }

  static createEvaluationSheetContent(
    targetMember: GuildMember,
    introductionMessageUrl: string,
  ): string {
    return EVALUATION_SHEET_MESSAGES.TEMPLATE.replace(
      "{introductionLink}",
      introductionMessageUrl,
    );
  }

  static async createEvaluationSheets(
    targetMember: GuildMember,
    introductionMessageUrl: string,
    createdByUserId: string,
  ) {
    const forumIds = this.getEvaluationForumIds();
    const createdThreads: { forumId: string; threadId: string }[] = [];
    const content = this.createEvaluationSheetContent(
      targetMember,
      introductionMessageUrl,
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
          name: targetMember.displayName + this.createEvaluationPeriodText(),
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
          const restoredCount = await EvaluationSheetArchiveService.attachArchivesToThread(
            targetMember.id,
            channel,
          );
          if (restoredCount > 0) {
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
    const match = title.match(/^(.*〜\s*)(\d{1,2})\/(\d{1,2})\s*$/);
    if (!match) {
      return null;
    }
    const [, base, mm, dd] = match;
    const month = Number(mm);
    const day = Number(dd);

    const candidates = [today.year() - 1, today.year(), today.year() + 1].map(
      (year) => today.year(year).month(month - 1).date(day).startOf("day"),
    );
    const endDate = candidates.reduce((best, cur) =>
      Math.abs(cur.diff(today, "day")) < Math.abs(best.diff(today, "day"))
        ? cur
        : best,
    );

    return { base, endDate };
  }

  static async extendAllEvaluationSheets(
    client: import("discord.js").Client,
    days: number,
    operatorId: string,
    options: { targetMember?: GuildMember | null; reason?: string | null } = {},
  ) {
    const { targetMember, reason } = options;
    const forumIds = this.getEvaluationForumIds();
    const today = dayjs().tz("Asia/Tokyo");
    const targetPrefix = targetMember
      ? `${targetMember.displayName}〜`
      : null;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const DELAY_MS = 500;

    let extendedCount = 0;
    const skipped: { thread: string; reason: string }[] = [];
    const failed: { thread: string; url: string; reason: string }[] = [];

    for (const forumId of forumIds) {
      let forum;
      try {
        forum = await client.channels.fetch(forumId);
      } catch (error: any) {
        failed.push({
          thread: `(forum:${forumId})`,
          url: "",
          reason: `フォーラム取得失敗: ${error.message}`,
        });
        continue;
      }
      if (!forum || forum.type !== ChannelType.GuildForum) {
        continue;
      }

      let active;
      try {
        active = await (forum as ForumChannel).threads.fetchActive();
      } catch (error: any) {
        failed.push({
          thread: `(forum:${forumId})`,
          url: "",
          reason: `スレッド一覧取得失敗: ${error.message}`,
        });
        continue;
      }

      for (const thread of active.threads.values()) {
        const parsed = this.parseTitleEndDate(thread.name, today);
        if (!parsed) {
          skipped.push({
            thread: thread.name,
            reason: "タイトルのフォーマット不一致",
          });
          continue;
        }

        if (targetPrefix && parsed.base.trimEnd() !== targetPrefix) {
          continue;
        }

        const newEnd = parsed.endDate.add(days, "day");
        const newTitle = `${parsed.base}${newEnd.format("MM/DD")}`;
        const threadUrl = `https://discord.com/channels/${thread.guildId}/${thread.id}`;

        try {
          await thread.setName(newTitle);
          const lines = [
            `📅 評価期間を ${days}日 延長しました: ${parsed.endDate.format(
              "MM/DD",
            )} → ${newEnd.format("MM/DD")}`,
            `by <@${operatorId}>`,
          ];
          if (reason) {
            lines.push(`理由: ${reason}`);
          }
          await thread.send(lines.join("\n"));
          extendedCount++;
        } catch (error: any) {
          failed.push({
            thread: thread.name,
            url: threadUrl,
            reason: error.message ?? String(error),
          });
        }

        await sleep(DELAY_MS);
      }
    }

    return { extendedCount, skipped, failed };
  }

  /*
   * 現在Aetherでは評価DBを使っていないため、旧評価管理機能は一旦停止。
   * 必要になったら以下を復活させる:
   * - evaluations テーブルのCRUD
   * - 招待/ボーナスによる評価期間延長
   * - 評価期間表示系コマンド
   */
}
