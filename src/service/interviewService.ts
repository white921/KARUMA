import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";

import { CATEGORY_IDS, ROLE_IDS } from "../constant/id";
import { INTERVIEW_MESSAGES } from "../constant/interview";
import { ACCOUNT_MESSAGES } from "../constant/account";
import { hasRole } from "../util/role";
import { AccountService } from "./accountService";

export class InterviewService {
  static validateCommandCategory(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel;
    const parentId =
      channel && "parentId" in channel ? channel.parentId : undefined;

    if (parentId !== CATEGORY_IDS.INTERVIEW) {
      throw new Error(INTERVIEW_MESSAGES.INVALID_CATEGORY);
    }
  }

  static async validateOperator(member: GuildMember) {
    if (
      !(await hasRole(member, ROLE_IDS.MENSTU_BUIGINNER)) &&
      !(await hasRole(member, ROLE_IDS.MENSTUKAN)) &&
      !(await hasRole(member, ROLE_IDS.MENSETU_LEADER)) &&
      !(await hasRole(member, ROLE_IDS.SIKKOKAN)) &&
      !(await hasRole(member, ROLE_IDS.SOUZOUSYU)) &&
      !(await hasRole(member, ROLE_IDS.GIJUTU_LEADER))
    ) {
      throw new Error(INTERVIEW_MESSAGES.NO_PERMISSION);
    }
  }

  static getVoiceChannelOrThrow(member: GuildMember) {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error(INTERVIEW_MESSAGES.NOT_IN_VOICE_CHANNEL);
    }
    return voiceChannel;
  }

  static async getInterviewTargetMembers(
    member: GuildMember,
  ): Promise<GuildMember[]> {
    const voiceChannel = this.getVoiceChannelOrThrow(member);
    const targets: GuildMember[] = [];

    for (const target of voiceChannel.members.values()) {
      if (target.user.bot) {
        continue;
      }
      if (await hasRole(target, ROLE_IDS.CORE_MEMBER_ROLES.SINMONMATI)) {
        targets.push(target);
      }
    }

    return targets;
  }

  static async resolveInterviewTargetMembers(
    operator: GuildMember,
    targetMember?: GuildMember | null,
  ): Promise<GuildMember[]> {
    if (targetMember) {
      return [targetMember];
    }

    return this.getInterviewTargetMembers(operator);
  }

  static async validateInterviewTarget(targetMember: GuildMember) {
    if (!(await hasRole(targetMember, ROLE_IDS.CORE_MEMBER_ROLES.SINMONMATI))) {
      throw new Error(INTERVIEW_MESSAGES.NO_SHINMONMATI_ROLE);
    }

    const hasAccount = await AccountService.hasAccount(targetMember.id);
    if (hasAccount) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_EXISTS);
    }
  }
}
