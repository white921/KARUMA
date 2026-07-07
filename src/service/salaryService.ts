import { Guild } from "discord.js";

import { hasRole, getRoleNameById } from "../util/role";
import { validateSubAccount } from "../util/subAccount";

import { AccountService } from "./accountService";
import { DbService } from "./dbService";
import { ActionService } from "./actionService";

import { BOT_ID } from "../constant/id";
import {
  SALARY_PAYMENTS,
  SALARY_ROLE_IDS,
} from "../constant/salary";
import { COMMAND_NAMES } from "../constant/command";

export class SalaryService {
  /**
   * 月の給与振込
   * @param guild ギルド
   */
  static async payMonthlySalaries(guild: Guild) {
    // メンバー一覧を取得
    const members = await guild.members.fetch();

    // すべてのメンバーに対してチェック
    for (const member of members.values()) {
      for (const [_roleName, roleId] of Object.entries(SALARY_ROLE_IDS)) {
        // そのロールに給与設定がない場合はスキップ
        const salary = SALARY_PAYMENTS[roleId];
        if (!salary) {
          continue;
        }
        // そのロールを持っているか判定
        if (await hasRole(member, roleId)) {
          // 振込処理
          const roleName = await getRoleNameById(guild, roleId);
          await this.paySalary(member.id, roleName, salary);
        }
      }
    }
  }

  /**
   * 給料を振込
   */
  static async paySalary(userId: string, roleName: string, amount: number) {
    try {
      if (await validateSubAccount(userId)) {
        return;
      }

      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];

      const toUserAccount = (
        await AccountService.getAccountByUserId(userId)
      )[0];

      const toUserAmount = toUserAccount.wallet + amount;
      const connection = await DbService.getConnection();
      try {
        // 残高更新
        await connection.execute(
          `UPDATE accounts
        SET
          wallet = ?
        WHERE user_id = ?
        ;`,
          [toUserAmount, userId],
        );
      } finally {
        connection.release();
      }

      const comment = await this.createPaySalaryComment(roleName);

      // アクション記録
      await ActionService.createActionLog(
        COMMAND_NAMES.PAY_SALARY,
        amount,
        BOT_ID,
        userId,
        botAccount.wallet,
        toUserAmount,
        comment,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * 給与振込のコメント作成
   */
  static async createPaySalaryComment(roleName: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}/${month} ${roleName}の給与振込`;
  }
}
