import { Guild, GuildMember } from "discord.js";

import { RoleAction } from "../type/role";

import { DbService } from "../service/dbService";
import { AccountService } from "../service/accountService";

import { ROLE_MESSAGES } from "../constant/role";
import { ROLE_IDS } from "../constant/id";

/**
 * 指定したメンバーが指定したロールを持っているかどうかを確認
 * @param member メンバー
 * @param roleId ロールID
 * @returns ロールを持っているかどうか
 */
export async function hasRole(
  member: GuildMember,
  roleId: string
): Promise<boolean> {
  return member.roles.cache.has(roleId);
}

/**
 * ロールを削除
 * @param member メンバー
 * @param roleId ロールID
 */
export async function deleteRole(
  member: GuildMember,
  roleId: string
): Promise<void> {
  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
    }
  } catch (error) {
    throw new Error(ROLE_MESSAGES.DELETE_ROLE_FAILED);
  }
}

/**
 * ロールを追加
 * @param member メンバー
 * @param roleId ロールID
 */
export async function addRole(
  member: GuildMember,
  roleId: string
): Promise<void> {
  try {
    if (!member.roles.cache.has(roleId)) {
      await member.roles.add(roleId);
    }
  } catch (error) {
    throw new Error(ROLE_MESSAGES.ADD_ROLE_FAILED);
  }
}

/**
 * サブアカウントに対してのロール操作
 * @param member サブアカウントのメンバー
 * @param action 追加/削除
 * @param roleId ロールID
 */
export async function changeRoleOfSubAccount(
  member: GuildMember,
  action: RoleAction,
  roleId: string
) {
  try {
    if (!(await AccountService.isSubAccount(member.id))) {
      return;
    }
    if (action === "add") {
      await addRole(member, roleId);
    } else if (action === "delete") {
      await deleteRole(member, roleId);
    }
  } catch (error) {
    throw new Error(ROLE_MESSAGES.FAILED_TO_CHANGE_ROLE_OF_SUB_ACCOUNT);
  }
}

/**
 * 基本ロール以外を削除
 * @param member メンバー
 */
export async function removeRolesExcept(member: GuildMember) {
  try {
    // @everyoneと基本ロール（性別、年齢、設定など）は残す
    const preservedRoleIds = new Set([
      member.guild.id,
      ...Object.values(ROLE_IDS.BASIC_ROLE_IDS),
    ]);

    // メンバーが持っているロールを取得
    const memberRoles = member.roles.cache.values();

    for (const role of memberRoles) {
      if (role.managed || preservedRoleIds.has(role.id)) continue;
      await deleteRole(member, role.id);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * ロールをコピー
 * @param fromMember コピー元メンバー
 * @param toMember コピー先メンバー
 */
export async function copyRoleFromMainToSub(
  fromMember: GuildMember,
  toMember: GuildMember
): Promise<void> {
  try {
    const roles = fromMember.roles.cache.values();

    // 基本ロールはサブ垢側に残し、既存のコピー除外対象はコピーしない。
    const excludedRoleIds = new Set([
      ...Object.values(ROLE_IDS.BASIC_ROLE_IDS),
      ROLE_IDS.SUB_ACCOUNT,
      ROLE_IDS.SABANUSI,
      ROLE_IDS.KANRISYA,
      ROLE_IDS.GIJUTU_LEADER,
      ROLE_IDS.SERVER_BOOSTER,
      ROLE_IDS.GAME_SHORT,
      ROLE_IDS.GAME_LONG,
      ROLE_IDS.GAME_PASS,
    ]);

    for (const role of roles) {
      if (
        !role.managed &&
        role.id !== fromMember.guild.id &&
        !excludedRoleIds.has(role.id)
      ) {
        await addRole(toMember, role.id);
      }
    }
  } catch (error) {
    throw new Error(ROLE_MESSAGES.COPY_ROLE_FAILED);
  }
}

/**
 * ロールを持っているユーザーIDを取得
 * @param guild ギルド
 * @param roleId ロールID
 * @returns ロールを持っているユーザーID
 */
export async function getUserIdsByRoleId(
  guild: Guild,
  roleId: string
): Promise<string[]> {
  const members = await guild.members.fetch();
  return members
    .filter((member) => member.roles.cache.has(roleId))
    .map((member) => member.id);
}

/**
 * ロール名の取得
 * @param guild ギルド
 * @param roleId ロールID
 * @returns ロール名
 */
export async function getRoleNameById(
  guild: Guild,
  roleId: string
): Promise<string> {
  const role = await guild.roles.fetch(roleId);
  return role ? role.name : "Unknown Role";
}

/**
 * 技術者かどうかを確認
 * @param member メンバー
 * @returns 技術者かどうか
 */
export async function isTechnician(member: any) {
  try {
    if (process.env.TECHNICIAN_IDS) {
      const technicianIds = process.env.TECHNICIAN_IDS.split(",").map((id) =>
        id.trim()
      );
      return technicianIds.includes(member.id);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * 期限切れのロールを持ったユーザーIDを取得
 * @param roleId ロールID
 * @returns 期限切れのロールを持ったユーザーIDの配列（id, user_idを含むオブジェクトの配列）
 */
export async function getExpiredRoleUserIds(roleId: string): Promise<string[]> {
  const connection = await DbService.getConnection();
  try {
    // 現在時刻を基準に期限切れを判定
    const now = new Date();
    const [rows]: any = await connection.execute(
      `SELECT user_id FROM role_management_logs 
      WHERE is_deleted = ? AND role_id = ? AND expire_at <= ?;`,
      [false, roleId, now]
    );

    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map((row: any) => String(row.user_id));
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * role_management_logsテーブルのis_deletedをtrueに更新
 * @param userId ユーザーID
 * @param roleId ロールID
 */
export async function setIsDeletedToTrue(userId: string, roleId: string) {
  const connection = await DbService.getConnection();
  try {
    await connection.execute(
      `UPDATE role_management_logs 
        SET is_deleted = ?, expire_at = null, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND role_id = ?;`,
      [true, userId, roleId]
    );
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
}
