import { Client, GuildMember, PartialGuildMember } from "discord.js";
import { RowDataPacket } from "mysql2";

import {
  SERVER_BOOST_AFTER_REWARD,
  SERVER_BOOST_FIRST_REWARD,
  SERVER_BOOST_HIGH_REWARD_COUNT,
} from "../constant/salary";
import { COMMAND_NAMES } from "../constant/command";
import { BOT_ID } from "../constant/id";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

type BoostAccountRow = RowDataPacket & {
  user_id: string;
  wallet: number;
  boost_count: number;
};

export type ServerBoostReward = {
  amount: number;
  boostCount: number;
  comment: string;
};

export function isNewServerBoost(
  oldPremiumSinceTimestamp: number | null,
  newPremiumSinceTimestamp: number | null,
): boolean {
  return oldPremiumSinceTimestamp === null && newPremiumSinceTimestamp !== null;
}

export function getServerBoostRewardAmount(boostCount: number): number {
  return boostCount <= SERVER_BOOST_HIGH_REWARD_COUNT
    ? SERVER_BOOST_FIRST_REWARD
    : SERVER_BOOST_AFTER_REWARD;
}

export class ServerBoostService {
  static async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
    client: Client,
  ): Promise<void> {
    const boostStartedAt = newMember.premiumSinceTimestamp;
    if (
      newMember.user.bot ||
      !isNewServerBoost(oldMember.premiumSinceTimestamp, boostStartedAt) ||
      boostStartedAt === null
    ) {
      return;
    }

    const reward = await this.rewardServerBoost(newMember.id, boostStartedAt);
    if (!reward) {
      return;
    }

    await ActionService.createActionLogMessage(
      { client },
      COMMAND_NAMES.SERVER_BOOST,
      reward.amount,
      BOT_ID,
      newMember.id,
      reward.comment,
    );
  }

  static async rewardServerBoost(
    userId: string,
    boostStartedAt: number,
  ): Promise<ServerBoostReward | null> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();

      const [subAccountRows] = await connection.execute<RowDataPacket[]>(
        "SELECT 1 FROM sub_accounts WHERE sub_user_id = ? LIMIT 1",
        [userId],
      );
      if (subAccountRows.length > 0) {
        await connection.rollback();
        return null;
      }

      const [accountRows] = await connection.execute<BoostAccountRow[]>(
        `SELECT user_id, wallet, boost_count
         FROM accounts
         WHERE user_id IN (?, ?)
         FOR UPDATE`,
        [userId, BOT_ID],
      );
      const recipient = accountRows.find((account) => account.user_id === userId);
      const botAccount = accountRows.find(
        (account) => account.user_id === BOT_ID,
      );
      if (!recipient || !botAccount) {
        await connection.rollback();
        return null;
      }

      const boostCount = Number(recipient.boost_count) + 1;
      const amount = getServerBoostRewardAmount(boostCount);
      const afterWallet = Number(recipient.wallet) + amount;
      const comment = `サーバーブースト${boostCount}回目の報酬`;

      await connection.execute(
        `INSERT INTO server_boost_rewards
         (user_id, boost_started_at, boost_count, amount)
         VALUES (?, ?, ?, ?)`,
        [userId, boostStartedAt, boostCount, amount],
      );
      await connection.execute(
        `UPDATE accounts
         SET wallet = ?, boost_count = ?
         WHERE user_id = ?`,
        [afterWallet, boostCount, userId],
      );
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          COMMAND_NAMES.SERVER_BOOST,
          amount,
          BOT_ID,
          userId,
          botAccount.wallet,
          afterWallet,
          comment,
        ],
      );
      await connection.commit();

      return { amount, boostCount, comment };
    } catch (error: unknown) {
      await connection.rollback();
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ER_DUP_ENTRY"
      ) {
        return null;
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}
