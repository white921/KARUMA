import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import type { Guild, GuildMember, PartialGuildMember } from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { DbService } from "../system/dbService";

import { Account } from "../../type/account/account";
import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { ROLE_IDS } from "../../constant/shared/id";
import {
  MAX_DISPLAY_NAME_LENGTH,
  SUB_ACCOUNT_SUFFIX_LENGTH,
} from "../../constant/account/account";

type MemberSnapshot = Pick<GuildMember | PartialGuildMember, "id" | "displayName" | "roles"> & {
  joinedAt?: Date | null;
  partial?: boolean;
};

type MembershipAccountRow = RowDataPacket & {
  user_id: string;
  user_name: string;
  wallet: number;
  left_core_member_roles: string | null;
  state_is_present: number | null;
  state_joined_at: Date | null;
  state_display_name: string | null;
  state_core_member_role_id: string | null;
};

export type MemberLeftResult =
  | "recorded"
  | "sub_account_unlinked"
  | "duplicate"
  | "account_not_found";

export class AccountService {
  private static membershipMutation: Promise<void> = Promise.resolve();

  private static async serializeMembershipMutation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.membershipMutation;
    let release!: () => void;
    this.membershipMutation = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private static getTrackedCoreRole(member: MemberSnapshot): string | null {
    return Object.values(ROLE_IDS.CORE_MEMBER_ROLES).find((roleId) =>
      roleId !== ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI &&
      roleId !== ROLE_IDS.CORE_MEMBER_ROLES.DEMODORI &&
      member.roles.cache.has(roleId),
    ) ?? null;
  }

  private static async upsertMembershipState(
    connection: PoolConnection,
    member: MemberSnapshot,
  ): Promise<boolean> {
    const coreMemberRoleId = this.getTrackedCoreRole(member);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO account_membership_states
         (user_id, is_present, joined_at, display_name, core_member_role_id)
       SELECT user_id, TRUE, ?, ?, ?
       FROM accounts
       WHERE user_id = ?
       ON DUPLICATE KEY UPDATE
         is_present = TRUE,
         joined_at = VALUES(joined_at),
         display_name = VALUES(display_name),
         core_member_role_id = COALESCE(
           VALUES(core_member_role_id),
           core_member_role_id
         )`,
      [member.joinedAt ?? null, member.displayName, coreMemberRoleId, member.id],
    );
    return result.affectedRows > 0;
  }

  private static async processMemberLeft(
    connection: PoolConnection,
    member: MemberSnapshot,
  ): Promise<MemberLeftResult> {
    const [rows] = await connection.execute<MembershipAccountRow[]>(
      `SELECT
         CAST(a.user_id AS CHAR) AS user_id,
         a.user_name,
         a.wallet,
         CAST(a.left_core_member_roles AS CHAR) AS left_core_member_roles,
         s.is_present AS state_is_present,
         s.joined_at AS state_joined_at,
         s.display_name AS state_display_name,
         CAST(s.core_member_role_id AS CHAR) AS state_core_member_role_id
       FROM accounts a
       LEFT JOIN account_membership_states s ON s.user_id = a.user_id
       WHERE a.user_id = ?
       FOR UPDATE`,
      [member.id],
    );
    const account = rows[0];
    if (!account) {
      return "account_not_found";
    }
    if (account.state_is_present === 0) {
      return "duplicate";
    }

    const eventCoreMemberRole = this.getTrackedCoreRole(member);
    const coreMemberRoleId =
      eventCoreMemberRole ??
      account.state_core_member_role_id ??
      account.left_core_member_roles;
    const displayName =
      (member.partial === true ? null : member.displayName) ??
      account.state_display_name ??
      account.user_name;
    const joinedAt = member.joinedAt ?? account.state_joined_at;

    const [subAccountResult] = await connection.execute<ResultSetHeader>(
      "DELETE FROM sub_accounts WHERE sub_user_id = ?",
      [member.id],
    );

    if (subAccountResult.affectedRows === 0) {
      await connection.execute<ResultSetHeader>(
        `UPDATE accounts
         SET left_wallet = wallet,
             wallet = 0,
             user_name = ?,
             left_count = left_count + 1,
             left_at = CURRENT_TIMESTAMP,
             left_core_member_roles = ?
         WHERE user_id = ?`,
        [displayName, coreMemberRoleId, member.id],
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO account_membership_states
         (user_id, is_present, joined_at, display_name, core_member_role_id)
       VALUES (?, FALSE, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_present = FALSE,
         joined_at = VALUES(joined_at),
         display_name = VALUES(display_name),
         core_member_role_id = COALESCE(
           VALUES(core_member_role_id),
           core_member_role_id
         )`,
      [member.id, joinedAt, displayName, coreMemberRoleId],
    );

    return subAccountResult.affectedRows > 0
      ? "sub_account_unlinked"
      : "recorded";
  }

  /**
   * 口座取得
   * @param userId ユーザーID
   * @returns 口座情報
   */
  static async getAccountByUserId(userId: string): Promise<Account[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM accounts WHERE user_id = ?",
        [userId],
      );
      return rows as Account[];
    } catch (error: any) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    } finally {
      connection.release();
    }
  }

  /**
   * 口座開設
   * @param userId ユーザーID
   * @param displayName ユーザーの表示名
   * @param wallet 残高
   */
  static async createAccount(
    userId: string,
    displayName: string,
    wallet: number,
  ) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        "INSERT INTO accounts (user_id, user_name, wallet) VALUES (?, ?, ?)",
        [userId, displayName, wallet],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * サーバー脱退時のアカウント更新
   * @param member 脱退したメンバー
   */
  static async handleMemberLeft(
    member: GuildMember | PartialGuildMember,
    source = "gateway",
  ): Promise<MemberLeftResult> {
    return this.serializeMembershipMutation(async () => {
      const connection = await DbService.getConnection();
      try {
        await connection.beginTransaction();
        const result = await this.processMemberLeft(connection, member);
        await connection.commit();
        console.log("[AccountMembership] member left", {
          userId: member.id,
          source,
          result,
        });
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });
  }

  /** 在籍中の表示名・基本ロールを、退出通知がpartialでも使えるよう保存する。 */
  static async syncMemberSnapshot(member: GuildMember): Promise<boolean> {
    return this.serializeMembershipMutation(async () => {
      const connection = await DbService.getConnection();
      try {
        return await this.upsertMembershipState(connection, member);
      } finally {
        connection.release();
      }
    });
  }

  /** Bot停止中に発生した退出を、起動時の全件取得結果と照合して補完する。 */
  static async reconcileMembership(
    members: Iterable<GuildMember>,
  ): Promise<{ synced: number; departures: number }> {
    return this.serializeMembershipMutation(async () => {
      const memberList = [...members];
      const presentIds = new Set(memberList.map((member) => member.id));
      const connection = await DbService.getConnection();
      try {
        await connection.beginTransaction();
        let synced = 0;
        for (const member of memberList) {
          if (!member.user.bot && await this.upsertMembershipState(connection, member)) {
            synced++;
          }
        }

        const [stateRows] = await connection.execute<RowDataPacket[]>(
          `SELECT CAST(user_id AS CHAR) AS user_id
           FROM account_membership_states
           WHERE is_present = TRUE
           FOR UPDATE`,
        );
        const departedIds = stateRows
          .map((row) => String(row.user_id))
          .filter((userId) => !presentIds.has(userId));
        const maximumAutomaticDepartures = Math.max(
          10,
          Math.ceil(stateRows.length * 0.05),
        );
        if (departedIds.length > maximumAutomaticDepartures) {
          throw new Error(
            `起動時の退出候補が安全上限を超えました: ${departedIds.length}/${stateRows.length}`,
          );
        }

        let departures = 0;
        for (const userId of departedIds) {
          const result = await this.processMemberLeft(
            connection,
            {
              id: userId,
              displayName: "",
              roles: { cache: new Map() } as GuildMember["roles"],
              partial: true,
            },
          );
          if (result === "recorded" || result === "sub_account_unlinked") {
            departures++;
          }
        }

        await connection.commit();
        console.log("[AccountMembership] reconciliation complete", {
          members: memberList.length,
          synced,
          departures,
        });
        return { synced, departures };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });
  }

  /**
   * 口座存在チェック
   * @param userId ユーザーID
   * @returns 口座存在フラグ
   */
  static async hasAccount(userId: string): Promise<boolean> {
    const account = await this.getAccountByUserId(userId);
    return account.length > 0;
  }

  /**
   * サブアカウントチェック
   * @param userId ユーザーID
   * @returns サブアカウントか否か
   */
  static async isSubAccount(userId: string): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM sub_accounts WHERE sub_user_id = ?",
        [userId],
      );
      return rows.length > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * サブアカウントを持っているか否か
   * @param userId ユーザーID
   * @returns サブアカウントか否か
   */
  static async hasSubAccount(userId: string): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM sub_accounts WHERE main_user_id = ?",
        [userId],
      );
      return rows.length > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * サブアカウントユーザーIDを取得
   * @returns サブアカウントユーザーID配列
   */
  static async getSubUserIds(): Promise<string[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT sub_user_id FROM sub_accounts",
      );

      const subUserIds = rows.map((row) => row.sub_user_id);

      return subUserIds;
    } finally {
      connection.release();
    }
  }

  /**
   * 本アカウントユーザーIDに紐づくサブアカウントユーザーIDを取得
   * @param mainUserId 本アカウントユーザーID
   * @returns サブアカウントユーザーID（存在しない場合はnull）
   */
  static async getSubUserIdByMainUserId(
    mainUserId: string,
  ): Promise<string | undefined> {
    const connection = await DbService.getConnection();
    try {
      if (!(await this.hasSubAccount(mainUserId))) {
        return;
      }
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT sub_user_id FROM sub_accounts WHERE main_user_id = ? LIMIT 1",
        [mainUserId],
      );
      return rows[0].sub_user_id;
    } catch (error) {
      throw new Error(ACCOUNT_MESSAGES.GET_SUB_USER_ID_BY_MAIN_USER_ID_FAILED);
    } finally {
      connection.release();
    }
  }

  /** 指定された本垢に登録されているサブ垢を、件数制限なしで取得する。 */
  static async getSubUserIdsByMainUserIds(mainUserIds: readonly string[]): Promise<string[]> {
    if (mainUserIds.length === 0) return [];
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT CAST(sub_user_id AS CHAR) AS sub_user_id FROM sub_accounts
         WHERE main_user_id IN (${mainUserIds.map(() => "?").join(", ")})`,
        [...mainUserIds],
      );
      return rows.map(row => String(row.sub_user_id));
    } finally {
      connection.release();
    }
  }

  /**
   * 本垢と紐づくサブ垢の組み合わせかどうか
   * @param fromUserId 送金元ユーザーID
   * @param toUserId 送金先ユーザーID
   * @returns 紐づく本垢-サブ垢間ならtrue
   */
  static async isLinkedMainAndSubAccount(
    fromUserId: string,
    toUserId: string,
  ): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT 1
         FROM sub_accounts
         WHERE (main_user_id = ? AND sub_user_id = ?)
            OR (main_user_id = ? AND sub_user_id = ?)
         LIMIT 1`,
        [fromUserId, toUserId, toUserId, fromUserId],
      );
      return rows.length > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * 本垢・サブ垢を含む紐づきアカウントのユーザーIDを取得
   * @param userId ユーザーID
   * @returns 紐づきのあるユーザーID配列
   */
  static async getLinkedAccountUserIds(userId: string): Promise<string[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT DISTINCT linked_user_id
         FROM (
           SELECT main_user_id AS linked_user_id
           FROM sub_accounts
           WHERE sub_user_id = ?
           UNION
           SELECT sub_user_id AS linked_user_id
           FROM sub_accounts
           WHERE main_user_id = ?
           UNION
           SELECT ? AS linked_user_id
         ) linked_accounts`,
        [userId, userId, userId],
      );
      return rows.map((row) => String(row.linked_user_id));
    } finally {
      connection.release();
    }
  }

  /**
   * 名前による口座取得
   * @param name ユーザー名
   * @returns 口座情報
   */
  static async getAccountByName(name: string): Promise<Account[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM accounts WHERE user_name COLLATE utf8mb4_bin = ?",
        [name],
      );
      return rows as Account[];
    } finally {
      connection.release();
    }
  }

  /**
   * 名前による口座取得（特定ユーザーを除外）
   * @param name ユーザー名
   * @param ignoreUserId 除外するユーザーID
   * @returns 口座情報
   */
  static async getAccountsByNameExceptUserId(
    name: string,
    ignoreUserId: string,
  ): Promise<Account[]> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<Account[] & RowDataPacket[]>(
        `SELECT *
         FROM accounts
         WHERE user_name COLLATE utf8mb4_bin = ?
           AND user_id != ?`,
        [name, ignoreUserId],
      );
      return rows as Account[];
    } finally {
      connection.release();
    }
  }

  /**
   * 在籍中の口座だけを対象に名前の重複を確認する。
   * @param name ユーザー名
   */
  static async validateName(name: string, guild: Guild, ignoreUserId?: string) {
    try {
      this.validateNameFormat(name);

      const existingAccounts = ignoreUserId
        ? await this.getAccountsByNameExceptUserId(name, ignoreUserId)
        : await this.getAccountByName(name);
      for (const account of existingAccounts) {
        try {
          // キャッシュや脱退履歴ではなく現在の在籍を確認する。
          // 再参加した口座は次の判定から自動的に重複対象へ戻る。
          await guild.members.fetch({ user: account.user_id, force: true });
        } catch (error) {
          if (
            error instanceof DiscordAPIError &&
            error.code === RESTJSONErrorCodes.UnknownMember
          ) {
            continue;
          }
          // 通信・権限エラーを退出扱いにはしない。
          throw error;
        }
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_SAME);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 名前の書式を確認する。口座の重複は確認しない。
   */
  static validateNameFormat(name: string) {
    if (name.length > MAX_DISPLAY_NAME_LENGTH - SUB_ACCOUNT_SUFFIX_LENGTH) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_TOO_LONG);
    }

    if (!/^(?=.*[^！？、ー])[\p{L}\p{N}！？、ー]+$/u.test(name)) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_SYMBOL);
    }
  }
}
