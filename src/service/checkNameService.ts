import { ChannelType, GuildMember } from "discord.js";

import { hasRole, isTechnician } from "../util/role";

import { AccountService } from "./accountService";

import { ROLE_IDS } from "../constant/id";
import { CHECK_NAME_MESSAGES } from "../constant/checkName";

type ValidateVcMemberNamesResult = {
  successes: GuildMember[];
  failures: { member: GuildMember; reason: string }[];
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
        !(await hasRole(user, ROLE_IDS.MENSETU_LEADER))
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
   * 実行者が参加中のVCから審問待ちロール付きメンバーを取得
   */
  static async getVcShinmonmatiMembers(user: GuildMember): Promise<GuildMember[]> {
    const voiceChannel = user.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error(CHECK_NAME_MESSAGES.NOT_IN_VOICE_CHANNEL);
    }

    const targets: GuildMember[] = [];

    for (const member of voiceChannel.members.values()) {
      if (member.user.bot) {
        continue;
      }

      if (await hasRole(member, ROLE_IDS.CORE_MEMBER_ROLES.SINMONMATI)) {
        targets.push(member);
      }
    }

    if (targets.length === 0) {
      throw new Error(CHECK_NAME_MESSAGES.NO_TARGET_USERS);
    }

    return targets;
  }

  /**
   * 実行者が参加中のVC内の審問待ちメンバーをまとめて名前チェック
   */
  static async validateVcMemberNames(
    user: GuildMember,
  ): Promise<ValidateVcMemberNamesResult> {
    await this.validateOperator(user);
    const targets = await this.getVcShinmonmatiMembers(user);

    const successes: GuildMember[] = [];
    const failures: { member: GuildMember; reason: string }[] = [];

    for (const member of targets) {
      try {
        await AccountService.validateName(member.displayName, member.id);
        successes.push(member);
      } catch (error: any) {
        failures.push({
          member,
          reason: error.message ?? "❌ 不明なエラーです。",
        });
      }
    }

    return { successes, failures };
  }
}
