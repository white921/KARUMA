import { RowDataPacket } from "mysql2";
import dayjs from "dayjs";
import { Guild, ThreadChannel } from "discord.js";

import { Action } from "../../type/currency/action";
import { salesData } from "../../type/market/salesManagement";

import { DbService } from "../system/dbService";

import { ACTION_TYPES } from "../../constant/currency/action";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { THREAD_IDS } from "../../constant/shared/id";

export const MONTHLY_GAME_SALES_CATEGORIES = [
  {
    label: "遊戯VC作成",
    actionTypes: [ACTION_TYPES.GAME_VC_CREATE],
  },
  {
    label: "ゲームパス（1か月）",
    actionTypes: [ACTION_TYPES.GAME_PASS_ONE_MONTH, ACTION_TYPES.GAME_PASS],
  },
  {
    label: "ゲームパス（2週間）",
    actionTypes: [ACTION_TYPES.GAME_PASS_TWO_WEEKS],
  },
  {
    label: "罪人用VC接続権限購入",
    actionTypes: [ACTION_TYPES.GAME_CRIMINAL_ACCESS],
  },
  {
    label: "罪人用VC作成",
    actionTypes: [ACTION_TYPES.GAME_CRIMINAL_VC_CREATE],
  },
] as const;

export class SalesManagementService {
  /**
   * actionsテーブルからcommand_name毎に先月の売り上げデータを取得する
   * 日本時間の1日00:00から月末23:59までをUTCに変換した範囲で取得
   * @param commandName コマンド名
   */
  static async getSalesDataLastMonth(commandName: string): Promise<Action[]> {
    // 現在の時刻をAsia/Tokyoで取得し、先月の範囲をUTCで取得
    const nowJST = dayjs().tz("Asia/Tokyo");
    const lastMonthJST = nowJST.subtract(1, "month");
    const firstOfLastMonthJST = lastMonthJST.startOf("month");
    const startUTC = firstOfLastMonthJST.tz("UTC");
    const lastOfLastMonthJST = lastMonthJST.endOf("month");
    const endUTC = lastOfLastMonthJST.tz("UTC");

    const connection = await DbService.getConnection();
    try {
      // 先月の売り上げデータを取得（UTC時間で範囲指定）
      const [rows] = await connection.execute<Action[] & RowDataPacket[]>(
        `SELECT * FROM actions 
         WHERE command_name = ? 
         AND created_at >= ? 
         AND created_at <= ?;`,
        [commandName, startUTC.toDate(), endUTC.toDate()]
      );
      return rows;
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * command_nameごとに売り上げデータを出力する
   * @param actions 売り上げデータ
   */
  static async getSalesDataByType(): Promise<Map<string, salesData>> {
    const salesDataMap = new Map<string, salesData>();
    for (const category of MONTHLY_GAME_SALES_CATEGORIES) {
      const actionsByType = (
        await Promise.all(
          category.actionTypes.map((actionType) =>
            this.getSalesDataLastMonth(actionType),
          ),
        )
      ).flat();
      const totalAmountOfThisType = actionsByType.reduce(
        (acc: number, action: Action) => acc + action.amount,
        0
      );
      const count = actionsByType.length;
      salesDataMap.set(category.label, { totalAmountOfThisType, count });
    }
    return salesDataMap;
  }

  /**
   * 得られたデータを出力する
   * @param salesDataMap 売上データ
   */
  static async createSalesDataMessage(
    salesDataMap: Map<string, salesData>
  ): Promise<string[]> {
    const messages: string[] = [];
    const categoryLabels = Array.from(salesDataMap.keys());
    let totalAmount = 0;
    for (const categoryLabel of categoryLabels) {
      const { totalAmountOfThisType, count } = salesDataMap.get(categoryLabel)!;
      const message = `${categoryLabel}\n${count}件 ${totalAmountOfThisType.toLocaleString(
        "ja-JP"
      )} ${CURRENCY_NAMES}\n`;
      messages.push(message);
      totalAmount += totalAmountOfThisType;
    }
    messages.push(
      `**合計金額\n${totalAmount.toLocaleString("ja-JP")} ${CURRENCY_NAMES}**\n`
    );
    return messages;
  }

  /**
   * 集計メッセージを送信
   * @param guild サーバー
   */
  static async executeSalesDataMessage(guild: Guild): Promise<void> {
    const threadId = THREAD_IDS.SALES_DATA_THREAD.trim();
    if (!threadId) {
      console.info(
        "[SalesManagement] monthly sales report skipped: SALES_DATA_THREAD is not configured",
      );
      return;
    }

    const salesDataMap = await this.getSalesDataByType();
    const messages = await this.createSalesDataMessage(salesDataMap);

    const thread = await guild.channels.fetch(threadId);
    if (!thread?.isThread() || !thread.isTextBased()) {
      throw new Error(
        `[SalesManagement] configured destination is not a text thread: ${threadId}`,
      );
    }

    const nowJST = dayjs().tz("Asia/Tokyo");
    const lastMonthJST = nowJST.subtract(1, "month");
    const summaryTitle = lastMonthJST.format("YYYY年MM月");

    await (thread as ThreadChannel).send(
      `**${summaryTitle}**\n${messages.join("\n")}`,
    );
  }
}
