import {
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Role,
} from "discord.js";

import { Account } from "../type/account";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { hasRole } from "../util/role";

import { COMMAND_NAMES } from "../constant/command";
import { AETHER_BOT_ID, ROLE_IDS } from "../constant/id";
import { ROLE_BASED_SEND_MESSAGES } from "../constant/roleBasedSend";
import { SEND_MESSAGES } from "../constant/send";
import { CURRENCY_NAMES } from "../constant/currency";
import { formatNumber } from "../util/number";

type SkipReason = "bot" | "subAccount" | "accountNotFound";

type TargetUser = {
  member: GuildMember;
  account: Account;
};

export class RoleBasedSendService {
  static async execute(
    interaction: ChatInputCommandInteraction,
    targetRole: Role | null,
    amount: number,
    comment: string,
  ) {
    await this.validate(interaction, targetRole, amount);

    const aetherBotAccount = (
      await AccountService.getAccountByUserId(AETHER_BOT_ID)
    )[0];
    const members = await interaction.guild!.members.fetch();
    const targetMembers = members.filter((member) =>
      member.roles.cache.has(targetRole!.id),
    );

    if (targetMembers.size === 0) {
      throw new Error(ROLE_BASED_SEND_MESSAGES.NO_TARGETS);
    }

    const { sendTargets, skippedMembers } = await this.classifyTargets(
      targetMembers,
    );

    if (sendTargets.length > 0) {
      await this.sendToTargets(
        interaction,
        interaction.user.id,
        aetherBotAccount.wallet,
        sendTargets,
        amount,
        comment,
      );
    }

    await interaction.editReply({
      content: this.createResultMessage(
        targetRole!,
        amount,
        sendTargets,
        skippedMembers,
        comment,
      ),
    });
  }

  static async validate(
    interaction: ChatInputCommandInteraction,
    targetRole: Role | null,
    amount: number,
  ) {
    const member = interaction.member as GuildMember;

    if (
      !(await hasRole(member, ROLE_IDS.SIKKOKAN)) &&
      !(await hasRole(member, ROLE_IDS.SOUZOUSYU)) &&
      !(await hasRole(member, ROLE_IDS.GIJUTU_LEADER))
    ) {
      throw new Error(ROLE_BASED_SEND_MESSAGES.NO_PERMISSION);
    }

    if (!targetRole) {
      throw new Error(ROLE_BASED_SEND_MESSAGES.ROLE_NOT_FOUND);
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(SEND_MESSAGES.IS_NOT_INT);
    }
  }

  static async classifyTargets(
    members: Collection<string, GuildMember>,
  ): Promise<{
    sendTargets: TargetUser[];
    skippedMembers: { member: GuildMember; reason: SkipReason }[];
  }> {
    const sendTargets: TargetUser[] = [];
    const skippedMembers: { member: GuildMember; reason: SkipReason }[] = [];

    for (const member of members.values()) {
      if (member.user.bot) {
        skippedMembers.push({ member, reason: "bot" });
        continue;
      }

      if (
        (await AccountService.isSubAccount(member.id)) ||
        (await hasRole(member, ROLE_IDS.SUB_ACCOUNT))
      ) {
        skippedMembers.push({ member, reason: "subAccount" });
        continue;
      }

      if (!(await AccountService.hasAccount(member.id))) {
        skippedMembers.push({ member, reason: "accountNotFound" });
        continue;
      }
      const account = (await AccountService.getAccountByUserId(member.id))[0];

      sendTargets.push({ member, account });
    }

    return { sendTargets, skippedMembers };
  }

  static async sendToTargets(
    interaction: ChatInputCommandInteraction,
    fromUserId: string,
    aetherBotWallet: number,
    sendTargets: TargetUser[],
    amount: number,
    comment: string,
  ) {
    const connection = await DbService.getConnection();

    try {
      for (const target of sendTargets) {
        const toAfterWallet = target.account.wallet + amount;

        await connection.execute(
          `UPDATE accounts
           SET wallet = ?
           WHERE user_id = ?;`,
          [toAfterWallet, target.member.id],
        );

        await ActionService.executeActionLog(
          interaction,
          COMMAND_NAMES.ROLE_BASED_SEND,
          amount,
          fromUserId,
          target.member.id,
          aetherBotWallet,
          toAfterWallet,
          comment,
        );
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  static createResultMessage(
    targetRole: Role,
    amount: number,
    sendTargets: TargetUser[],
    skippedMembers: { member: GuildMember; reason: SkipReason }[],
    comment: string,
  ) {
    const totalAmount = sendTargets.length * amount;
    const skippedByReason = {
      bot: skippedMembers
        .filter((result) => result.reason === "bot")
        .map((result) => result.member.id),
      subAccount: skippedMembers
        .filter((result) => result.reason === "subAccount")
        .map((result) => result.member.id),
      accountNotFound: skippedMembers
        .filter((result) => result.reason === "accountNotFound")
        .map((result) => result.member.id),
    };

    return (
      `✅ ロール <@&${targetRole.id}> への一括付与が完了しました。\n` +
      `1人あたりの付与額: ${formatNumber(amount)}${CURRENCY_NAMES}\n` +
      `付与成功人数: ${sendTargets.length}\n` +
      `合計付与額: ${formatNumber(totalAmount)}${CURRENCY_NAMES}\n` +
      `付与先: ${this.formatMemberList(sendTargets.map((target) => target.member.id))}\n` +
      `口座未開設でスキップ: ${this.formatMemberList(skippedByReason.accountNotFound)}\n` +
      `サブ垢でスキップ: ${this.formatMemberList(skippedByReason.subAccount)}\n` +
      `Botのためスキップ: ${this.formatMemberList(skippedByReason.bot)}` +
      (comment ? `\n備考: ${comment}` : "")
    );
  }

  static formatMemberList(memberIds: string[]) {
    if (memberIds.length === 0) {
      return "なし";
    }

    return memberIds.map((memberId) => `<@${memberId}>`).join(", ");
  }
}
