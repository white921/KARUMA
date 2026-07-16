import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { PoolConnection, RowDataPacket } from "mysql2/promise";

import { ROLE_IDS } from "../constant/id";
import {
  INVITE_POINT_GACHA_COST,
  INVITE_POINT_MESSAGES,
} from "../constant/invitePoint";
import { DbService } from "./dbService";

type AccountRow = RowDataPacket & { user_id: string };
type InvitePointBalanceRow = RowDataPacket & { points: number };

const INVITE_POINT_OPERATOR_ROLE_IDS = [
  ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SHOP_LEADER,
  ROLE_IDS.SHOP_STAFF,
];

export function canManageInvitePoints(member: unknown): boolean {
  const roleBackedMember = member as
    | { roles?: { cache?: { has: (roleId: string) => boolean } } }
    | null
    | undefined;
  return INVITE_POINT_OPERATOR_ROLE_IDS.some((roleId) =>
    Boolean(roleBackedMember?.roles?.cache?.has(roleId)),
  );
}

async function getGuildMember(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember> {
  if (!interaction.guild) {
    throw new Error("このコマンドはサーバー内でのみ使用できます。");
  }
  return interaction.member instanceof GuildMember
    ? interaction.member
    : interaction.guild.members.fetch(interaction.user.id);
}

export class InvitePointService {
  static async assertOperator(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const member = await getGuildMember(interaction);
    if (!canManageInvitePoints(member)) {
      throw new Error(INVITE_POINT_MESSAGES.OPERATOR_ONLY);
    }
  }

  static async grant(
    targetUserId: string,
    amount: number,
    operatorUserId: string,
  ): Promise<number> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("追加ポイントは1以上の整数で指定してください。");
    }

    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<AccountRow[]>(
        "SELECT user_id FROM accounts WHERE user_id = ? FOR UPDATE",
        [targetUserId],
      );
      if (!accounts[0]) {
        throw new Error(INVITE_POINT_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      await connection.execute(
        `INSERT INTO invite_point_balances (user_id, points)
         VALUES (?, 0)
         ON DUPLICATE KEY UPDATE points = points`,
        [targetUserId],
      );
      const [balances] = await connection.execute<InvitePointBalanceRow[]>(
        "SELECT points FROM invite_point_balances WHERE user_id = ? FOR UPDATE",
        [targetUserId],
      );
      const afterPoints = Number(balances[0].points) + amount;
      await connection.execute(
        "UPDATE invite_point_balances SET points = ? WHERE user_id = ?",
        [afterPoints, targetUserId],
      );
      await connection.execute(
        `INSERT INTO invite_point_transactions
         (user_id, operator_user_id, transaction_type, amount, balance_after)
         VALUES (?, ?, 'grant', ?, ?)`,
        [targetUserId, operatorUserId, amount, afterPoints],
      );
      await connection.commit();
      return afterPoints;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /** 呼び出し側のトランザクション内で、招待ポイントをガチャ1回分消費する。 */
  static async consumeForGacha(
    connection: PoolConnection,
    userId: string,
  ): Promise<number> {
    const [balances] = await connection.execute<InvitePointBalanceRow[]>(
      "SELECT points FROM invite_point_balances WHERE user_id = ? FOR UPDATE",
      [userId],
    );
    const balance = balances[0];
    if (!balance || Number(balance.points) < INVITE_POINT_GACHA_COST) {
      throw new Error(INVITE_POINT_MESSAGES.INSUFFICIENT_POINTS);
    }

    const afterPoints = Number(balance.points) - INVITE_POINT_GACHA_COST;
    await connection.execute(
      "UPDATE invite_point_balances SET points = ? WHERE user_id = ?",
      [afterPoints, userId],
    );
    await connection.execute(
      `INSERT INTO invite_point_transactions
       (user_id, transaction_type, amount, balance_after)
       VALUES (?, 'gacha_draw', ?, ?)`,
      [userId, -INVITE_POINT_GACHA_COST, afterPoints],
    );
    return afterPoints;
  }
}
