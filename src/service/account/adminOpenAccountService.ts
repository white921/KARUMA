import {
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
} from "discord.js";

import { AccountService } from "./accountService";

import { hasRole } from "../../util/member/role";
import { assertManagementPermission } from "../../util/shared/managementPermission";

import { INITIAL_WALLET } from "../../constant/account/account";
import { ROLE_IDS } from "../../constant/shared/id";

export class AdminOpenAccountService {
  static async validate(
    interaction: ChatInputCommandInteraction,
  ) {
    await assertManagementPermission(interaction);
  }

  static async createAccountsForRole(
    members: Collection<string, GuildMember>,
  ): Promise<{
    openedMembers: GuildMember[];
    skippedMembers: {
      member: GuildMember;
      reason: "bot" | "subAccount" | "accountExists";
    }[];
  }> {
    const openedMembers: GuildMember[] = [];
    const skippedMembers: {
      member: GuildMember;
      reason: "bot" | "subAccount" | "accountExists";
    }[] = [];

    for (const member of members.values()) {
      if (member.user.bot) {
        skippedMembers.push({ member, reason: "bot" });
        continue;
      }

      if (await hasRole(member, ROLE_IDS.SUB_ACCOUNT)) {
        skippedMembers.push({ member, reason: "subAccount" });
        continue;
      }

      if (await AccountService.hasAccount(member.id)) {
        skippedMembers.push({ member, reason: "accountExists" });
        continue;
      }

      await AccountService.validateName(member.displayName, member.guild);
      await AccountService.createAccount(
        member.id,
        member.displayName,
        INITIAL_WALLET,
      );
      openedMembers.push(member);
    }

    return {
      openedMembers,
      skippedMembers,
    };
  }
}
