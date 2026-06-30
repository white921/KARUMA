// import dayjs from "dayjs";
// import { Client } from "discord.js";

// import { DbService } from "./dbService";

// import { ROLE_IDS } from "../constant/id";

// export class RemindToMadoromiService {
//   /**
//    * まどろみロールが付与された時に、RoleManagementLogsテーブルにインサート
//    * @param userId ユーザーID
//    */
//   static async insertIntoRoleManagementLogs(userId: string) {
//     try {
//       const now = dayjs().tz("Asia/Tokyo");
//       const expire_at_JST = now.add(5, "day");
//       const expire_at_UTC = expire_at_JST.tz("UTC");
//       const connection = await DbService.getConnection();
//       await connection.execute(
//         `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at) 
//         VALUES (?, ?, ?, ?)
//         ON DUPLICATE KEY UPDATE
//         is_deleted = ?,
//         expire_at = ?,
//         updated_at = CURRENT_TIMESTAMP;`,
//         [
//           userId,
//           ROLE_IDS.CORE_MEMBER_ROLES.MADOROMI,
//           false,
//           expire_at_UTC.toDate(),
//           false,
//           expire_at_UTC.toDate(),
//         ]
//       );
//       await connection.release();
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * まどろみロールが付与されて5日以上経過しているユーザーをチェック
//    * @returns まどろみロールが付与されて5日以上経過しているユーザーのID一覧
//    */
//   static async checkExpireRole() {
//     try {
//       const now = new Date();
//       const connection = await DbService.getConnection();
//       const [rows]: any = await connection.execute(
//         `SELECT user_id FROM role_management_logs WHERE is_deleted = ? AND role_id = ? AND expire_at <= ?;`,
//         [false, ROLE_IDS.CORE_MEMBER_ROLES.MADOROMI, now]
//       );
//       await connection.release();
//       return rows;
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * まどろみロールが長期間付与されている人へDM送信
//    * @param userId ユーザーID
//    * @param client クライアント
//    */
//   static async sendDirectMessage(userId: string, client: Client) {
//     try {
//       // ユーザー取得のエラーハンドリング
//       const member = await client.users.fetch(userId).catch(() => null);
//       if (!member) {
//         // ユーザーが存在しない場合（サーバーを抜けているなど）は、is_deletedをtrueにして次回の再試行を防ぐ
//         await this.setIsDeletedToTrue(userId);
//         return;
//       }

//       try {
//         await member.send(
//           `# > <:rev_0:1431861882712625293> 眠りの門よりお知らせ\n\n【**サーバーに加入してから2週間経過後も説明会を受けていないメンバーは__キック対象__となります**】\n\nまだ説明会を受けていないメンバーは速やかにご参加ください。\n\n-# ＊説明会は毎日21時・22時に行っています。\n-# ＊時間外面接もhttps://discord.com/channels/1424765533852799077/1424933485243531325にてチケットを発行して頂ければ対応可能な面接官がいましたら対応可能です。\n## 説明会にご参加の方は[こちら](https://discord.com/channels/1424765533852799077/1424987767540023408)から日程記入をお願いします`
//         );
//         // DM送信に成功した場合のみ、is_deletedをtrueにする
//         await this.setIsDeletedToTrue(userId);
//       } catch (error: any) {
//         // BotからのDM送信が許可されていない場合などDM送信に失敗した場合は、is_deletedをtrueにして次回の再試行を防ぐ
//         await this.setIsDeletedToTrue(userId);
//         // エラーをthrowする（executeRemindToMadoromiでキャッチされる）
//         throw error;
//       }
//     } catch (error: any) {
//       // 予期しないエラー（setIsDeletedToTrueでエラーが発生した場合など）をthrowする
//       throw error;
//     }
//   }

//   /**
//    * まどろみロールの期限切れをチェックしてダイレクトメッセージを送信
//    * @param client クライアント
//    */
//   static async executeRemindToMadoromi(client: Client) {
//     try {
//       const rows = await this.checkExpireRole();
//       if (!rows || rows.length === 0) {
//         return;
//       }
//       for (const row of rows) {
//         const userId = String(row.user_id);
//         // 各ユーザーごとにエラーハンドリングを行う（1人のエラーで他のユーザーへの送信が止まらないように）
//         try {
//           await this.sendDirectMessage(userId, client);
//         } catch (error: any) {
//           continue;
//         }
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * まどろみロールの期限切れをチェックしてダイレクトメッセージを送信を定期実行
//    * @param client クライアント
//    */
//   static async startRemindToMadoromi(client: Client) {
//     setInterval(async () => {
//       try {
//         await this.executeRemindToMadoromi(client);
//       } catch (error: any) {
//         throw error;
//       }
//     }, 60 * 60 * 1000); // 1時間 = 60 * 60 * 1000 ミリ秒
//   }

//   /**
//    * メッセージを送った人にはもう送らないようにis_deleted=trueに更新
//    * @param userId ユーザーID
//    */
//   static async setIsDeletedToTrue(userId: string) {
//     try {
//       const connection = await DbService.getConnection();
//       await connection.execute(
//         `UPDATE role_management_logs SET is_deleted = ? WHERE user_id = ? AND role_id = ?;`,
//         [true, userId, ROLE_IDS.CORE_MEMBER_ROLES.MADOROMI]
//       );
//       await connection.release();
//     } catch (error) {
//       throw error;
//     }
//   }
// }
