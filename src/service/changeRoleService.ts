import { GuildMember } from "discord.js";

import { addRole, deleteRole, hasRole, isTechnician } from "../util/role";

import { CHANGE_ROLE_MESSAGES } from "../constant/changeRole";

export class ChangeRoleService {
  /**
   * changeRoleバリデーション
   * 技術者以外は弾く
   * @param user
   * @returns
   */
  static async validateChangeRole(user: GuildMember) {
    try {
      if (!(await isTechnician(user))) {
        throw new Error(CHANGE_ROLE_MESSAGES.PERMISSION_DENIED);
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * ロール変更処理
   * @param user
   * @param roleId
   * @param action 追加/削除
   */
  static async changeRole(
    user: GuildMember,
    roleId: string,
    action: "add" | "remove"
  ) {
    try {
      if (action === "add" && !(await hasRole(user, roleId))) {
        await addRole(user, roleId);
      } else if (action === "remove" && (await hasRole(user, roleId))) {
        await deleteRole(user, roleId);
      }
    } catch (error) {
      throw error;
    }
  }
}
