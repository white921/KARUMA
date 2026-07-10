import { ChannelType, GuildMember } from "discord.js";

import { hasRole, isTechnician } from "../util/role";

import { AccountService } from "./accountService";

import { ROLE_IDS } from "../constant/id";
import { CHECK_NAME_MESSAGES } from "../constant/checkName";

type ValidateVcMemberNamesResult = {
  successes: GuildMember[];
  failures: { member: GuildMember; reason: string }[];
  warnings: { member: GuildMember; reason: string }[];
};

export class CheckNameService {
  /**
   * 実行者の権限チェック
   */
  static async validateOperator(user: GuildMember) {
    if (!(await isTechnician(user)) || user.id == "1251952925043982338") {
      if (
        !(await hasRole(user, ROLE_IDS.MENSTU_BUIGINNER)) &&
        !(await hasRole(user, ROLE_IDS.MENSTUKAN)) &&
        !(await hasRole(user, ROLE_IDS.MENSETU_LEADER)) &&
        !(await hasRole(user, ROLE_IDS.GIJUTU_LEADER))
      ) {
        throw new Error(CHECK_NAME_MESSAGES.NO_PERMISSION);
      }
    }
  }

  /**
   * 単一ユーザーの名前バリデーション
   */
  static async validateCheckName(member: GuildMember, user: GuildMember) {
    await this.validateOperator(user);
    await AccountService.validateName(member.displayName, member.id);
  }

  /**
   * 実行者が参加中のVCから面接待ちロール付きメンバーを取得
   */
  static async getVcInterviewWaitingMembers(
    user: GuildMember,
  ): Promise<GuildMember[]> {
    const voiceChannel = user.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error(CHECK_NAME_MESSAGES.NOT_IN_VOICE_CHANNEL);
    }

    const targets: GuildMember[] = [];

    for (const member of voiceChannel.members.values()) {
      if (member.user.bot) {
        continue;
      }

      if (await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI)) {
        targets.push(member);
      }
    }

    if (targets.length === 0) {
      throw new Error(CHECK_NAME_MESSAGES.NO_TARGET_USERS);
    }

    return targets;
  }

  /**
   * 実行者が参加中のVC内の面接待ちメンバーをまとめて名前チェック
   */
  static async validateVcMemberNames(
    user: GuildMember,
  ): Promise<ValidateVcMemberNamesResult> {
    await this.validateOperator(user);
    const targets = await this.getVcInterviewWaitingMembers(user);
    const guildMembers = await user.guild.members.fetch();

    const successes: GuildMember[] = [];
    const failures: { member: GuildMember; reason: string }[] = [];
    const warnings: { member: GuildMember; reason: string }[] = [];

    for (const member of targets) {
      try {
        // 同名は変更相談の対象であり、名前チェックでは不合格にしない。
        AccountService.validateNameFormat(member.displayName);
        successes.push(member);

        const duplicateMember = this.findDuplicateDisplayName(
          member,
          guildMembers.values(),
        );
        if (duplicateMember) {
          warnings.push({
            member,
            reason: CHECK_NAME_MESSAGES.DUPLICATE_NAME(duplicateMember.id),
          });
        }
      } catch (error: any) {
        failures.push({
          member,
          reason: error.message ?? "❌ 不明なエラーです。",
        });
      }
    }

    return { successes, failures, warnings };
  }

  /**
   * 同じ表示名の人間ユーザーを検索する。本人とBotは比較対象外。
   */
  static findDuplicateDisplayName(
    member: GuildMember,
    guildMembers: Iterable<GuildMember>,
  ): GuildMember | undefined {
    for (const guildMember of guildMembers) {
      if (
        guildMember.id !== member.id &&
        !guildMember.user.bot &&
        guildMember.displayName === member.displayName
      ) {
        return guildMember;
      }
    }
  }
}
