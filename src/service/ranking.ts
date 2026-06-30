import { Guild, EmbedBuilder } from "discord.js";
import { RowDataPacket } from "mysql2";

import { Account } from "../type/account";

import { hasRole } from "../util/role";
import { getUserIdsByRoleId } from "../util/role";

import { DbService } from "./dbService";
import { AccountService } from "./accountService";

import { ACCOUNT_MESSAGES } from "../constant/account";
import { ROLE_IDS } from "../constant/id";
import { RANKING_MESSAGES } from "../constant/ranking";
import { CURRENCY_NAMES } from "../constant/currency";
import { formatNumber } from "../util/number";

export class RankingService {
  /**
   * bot、執行人、創設者を除いた全ユーザー、または指定ロール内の残高ランキングを取得する
   * @param guild ギルド
   * @param roleId 指定ロールID
   * @returns 対象ユーザーをwalletでソートしたランキング配列
   */
  static async getRanking(guild: Guild, roleId?: string): Promise<Account[]> {
    const connection = await DbService.getConnection();

    try {
      // サブアカウントユーザーIDを取得
      const subUserIds = await AccountService.getSubUserIds();

      // 除外対象ユーザーID
      const excludeMemberIds = [...subUserIds];

      const conditions: string[] = [];
      const params: string[] = [];

      if (excludeMemberIds.length > 0) {
        const excludePlaceholders = excludeMemberIds.map(() => "?").join(", ");
        conditions.push(`user_id NOT IN (${excludePlaceholders})`);
        params.push(...excludeMemberIds);
      }

      if (roleId) {
        const roleMemberIds = await getUserIdsByRoleId(guild, roleId);
        if (roleMemberIds.length === 0) {
          return [];
        }

        const rolePlaceholders = roleMemberIds.map(() => "?").join(", ");
        conditions.push(`user_id IN (${rolePlaceholders})`);
        params.push(...roleMemberIds);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        `
        SELECT user_id, wallet
        FROM accounts
        ${whereClause}
        ORDER BY wallet DESC;
      `,
        params,
      );

      return rows as Account[];
    } finally {
      connection.release();
    }
  }

  /**
   * ランキングのメッセージを作成するメソッド
   * @param embed ランキングの結果
   */
  static async createRankingMessage(ranking: Account[], roleName?: string) {
    // メッセージ作成
    const rankingMessages = ranking.slice(0, 10).map((account, idx) => {
      return `${idx + 1}位: <@${account?.user_id}> ${formatNumber(
        account?.wallet ?? 0,
      )}${CURRENCY_NAMES}`;
    });

    const title = roleName
      ? `🏆 **${roleName}内 残高ランキングTOP10** 🏆`
      : `🏆 **残高ランキングTOP10** 🏆`;

    const embed = new EmbedBuilder().setTitle(title).addFields({
      name: ``,
      value: rankingMessages.join("\n") || ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND,
      inline: true,
    });
    return embed;
  }

  /**
   * ランキング表示バリデーション
   * @param guild ギルド
   * @param userId ユーザーID
   */
  static async validateRanking(guild: Guild, userId: string) {
    const member = await guild.members.fetch(userId);
    const isShikkokan = await hasRole(member, ROLE_IDS.SIKKOKAN);
    if (!isShikkokan) {
      throw new Error(RANKING_MESSAGES.NOT_AUTHORIZED);
    }
  }
}
