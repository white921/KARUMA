// import { Guild } from "discord.js";

// import {
//   addRole,
//   removeRolesExcept,
//   hasRole,
//   getRoleNameById,
//   getUserIdsByRoleId,
// } from "../util/role";
// import { validateSubAccount } from "../util/subAccount";

// import { AccountService } from "./accountService";
// import { ActionService } from "./actionService";
// import { DbService } from "./dbService";

// import { DebitResult } from "../type/account";

// import { BOT_ID, ROLE_IDS, TEXT_CHANNEL_IDS } from "../constant/id";
// import {
//   MONTHLY_DEBIT_AMOUNTS,
//   MONTHLY_DEBIT_ROLE_IDS,
// } from "../constant/monthlyDebit";
// import { CURRENCY_NAMES } from "../constant/currency";
// import { COMMAND_NAMES } from "../constant/command";

// export class MonthlyDebitService {
//   /**
//    * 月の引き落とし処理
//    * @param guild ギルド
//    */
//   static async debitMonthly(guild: Guild) {
//     // ロールごとの残高不足ユーザーを保存するマップ
//     const insufficientBalanceByRole: Record<string, DebitResult[]> = {};

//     // すべてのメンバーに対してチェック
//     for (const roleId of Object.values(MONTHLY_DEBIT_ROLE_IDS)) {
//       const targetMemberIds = await getUserIdsByRoleId(guild, roleId);
//       for (const memberId of targetMemberIds) {
//         const member = await guild.members.fetch(memberId);
//         // そのロールに給与設定がない場合はスキップ
//         const amount = MONTHLY_DEBIT_AMOUNTS[roleId];
//         if (!amount) {
//           continue;
//         }
//         // そのロールを持っているか判定
//         if (await hasRole(member, roleId)) {
//           // 引き落とし処理
//           const roleName = await getRoleNameById(guild, roleId);
//           const usersWithInsufficientBalance = await this.debit(
//             guild,
//             member.id,
//             roleName,
//             amount,
//           );

//           // 残高不足ユーザーをロールごとに集約
//           if (usersWithInsufficientBalance.length > 0) {
//             if (!insufficientBalanceByRole[roleId]) {
//               insufficientBalanceByRole[roleId] = [];
//             }
//             insufficientBalanceByRole[roleId].push(
//               ...usersWithInsufficientBalance,
//             );
//           }
//         }
//       }
//     }

//     // ロールごとにまとめてメッセージを送信
//     for (const [roleId, usersWithInsufficientBalance] of Object.entries(
//       insufficientBalanceByRole,
//     )) {
//       await this.sendDebitResultMessage(
//         guild,
//         roleId,
//         usersWithInsufficientBalance,
//       );
//     }
//   }

//   /**
//    * 引き落とし処理
//    * @param guild ギルド
//    * @param userId ユーザーID
//    * @param roleName ロール名
//    * @param amount 金額
//    * @returns 残高が足りないユーザーの配列
//    */
//   static async debit(
//     guild: Guild,
//     userId: string,
//     roleName: string,
//     amount: number,
//   ) {
//     try {
//       // 残高が足りないユーザーの情報を保存する配列
//       const usersWithInsufficientBalance: DebitResult[] = [];

//       if (await validateSubAccount(userId)) {
//         return usersWithInsufficientBalance;
//       }

//       // アカウントが存在しない場合はスキップ
//       if (!(await AccountService.hasAccount(userId))) {
//         return usersWithInsufficientBalance;
//       }

//       const botAccountList =
//         await AccountService.getAccountByUserId(BOT_ID);
//       const toUserAccountList = await AccountService.getAccountByUserId(userId);

//       // アカウントが存在しない場合はスキップ
//       if (!botAccountList[0] || !toUserAccountList[0]) {
//         return usersWithInsufficientBalance;
//       }

//       const botAccount = botAccountList[0];
//       const toUserAccount = toUserAccountList[0];

//       const member = await guild.members.fetch(userId);
//       const beforeWallet = toUserAccount.wallet;

//       let afterWallet = beforeWallet - amount;

//       if (afterWallet < 0) {
//         // 残高が足りない場合は配列に保存
//         usersWithInsufficientBalance.push({ userId, beforeWallet });

//         // 指定したロール以外を削除（外部管理ボットのロールは削除しない）
//         await removeRolesExcept(member);
//         await addRole(member, ROLE_IDS.AKUMU_MENNDANNMATI);

//         afterWallet = 0;
//       }

//       const connection = await DbService.getConnection();

//       // 残高更新
//       await connection.execute(
//         `UPDATE accounts
//       SET
//         wallet = ?
//       WHERE user_id = ?
//       ;`,
//         [afterWallet, userId],
//       );

//       connection.release();

//       const comment = await this.createDebitComment(roleName);

//       // アクション記録
//       await ActionService.createActionLog(
//         COMMAND_NAMES.DEBIT,
//         amount,
//         BOT_ID,
//         userId,
//         botAccount.wallet,
//         afterWallet,
//         comment,
//       );

//       return usersWithInsufficientBalance;
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * 引き落としのコメント作成
//    * @param roleName ロール名
//    * @returns コメント
//    */
//   static async createDebitComment(roleName: string): Promise<string> {
//     const now = new Date();
//     const year = now.getFullYear();
//     const month = now.getMonth() + 1;
//     return `${year}/${month} ${roleName}の引き落とし`;
//   }

//   /**
//    * 引き落とし結果を指定チャンネルに送信
//    * @param guild ギルド
//    * @param roleId ロールID
//    * @param usersWithInsufficientBalance 残高が足りないユーザーの配列
//    */
//   static async sendDebitResultMessage(
//     guild: Guild,
//     roleId: string,
//     usersWithInsufficientBalance: DebitResult[],
//   ) {
//     let channelId;

//     switch (roleId) {
//       case ROLE_IDS.MAYOIBITO:
//         channelId = TEXT_CHANNEL_IDS.ANNAIKAN;
//         const channel = await guild.channels.fetch(channelId);
//         if (!channel || !channel.isTextBased()) {
//           return;
//         }
//         if (usersWithInsufficientBalance.length > 0) {
//           const mentionMessage = `<@&${ROLE_IDS.MAYOINOMORI_TOHKATSU}> <@&${ROLE_IDS.MAYOINOMORI_TOHKATSU_HOSA}> <@&${ROLE_IDS.ANNAIKAN}>\n【迷い人住民税】\n残高が不足しているユーザーが${usersWithInsufficientBalance.length}名います。\n\n`;
//           await channel.send(mentionMessage);
//           for (const user of usersWithInsufficientBalance) {
//             const userMessage = `<@${user.userId}>  引き落とし前の残高: **${user.beforeWallet} ${CURRENCY_NAMES}**\n`;
//             await channel.send(userMessage);
//           }
//         } else {
//           await channel.send(
//             `<@&${ROLE_IDS.MAYOINOMORI_TOHKATSU}> <@&${ROLE_IDS.MAYOINOMORI_TOHKATSU_HOSA}> <@&${ROLE_IDS.ANNAIKAN}>\n【迷い人住民税】\n残高が不足しているユーザーはいませんでした。`,
//           );
//         }
//         break;
//       default:
//         break;
//     }
//   }
// }
