import {
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Role,
} from "discord.js";

import { AccountService } from "./accountService";

import { hasRole } from "../util/role";
import { hasAdminBankPanelPermission } from "../util/adminPermission";

import { INITIAL_WALLET } from "../constant/account";
import { ADMIN_MESSAGES } from "../constant/admin";
import { ADMIN_OPEN_ACCOUNT_MESSAGES } from "../constant/adminOpenAccount";
import { ROLE_IDS } from "../constant/id";

export class AdminOpenAccountService {
  static async validate(
    interaction: ChatInputCommandInteraction,
    targetRole: Role | null,
  ) {
    const member = interaction.member as GuildMember;

    if (!(await hasAdminBankPanelPermission(member))) {
      throw new Error(ADMIN_MESSAGES.NO_PERMISSION);
    }

    if (!targetRole) {
      throw new Error(ADMIN_OPEN_ACCOUNT_MESSAGES.ROLE_NOT_FOUND);
    }
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

      await AccountService.validateName(member.displayName);
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
