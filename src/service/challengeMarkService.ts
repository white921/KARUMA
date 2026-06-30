// import { DbService } from "./dbService";
// import dayjs from "dayjs";
// import utc from "dayjs/plugin/utc";
// import timezone from "dayjs/plugin/timezone";
// import {
//   Guild,
//   Client,
//   TextChannel,
//   ChannelType,
//   ForumChannel,
//   GuildMember,
//   ThreadChannel,
// } from "discord.js";
// import { deleteRole } from "../util/role";
// import {
//   FORUM_IDS,
//   ROLE_IDS,
//   TEXT_CHANNEL_IDS,
//   THREAD_IDS,
// } from "../constant/id";

// dayjs.extend(utc);
// dayjs.extend(timezone);

// export class ChallengeMarkService {
//   static async insertIntoRoleManagementLogs(userId: string) {
//     const now = dayjs().tz("Asia/Tokyo");
//     const tomorrowZero = now.add(1, "day").startOf("day");
//     const expire_at_JST = tomorrowZero.add(14, "day");
//     const expire_at_UTC = expire_at_JST.tz("UTC");

//     const connection = await DbService.getConnection();
//     await connection.execute(
//       `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at) 
//       VALUES (?, ?, ?, ?)
//       ON DUPLICATE KEY UPDATE
//       is_deleted = ?,
//       expire_at = ?,
//       updated_at = CURRENT_TIMESTAMP;`,
//       [
//         userId,
//         ROLE_IDS.TYOSEN_NO_SHIRUSHI,
//         false,
//         expire_at_UTC.toDate(),
//         false,
//         expire_at_UTC.toDate(),
//       ]
//     );
//     await connection.release();
//   }

//   /**
//    * 期限切れの挑戦マークをチェックする
//    * @param guild ギルドオブジェクト
//    * @returns 期限切れと判定されたレコード一覧
//    */
//   static async checkExpireRole(guild: Guild) {
//     try {
//       // 現在時刻を基準に期限切れを判定
//       const now = new Date();
//       const connection = await DbService.getConnection();
//       const [rows]: any = await connection.execute(
//         `SELECT id, user_id FROM role_management_logs WHERE is_deleted = ? AND role_id = ? AND expire_at <= ?;`,
//         [false, ROLE_IDS.TYOSEN_NO_SHIRUSHI, now]
//       );
//       await connection.release();

//       if (!rows || rows.length === 0) {
//         return;
//       }

//       const filteredRows = await Promise.all(
//         rows.map(async (row: any) => {
//           try {
//             await guild.members.fetch(row.user_id);
//             return row;
//           } catch (error) {
//             return null;
//           }
//         })
//       );
//       return filteredRows.filter((row) => row !== null);
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * 期限切れの挑戦の印ロールを剥奪する
//    * @params rows 期限切れと判定されたレコード一覧
//    */
//   static async deleteMarkRole(rows: any, guild: Guild) {
//     try {
//       const connection = await DbService.getConnection();
//       for (const r of rows) {
//         const id = r.id;
//         const userId = String(r.user_id);

//         const member = await guild?.members.fetch(userId);
//         await deleteRole(member, ROLE_IDS.TYOSEN_NO_SHIRUSHI);

//         await connection.execute(
//           `UPDATE role_management_logs SET is_deleted = ? WHERE id = ?;`,
//           [true, id]
//         );
//       }
//       await connection.release();
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * 指定されたTCへロール剥奪の通知を送信
//    * @param rows 期限切れと判定されたレコード一覧
//    */
//   static async sendMessage(rows: any, client: Client) {
//     try {
//       const channelId = TEXT_CHANNEL_IDS.ANNAIKAN;
//       const channel = await client.channels.fetch(channelId);
//       if (channel && channel.isTextBased()) {
//         for (const r of rows) {
//           const userId = r.user_id;
//           await (channel as TextChannel).send(
//             `【挑戦期間満了のお知らせ】\n<@${userId}>の<@&${ROLE_IDS.TYOSEN_NO_SHIRUSHI}>が14日経過しました。`
//           );
//         }
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * ロール剥奪ログを送信
//    * @param rows
//    * @param client
//    * @returns
//    */
//   static async sendLog(rows: any, client: Client) {
//     try {
//       let thread;
//       const threadId = THREAD_IDS.TYOSENN_LOG;
//       thread = await client.channels.fetch(threadId);
//       if (thread && thread.isThread() && thread.isTextBased()) {
//         for (const r of rows) {
//           const userId = r.user_id;
//           await (thread as ThreadChannel).send(
//             `<@${userId}>の挑戦期間が満了致しました。`
//           );
//         }
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * 挑戦の印用の評価シートを作成
//    * @param client
//    * @param targetMember
//    */
//   static async createChallengeEvaluateSheet(
//     client: Client,
//     targetMember: GuildMember
//   ) {
//     try {
//       const forumId = FORUM_IDS.TYOSEN;
//       let forum;
//       try {
//         forum = await client.channels.fetch(forumId);
//       } catch (error) {
//         throw error;
//       }

//       if (forum && forum.type === ChannelType.GuildForum) {
//         await (forum as ForumChannel).threads.create({
//           name: targetMember.displayName,
//           message: {
//             content: `<@${targetMember.id}>の評価シート`,
//           },
//         });
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * 期限切れの挑戦の印ロールを剥奪して、ログを流す
//    */
//   static async executeChallengeMark(guild: Guild, client: Client) {
//     try {
//       const filteredList = await this.checkExpireRole(guild);

//       if (!filteredList || filteredList.length === 0) {
//         return;
//       }

//       await this.deleteMarkRole(filteredList, guild);
//       await this.sendMessage(filteredList, client);
//       await this.sendLog(filteredList, client);
//     } catch (error) {
//       throw error;
//     }
//   }
// }
