import type { Guild } from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import { ROLE_IDS } from "../../constant/shared/id";
import { DbService } from "../system/dbService";
import { GuildMemberCacheService } from "../system/guildMemberCacheService";

export function calculateBalanceStatistics(wallets: number[]) {
  const values = wallets.filter(wallet => wallet !== 30_000).sort((a, b) => a - b);
  const count = values.length;
  if (!count) return { count: 0, average: null, median: null };
  const middle = Math.floor(count / 2);
  return {
    count,
    average: values.reduce((sum, wallet) => sum + wallet, 0) / count,
    median: count % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
  };
}

export class BalanceStatisticsService {
  static async get(guild: Guild) {
    const members = await GuildMemberCacheService.getMembers(guild);
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT a.user_id, a.wallet FROM accounts a
         WHERE NOT EXISTS (SELECT 1 FROM sub_accounts s WHERE s.sub_user_id = a.user_id)`,
      );
      const wallets = rows.filter(row => {
        const member = members.get(String(row.user_id));
        return member && !member.user.bot && !member.roles.cache.has(ROLE_IDS.SUB_ACCOUNT);
      }).map(row => Number(row.wallet));
      return { ...calculateBalanceStatistics(wallets), excluded: wallets.filter(wallet => wallet === 30_000).length };
    } finally { connection.release(); }
  }
}
