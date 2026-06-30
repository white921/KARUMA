import { GuildMember, PartialGuildMember } from "discord.js";
import { RowDataPacket } from "mysql2";

import { DbService } from "./dbService";

import { Account } from "../type/account";
import { ACCOUNT_MESSAGES } from "../constant/account";
import { ROLE_IDS } from "../constant/id";
import {
  MAX_DISPLAY_NAME_LENGTH,
  SUB_ACCOUNT_SUFFIX_LENGTH,
} from "../constant/account";

export class AccountService {
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
  static async handleMemberLeft(member: GuildMember | PartialGuildMember) {
    const leftCoreMemberRole =
      Object.values(ROLE_IDS.CORE_MEMBER_ROLES).find((roleId) =>
        roleId !== ROLE_IDS.CORE_MEMBER_ROLES.SINMONMATI &&
        roleId !== ROLE_IDS.CORE_MEMBER_ROLES.SAI_SINMONMATI &&
        member.roles.cache.has(roleId),
      ) ?? null;

    if (!leftCoreMemberRole) {
      return;
    }

    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE accounts
         SET wallet = 0,
             user_name = ?,
             left_count = left_count + 1,
             left_at = CURRENT_TIMESTAMP,
             left_core_member_roles = ?
         WHERE user_id = ?`,
        [member.displayName, leftCoreMemberRole, member.id],
      );
    } finally {
      connection.release();
    }
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
   * 名前のバリデーション
   * @param name ユーザー名
   */
  static async validateName(name: string, ignoreUserId?: string) {
    try {
      // 1. 既存の名前と被っていないかどうか
      const existingAccounts = ignoreUserId
        ? await this.getAccountsByNameExceptUserId(name, ignoreUserId)
        : await this.getAccountByName(name);
      if (existingAccounts.length > 0) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_SAME);
      }

      // 2. 長さが規定以内か
      if (name.length > MAX_DISPLAY_NAME_LENGTH - SUB_ACCOUNT_SUFFIX_LENGTH) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_TOO_LONG);
      }

      // 3. 許可される文字だけか
      // 許可：ひらがな、カタカナ、漢字、英数字、ラテン拡張文字、ギリシャ文字、ハングル、ローマ数字系、. 。 - ー ～ 〜 ! ！ ? ？ 全角スペース 半角スペース
      const allowedPattern =
        /^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſƀ-ɏΑ-Ωα-ω가-힣ぁ-んァ-ヶｦ-ﾟ一-龥々\u2160-\u2188.\-。ー 　～〜!！?？]+$/u;
      if (!allowedPattern.test(name)) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_SYMBOL);
      }

      // 4. 記号だけの名前かどうか
      const onlySymbolsPattern = /^[.\-。ー 　～〜!！?？]+$/u;
      if (onlySymbolsPattern.test(name)) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_ONLY_SYMBOLS);
      }

      // 5. 最後が (sub) で終わっていないかチェック
      if (/\(sub\)$/i.test(name)) {
        throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NAME_END_WITH_SUB);
      }
    } catch (error) {
      throw error;
    }
  }
}
