import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  GuildMember,
  ThreadChannel,
} from "discord.js";
import dayjs from "dayjs";

import {
  addRole,
  hasRole,
  getExpiredRoleUserIds,
  deleteRole,
  setIsDeletedToTrue,
  changeRoleOfSubAccount,
} from "../util/role";

import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";

import { Account } from "../type/account";

import { GAME_PRICE, GAME_MESSAGES } from "../constant/game";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ROLE_IDS, THREAD_IDS } from "../constant/id";
import { COLOR } from "../constant/color";
import { BOT_ID } from "../constant/id";

export class GameService {
  /**
   * role_management_logsテーブルに追加
   * @param userId ユーザーID
   * @param roleId ロールID
   * @param member メンバー
   */
  static async insertIntoRoleManagementLogs(
    userId: string,
    roleId: string,
    member: GuildMember,
  ) {
    const connection = await DbService.getConnection();
    try {
      const now = dayjs();
      let expire_at;

      switch (roleId) {
        case ROLE_IDS.GAME_SHORT:
          expire_at = now.add(6, "hour");
          break;
        case ROLE_IDS.GAME_LONG:
          expire_at = now.add(12, "hour");
          break;
        case ROLE_IDS.GAME_PASS:
          const now_JST = now.tz("Asia/Tokyo");
          const expire_at_JST = now_JST.endOf("month");
          expire_at = expire_at_JST.tz("UTC");
          break;
        default:
          throw new Error(GAME_MESSAGES.INVALID_EXPIRE_AT);
      }

      await connection.execute(
        `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at) VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          is_deleted = ?,
          expire_at = ?,
          updated_at = CURRENT_TIMESTAMP;`,
        [
          userId,
          roleId,
          false,
          expire_at ? expire_at.toDate() : null,
          false,
          expire_at ? expire_at.toDate() : null,
        ],
      );
      return expire_at;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 6時間プラン購入
   * @param interaction インタラクション
   * @param commandName コマンド名 // GAME_SHORT, GAME_LONG
   */
  static async buyGameRole(
    interaction: ButtonInteraction,
    commandName: string,
    isExtend: boolean,
  ) {
    try {
      const userId = interaction.user.id;
      const member = interaction.member as GuildMember;
      const userAccount = (await AccountService.getAccountByUserId(userId))[0];
      const isFree = await this.isFree(member);

      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];

      // プラン価格とロールIDとコメントを取得
      const price = await this.getGamePrice(commandName);
      const roleId = await this.getGameRoleId(commandName);
      const comment = await this.getGameComment(commandName);

      await this.validateHasRole(member, roleId, false);

      // ゲームパスを持っている場合以外は支払い処理
      if (!isFree) {
        await this.validateWallet(userAccount, price);
        await this.payGamePrice(userAccount, price);
        await ActionService.executeActionLog(
          interaction,
          commandName,
          price,
          userId,
          botAccount.user_id,
          userAccount.wallet - price,
          botAccount.wallet,
          `${comment}を購入しました。`,
        );
      }

      const expire_at = await this.insertIntoRoleManagementLogs(
        userId,
        roleId,
        member,
      );

      const jstExpireDateTime = expire_at
        ? expire_at.toDate().toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      // メインアカウントにロールを付与
      await addRole(member, roleId);
      // サブアカウントを持っている場合はサブアカウントにもロールを付与
      const subUserId = await AccountService.getSubUserIdByMainUserId(userId);
      if (subUserId) {
        const subUserMember = await interaction.guild?.members.fetch(subUserId);
        await changeRoleOfSubAccount(subUserMember!, "add", roleId);
        await this.insertIntoRoleManagementLogs(
          subUserId,
          roleId,
          subUserMember!,
        );
      }

      // 購入ログ送信
      await this.sendLog(
        interaction,
        commandName,
        comment,
        jstExpireDateTime,
        isFree,
      );

      // メッセージ送信
      if (interaction.deferred) {
        await interaction.editReply({
          content: `${comment}を購入しました。\n${
            jstExpireDateTime ? `有効期限は${jstExpireDateTime}までです。` : ""
          }`,
        });
      } else {
        await interaction.reply({
          content: `${comment}を購入しました。\n${
            jstExpireDateTime ? `有効期限は${jstExpireDateTime}までです。` : ""
          }`,
          ephemeral: true,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 夢遊パス購入
   * @param interaction インタラクション
   * @param commandName コマンド名 // GAME_PASS, MINECRAFT_PASS
   */
  static async buyGamePass(
    interaction: ButtonInteraction,
    commandName: string,
  ) {
    try {
      const userId = interaction.user.id;
      const member = interaction.member as GuildMember;
      const userAccount = (await AccountService.getAccountByUserId(userId))[0];

      const botAccount = (
        await AccountService.getAccountByUserId(BOT_ID)
      )[0];

      // プラン価格とロールIDとコメントを取得
      const price = await this.getGamePrice(commandName);
      const roleId = await this.getGameRoleId(commandName);
      const comment = await this.getGameComment(commandName);

      // 既にゲームパスを持っている場合早期リターン
      await this.validateHasRole(member, roleId, false);

      // 支払い処理
      await this.validateWallet(userAccount, price);
      await this.payGamePrice(userAccount, price);

      // ロール追加
      await addRole(member, roleId);

      // サブアカウントを持っている場合はサブアカウントにもロールを付与
      const subUserId = await AccountService.getSubUserIdByMainUserId(userId);
      if (subUserId) {
        const subUserMember = await interaction.guild?.members.fetch(subUserId);
        await changeRoleOfSubAccount(subUserMember!, "add", roleId);
        await this.insertIntoRoleManagementLogs(
          subUserId,
          roleId,
          subUserMember!,
        );
      }

      const expire_at = await this.insertIntoRoleManagementLogs(
        userId,
        roleId,
        member,
      );
      const jstExpireDateTime = expire_at
        ? expire_at.toDate().toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined;
      // 購入ログ送信
      await this.sendLog(
        interaction,
        commandName,
        comment,
        jstExpireDateTime,
        false,
      );

      // アクションログ
      await ActionService.executeActionLog(
        interaction,
        commandName,
        price,
        userId,
        botAccount.user_id,
        userAccount.wallet - price,
        botAccount.wallet,
        `${comment}を購入しました。`,
      );

      // メッセージ送信
      if (interaction.deferred) {
        await interaction.editReply({
          content: `${comment}を購入しました。\n${
            jstExpireDateTime ? `有効期限は${jstExpireDateTime}までです。` : ""
          }`,
        });
      } else {
        await interaction.reply({
          content: `${comment}を購入しました。\n${
            jstExpireDateTime ? `有効期限は${jstExpireDateTime}までです。` : ""
          }`,
          ephemeral: true,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 残高バリデーション
   * @param userAccount ユーザーアカウント
   * @param price 価格
   */
  static async validateWallet(
    userAccount: Account,
    price: number,
  ): Promise<void> {
    // 残高バリデーション
    const afterWallet = userAccount.wallet - price;
    if (afterWallet < 0) {
      throw new Error(GAME_MESSAGES.NOT_ENOUGH_BALANCE);
    }
  }

  /**
   * 既に指定したロールを持っている場合早期リターン
   * @param member メンバー
   * @param roleId ロールID
   */
  static async validateHasRole(
    member: GuildMember,
    roleId: string,
    isExtend: boolean,
  ): Promise<void> {
    let hasThisRole = false;

    if (roleId === ROLE_IDS.GAME_SHORT || roleId === ROLE_IDS.GAME_LONG) {
      hasThisRole =
        (await hasRole(member, ROLE_IDS.GAME_SHORT)) ||
        (await hasRole(member, ROLE_IDS.GAME_LONG));
    } else {
      hasThisRole = await hasRole(member, roleId);
    }

    if (hasThisRole) {
      throw new Error(GAME_MESSAGES.ALREADY_HAS_ROLE);
    }
  }

  /**
   * 無料かどうかを判定
   * ゲームパスを持っているかゲーム従業員であれば無料
   * @param member メンバー
   * @returns ゲームパスを持っているかどうか
   */
  static async isFree(member: GuildMember): Promise<boolean> {
    const isFree =
      (await hasRole(member, ROLE_IDS.GAME_LEADER)) ||
      (await hasRole(member, ROLE_IDS.GAME_STAFF)) ||
      (await hasRole(member, ROLE_IDS.GAME_PASS));
    return isFree;
  }

  /**
   * ゲーム価格を支払う
   * @param userAccount ユーザーアカウント
   * @param price 価格
   */
  static async payGamePrice(
    userAccount: Account,
    price: number,
  ): Promise<void> {
    const afterWallet = userAccount.wallet - price;
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE accounts SET wallet = ? WHERE user_id = ?;`,
        [afterWallet, userAccount.user_id],
      );
    } finally {
      connection.release();
    }
  }

  /**
   * ゲーム価格を取得
   * @param gameType ゲームタイプ
   * @returns ゲーム価格
   */
  static async getGamePrice(gameType: string): Promise<number> {
    switch (gameType) {
      case PANEL_COMMAND_NAMES.GAME_SHORT:
        return GAME_PRICE.SHORT;
      case PANEL_COMMAND_NAMES.GAME_LONG:
        return GAME_PRICE.LONG;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        return GAME_PRICE.PASS;
      default:
        throw new Error(GAME_MESSAGES.INVALID_GAME_TYPE);
    }
  }

  /**
   * ゲームロールIDを取得
   * @param gameType ゲームタイプ
   * @returns ゲームロールID
   */
  static async getGameRoleId(gameType: string): Promise<string> {
    switch (gameType) {
      case PANEL_COMMAND_NAMES.GAME_SHORT:
        return ROLE_IDS.GAME_SHORT;
      case PANEL_COMMAND_NAMES.GAME_LONG:
        return ROLE_IDS.GAME_LONG;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        return ROLE_IDS.GAME_PASS;
      default:
        throw new Error(GAME_MESSAGES.INVALID_ROLE);
    }
  }

  /**
   * 購入プランに対応するコメントを取得
   * @param gameType ゲームタイプ
   * @returns 購入プランに対応するコメント
   */
  static async getGameComment(gameType: string): Promise<string> {
    switch (gameType) {
      case PANEL_COMMAND_NAMES.GAME_SHORT:
        return GAME_MESSAGES.GAME_SHORT;
      case PANEL_COMMAND_NAMES.GAME_LONG:
        return GAME_MESSAGES.GAME_LONG;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        return GAME_MESSAGES.GAME_PASS;
      default:
        throw new Error(GAME_MESSAGES.INVALID_GAME_TYPE);
    }
  }

  /**
   * ログを送信
   * @param interaction インタラクション
   * @param commandName コマンド名
   * @param comment コメント
   * @param expire_at 有効期限
   * @param isFree 無料かどうか
   */
  static async sendLog(
    interaction: ButtonInteraction,
    commandName: string,
    comment: string,
    expire_at?: string,
    isFree?: boolean,
  ): Promise<void> {
    let threadId, thread;
    switch (commandName) {
      case PANEL_COMMAND_NAMES.GAME_SHORT:
      case PANEL_COMMAND_NAMES.GAME_LONG:
        if (isFree) {
          threadId = THREAD_IDS.GAME_FREE_LOG_THREAD;
        } else {
          threadId = THREAD_IDS.GAME_CHARGE_LOG_THREAD;
        }
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        threadId = THREAD_IDS.GAME_PASS_LOG_THREAD;
        break;
      default:
        throw new Error(GAME_MESSAGES.INVALID_ROLE);
    }

    try {
      thread = await interaction.client.channels.fetch(threadId);
      const embed = new EmbedBuilder()
        .setDescription(
          `<@${interaction.user.id}>が${comment}を購入しました。\n${
            expire_at ? `有効期限は${expire_at}までです。` : ""
          }`,
        )
        .setColor(COLOR.GRAY);

      await (thread as ThreadChannel).send({
        embeds: [embed],
      });
    } catch (error) {
      console.error(
        `GameService.sendLog エラー (threadId: ${threadId}):`,
        error,
      );
    }
  }

  /**
   * 有効期限を過ぎたロールを剥奪
   * @param client クライアント
   */
  static async removeExpiredRole(client: Client) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID!);
      // 期限切れのロールを持ったユーザーIDの配列を取得
      for (const roleId of [
        ROLE_IDS.GAME_SHORT,
        ROLE_IDS.GAME_LONG,
        ROLE_IDS.GAME_PASS,
      ]) {
        const expiredRoleUserIds = await getExpiredRoleUserIds(roleId);
        if (expiredRoleUserIds.length === 0) {
          continue;
        }
        for (const userId of expiredRoleUserIds) {
          let member: GuildMember;
          // 各ユーザーごとにエラーハンドリングを行う（1人のエラーで他のユーザーの処理が止まらないように）
          try {
            member = await guild.members.fetch(userId);
          } catch (error: any) {
            console.error(
              `removeExpiredRole エラー (userId: ${userId}, roleId: ${roleId}):`,
              error.message || error,
            );
            await setIsDeletedToTrue(userId, roleId);
            continue;
          }

          try {
            await deleteRole(member, roleId);
            await setIsDeletedToTrue(userId, roleId);
          } catch (error: any) {
            // メンバーが取得できない場合（サーバーを抜けているなど）やロール削除に失敗した場合はスキップ
            console.error(
              `removeExpiredRole エラー (userId: ${userId}, roleId: ${roleId}):`,
              error.message || error,
            );
            continue;
          }
        }
      }
    } catch (error: any) {
      throw error;
    }
  }
}
