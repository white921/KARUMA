import { ButtonInteraction } from "discord.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { BOT_ID } from "../constant/id";
import { selectOmikujiPrize } from "../constant/omikuji";
import { DbService } from "./dbService";

type WalletRow = RowDataPacket & { wallet: number };

export function getJapanDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error("日本時間の日付を取得できませんでした。");
  }
  return `${year}-${month}-${day}`;
}

export class OmikujiService {
  /**
   * 日本時間で一日一回だけ抽選し、当選記録・残高・取引履歴を同一トランザクションで確定する。
   */
  static async draw(interaction: ButtonInteraction): Promise<void> {
    const prize = selectOmikujiPrize(Math.random());
    const drawDate = getJapanDate();
    const connection = await DbService.getConnection();

    let afterWallet = 0;
    try {
      await connection.beginTransaction();
      try {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO omikuji_draws (user_id, draw_date, fortune, amount)
           VALUES (?, ?, ?, ?)`,
          [interaction.user.id, drawDate, prize.fortune, prize.amount],
        );
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new Error("おみくじは日本時間で1日1回までです。次の0:00以降に引けます。");
        }
        throw error;
      }

      const [userRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const user = userRows[0];
      const bot = botRows[0];
      if (!user || !bot) {
        throw new Error("おみくじの口座情報が見つかりません。");
      }

      afterWallet = Number(user.wallet) + prize.amount;
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?",
        [afterWallet, interaction.user.id],
      );
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          PANEL_COMMAND_NAMES.OMIKUJI_DRAW,
          prize.amount,
          BOT_ID,
          interaction.user.id,
          Number(bot.wallet),
          afterWallet,
          prize.fortune,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await interaction.editReply({
      content:
        `🎊 **${prize.fortune}！**\n` +
        `**${prize.amount.toLocaleString()}${CURRENCY_NAMES}** を獲得しました！\n` +
        `現在の残高：${afterWallet.toLocaleString()}${CURRENCY_NAMES}`,
    });
  }
}
