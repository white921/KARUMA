import { ButtonInteraction, GuildMember } from "discord.js";
import dayjs, { Dayjs } from "dayjs";

import { HAZAMA_ACCESS_DURATION_HOURS, HAZAMA_MESSAGES, HAZAMA_PRICE } from "../constant/hazama";
import { BOT_ID, ROLE_IDS } from "../constant/id";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { Account } from "../type/account";
import { addRole, hasRole } from "../util/role";
import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

export function calculateHazamaAccessExpireAt(now = dayjs()): Dayjs {
  return now.add(HAZAMA_ACCESS_DURATION_HOURS, "hour");
}

export class HazamaService {
  static async isFree(member: GuildMember): Promise<boolean> {
    return (
      (await hasRole(member, ROLE_IDS.HAZAMA_LEADER)) ||
      (await hasRole(member, ROLE_IDS.HAZAMA_STAFF))
    );
  }

  static async getPrice(): Promise<number> {
    return HAZAMA_PRICE;
  }

  static async validateWallet(userAccount: Account): Promise<void> {
    if (userAccount.wallet < HAZAMA_PRICE) {
      throw new Error(HAZAMA_MESSAGES.NOT_ENOUGH_BALANCE);
    }
  }

  static async purchase(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    if (await this.isFree(member)) {
      await interaction.reply({
        content: HAZAMA_MESSAGES.FREE_ACCESS,
        ephemeral: true,
      });
      return;
    }

    if (await hasRole(member, ROLE_IDS.HAZAMA_ACCESS)) {
      throw new Error(HAZAMA_MESSAGES.ALREADY_HAS_ROLE);
    }

    const userId = interaction.user.id;
    const userAccount = (await AccountService.getAccountByUserId(userId))[0];
    const botAccount = (await AccountService.getAccountByUserId(BOT_ID))[0];
    await this.validateWallet(userAccount);

    const afterWallet = userAccount.wallet - HAZAMA_PRICE;
    const expireAt = calculateHazamaAccessExpireAt();
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?;",
        [afterWallet, userId],
      );
      await connection.execute(
        `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at) VALUES (?, ?, FALSE, ?)
          ON DUPLICATE KEY UPDATE is_deleted = FALSE, expire_at = VALUES(expire_at), updated_at = CURRENT_TIMESTAMP;`,
        [userId, ROLE_IDS.HAZAMA_ACCESS, expireAt.toDate()],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    try {
      await addRole(member, ROLE_IDS.HAZAMA_ACCESS);
    } catch (error) {
      const rollbackConnection = await DbService.getConnection();
      try {
        await rollbackConnection.beginTransaction();
        await rollbackConnection.execute(
          "UPDATE accounts SET wallet = ? WHERE user_id = ?;",
          [userAccount.wallet, userId],
        );
        await rollbackConnection.execute(
          "UPDATE role_management_logs SET is_deleted = TRUE WHERE user_id = ? AND role_id = ?;",
          [userId, ROLE_IDS.HAZAMA_ACCESS],
        );
        await rollbackConnection.commit();
      } catch (rollbackError) {
        await rollbackConnection.rollback();
        console.error("HazamaService.purchase rollback error:", rollbackError);
      } finally {
        rollbackConnection.release();
      }
      throw error;
    }

    await ActionService.executeActionLog(
      interaction,
      PANEL_COMMAND_NAMES.HAZAMA_ACCESS,
      HAZAMA_PRICE,
      userId,
      botAccount.user_id,
      afterWallet,
      botAccount.wallet,
      `${HAZAMA_MESSAGES.ACCESS}を購入しました。`,
    );

    const jstExpireDateTime = expireAt.toDate().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    await interaction.editReply({
      content: `${HAZAMA_MESSAGES.ACCESS}を購入しました。\n有効期限は${jstExpireDateTime}までです。`,
      embeds: [],
      components: [],
    });
  }
}
