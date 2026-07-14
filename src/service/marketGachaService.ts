import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
} from "discord.js";
import { RowDataPacket } from "mysql2";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";

import {
  MARKET_GACHA_DAILY_LIMIT,
  MARKET_GACHA_PRICE,
  MarketGachaAudioCategory,
  MarketGachaPrize,
  selectMarketGachaPrize,
} from "../constant/marketGacha";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { BOT_ID } from "../constant/id";
import { CURRENCY_NAMES } from "../constant/currency";
import { DbService } from "./dbService";
import { HotelFreeTicketService } from "./hotelFreeTicketService";
import { HOTEL_FREE_TICKET_TYPE, HotelFreeTicketType } from "../constant/hotel";

type WalletRow = RowDataPacket & { wallet: number };
type AudioAssetRow = RowDataPacket & {
  id: number;
  performer_name: string;
  file_name: string;
  public_url: string;
};

type MarketGachaAudioAsset = {
  id: number;
  performerName: string;
  fileName: string;
  publicUrl: string;
};

export class MarketGachaService {
  private static getHotelTicketGrant(prize: MarketGachaPrize):
    | { ticketType: HotelFreeTicketType; quantity: number }
    | undefined {
    switch (prize.key) {
      case "secret_free_1":
        return { ticketType: HOTEL_FREE_TICKET_TYPE.SECRET, quantity: 1 };
      case "secret_free_3":
        return { ticketType: HOTEL_FREE_TICKET_TYPE.SECRET, quantity: 3 };
      case "freedom_free_1":
        return { ticketType: HOTEL_FREE_TICKET_TYPE.FREEDOM, quantity: 1 };
      default:
        return undefined;
    }
  }

  private static getTicketInstructions(
    prize: MarketGachaPrize,
    audioAsset?: MarketGachaAudioAsset,
  ): string {
    if (audioAsset) {
      return `**${audioAsset.performerName}** の当選ファイルです。下の「当選ファイルを開く」から受け取ってください。`;
    }

    if (this.getHotelTicketGrant(prize)) {
      return "無料券をホテルパネルで使える状態にしました。";
    }

    return "既存のチケットBotでチケットを作成し、\n`市場ガチャ当選：" +
      prize.label +
      "`\nと当選メッセージを提示してください。";
  }

  private static async selectAudioAsset(
    connection: PoolConnection,
    category?: MarketGachaAudioCategory,
  ): Promise<MarketGachaAudioAsset | undefined> {
    if (!category) {
      return undefined;
    }

    const [rows] = await connection.execute<AudioAssetRow[]>(
      `SELECT id, performer_name, file_name, public_url
       FROM market_gacha_audio_assets
       WHERE category = ? AND is_active = 1
       ORDER BY RAND()
       LIMIT 1`,
      [category],
    );
    const asset = rows[0];
    if (!asset) {
      throw new Error("当選ファイルがまだ登録されていません。運営へお問い合わせください。");
    }

    return {
      id: Number(asset.id),
      performerName: asset.performer_name,
      fileName: asset.file_name,
      publicUrl: asset.public_url,
    };
  }

  /**
   * 市場ガチャを一回実行する。日次上限、残高引落し、抽選記録を単一トランザクションで確定する。
   */
  static async draw(interaction: ButtonInteraction): Promise<void> {
    const prize = selectMarketGachaPrize(Math.random());
    const connection = await DbService.getConnection();

    let remainingDraws = 0;
    let afterWallet = 0;
    let audioAsset: MarketGachaAudioAsset | undefined;
    try {
      await connection.beginTransaction();

      const [drawRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id
         FROM market_gacha_draws
         WHERE user_id = ?
           AND created_at >= CONVERT_TZ(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), '+09:00', '+00:00')
           AND created_at < CONVERT_TZ(DATE_ADD(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')), INTERVAL 1 DAY), '+09:00', '+00:00')
         FOR UPDATE`,
        [interaction.user.id],
      );
      if (drawRows.length >= MARKET_GACHA_DAILY_LIMIT) {
        throw new Error(`市場ガチャは1日${MARKET_GACHA_DAILY_LIMIT}回までです。`);
      }

      // 当選ファイルが未登録なら、料金を引き落とす前に中止する。
      audioAsset = await this.selectAudioAsset(connection, prize.audioCategory);

      const [userRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [interaction.user.id],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [BOT_ID],
      );
      const user = userRows[0];
      const bot = botRows[0];
      if (!user || !bot) {
        throw new Error("市場ガチャの口座情報が見つかりません。");
      }
      if (Number(user.wallet) < MARKET_GACHA_PRICE) {
        throw new Error(
          `残高が不足しています。必要な残高: ${MARKET_GACHA_PRICE.toLocaleString()}${CURRENCY_NAMES}`,
        );
      }

      afterWallet = Number(user.wallet) - MARKET_GACHA_PRICE;
      const botAfterWallet = Number(bot.wallet) + MARKET_GACHA_PRICE;
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
        afterWallet,
        interaction.user.id,
      ]);
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
        botAfterWallet,
        BOT_ID,
      ]);
      const [drawResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO market_gacha_draws (user_id, prize_key, prize_name) VALUES (?, ?, ?)",
        [interaction.user.id, prize.key, prize.label],
      );
      if (audioAsset) {
        await connection.execute(
          `INSERT INTO market_gacha_audio_deliveries (draw_id, audio_asset_id)
           VALUES (?, ?)`,
          [drawResult.insertId, audioAsset.id],
        );
      }
      const hotelTicketGrant = this.getHotelTicketGrant(prize);
      if (hotelTicketGrant) {
        await HotelFreeTicketService.grant(
          connection,
          interaction.user.id,
          hotelTicketGrant.ticketType,
          hotelTicketGrant.quantity,
        );
      }
      await connection.execute(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW,
          MARKET_GACHA_PRICE,
          interaction.user.id,
          BOT_ID,
          afterWallet,
          botAfterWallet,
          prize.label,
        ],
      );

      await connection.commit();
      remainingDraws = MARKET_GACHA_DAILY_LIMIT - drawRows.length - 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Discord添付の容量上限を受けず、R2の元ファイルを確実に渡せるリンク方式にする。
    const audioComponents = audioAsset
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel("当選ファイルを開く")
              .setStyle(ButtonStyle.Link)
              .setURL(audioAsset.publicUrl),
          ),
        ]
      : [];
    await interaction.editReply({
      content:
        "🎉 **市場ガチャ当選！**\n" +
        `景品：**${prize.label}**\n` +
        `本日の残り回数：${remainingDraws}回\n\n` +
        this.getTicketInstructions(prize, audioAsset),
      components: audioComponents,
    });
  }
}
