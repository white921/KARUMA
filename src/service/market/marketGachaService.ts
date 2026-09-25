import { randomUUID } from "node:crypto";
import { GachaCoinActivationService } from "./gachaCoinActivationService";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ThreadChannel,
} from "discord.js";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { ACTION_TYPES } from "../../constant/currency/action";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { BOT_ID, THREAD_IDS } from "../../constant/shared/id";
import { INVITE_POINT_GACHA_COST } from "../../constant/market/invitePoint";
import {
  AUDIO_PRIZE_PROHIBITION_NOTICE,
  MARKET_GACHA_DAILY_LIMIT,
  MARKET_GACHA_PRICE,
  MARKET_GACHA_CONFIRMATION_PREFIX,
  MARKET_GACHA_CONFIRMATION_TTL_MS,
  selectMarketGachaPrize,
} from "../../constant/market/marketGacha";
import type {
  AudioAssetRow,
  MarketGachaAudioAsset,
  MarketGachaAudioCategory,
  MarketGachaPaymentSource,
  MarketGachaPrize,
  WalletRow,
} from "../../type/market/marketGacha";
import { DbService } from "../system/dbService";
import { InvitePointService } from "./invitePointService";
import { ItemService } from "../inventory/itemService";
import { GuildMemberCacheService } from "../system/guildMemberCacheService";
import { formatMarketGachaResult, isSageOrHigherPerformer, performerMention, resolveMarketGachaPrize } from "./marketGachaResult";
import { selectWeightedAudioAsset } from "./marketGachaAudioSelection";

export function createMarketGachaPaymentSelectionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_CURRENCY)
      .setLabel(`5,000${CURRENCY_NAMES}で引く`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_INVITE_POINT)
      .setLabel(`招待ポイント${INVITE_POINT_GACHA_COST}ptで引く`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.MARKET_GACHA_CANCEL)
      .setLabel("キャンセル")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function createMarketGachaConfirmationRow(confirmationId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MARKET_GACHA_CONFIRMATION_PREFIX}:confirm:${confirmationId}`)
      .setLabel("この内容で引く")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${MARKET_GACHA_CONFIRMATION_PREFIX}:back:${confirmationId}`)
      .setLabel("支払い方法を選び直す")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${MARKET_GACHA_CONFIRMATION_PREFIX}:cancel:${confirmationId}`)
      .setLabel("キャンセル")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function formatMarketGachaDrawLog(
  userId: string,
  prize: MarketGachaPrize,
  paymentSource: MarketGachaPaymentSource,
): string {
  const payment =
    paymentSource === "currency"
      ? `5,000${CURRENCY_NAMES}`
      : `招待ポイント${INVITE_POINT_GACHA_COST}pt`;
  return `🎰 **市場ガチャログ**\nユーザー: <@${userId}>\n景品: **${prize.label}**\n支払い: ${payment}`;
}

type GachaConfirmation = { userId: string; guildId: string | null; channelId: string; expiresAt: number; paymentSource: MarketGachaPaymentSource };

export class MarketGachaService {
  private static confirmations = new Map<string, GachaConfirmation>();

  static async handleConfirmation(interaction: ButtonInteraction): Promise<void> {
    const [prefix, action, id, extra] = interaction.customId.split(":");
    const confirmation = this.confirmations.get(id);
    if (prefix !== MARKET_GACHA_CONFIRMATION_PREFIX || extra !== undefined || !["confirm", "cancel", "back"].includes(action) || !confirmation || confirmation.expiresAt <= Date.now()) {
      throw new Error("この確認画面は期限切れ、または処理済みです。パネルからやり直してください。");
    }
    if (confirmation.userId !== interaction.user.id || confirmation.guildId !== interaction.guildId || confirmation.channelId !== interaction.channelId) {
      throw new Error("この確認画面は操作できません。");
    }
    this.confirmations.delete(id);
    await interaction.editReply({ content: action === "cancel" ? "市場ガチャをキャンセルしました。" : "処理しています…", components: [], embeds: [] });
    if (action === "back") await this.showPaymentSelection(interaction);
    else if (action === "confirm") await this.draw(interaction, confirmation.paymentSource);
  }
  static async showPaymentSelection(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({
      content:
        "**市場ガチャの支払い方法を選択してください。**\n" +
        `5,000${CURRENCY_NAMES}または招待ポイント${INVITE_POINT_GACHA_COST}ptを消費します。`,
      components: [createMarketGachaPaymentSelectionRow()],
    });
  }

  static async showDrawConfirmation(
    interaction: ButtonInteraction,
    paymentSource: MarketGachaPaymentSource,
  ): Promise<void> {
    const paymentDescription =
      paymentSource === "currency"
        ? `5,000${CURRENCY_NAMES}`
        : `招待ポイント${INVITE_POINT_GACHA_COST}pt`;
    const id = randomUUID();
    this.confirmations.set(id, { userId: interaction.user.id, guildId: interaction.guildId,
      channelId: interaction.channelId, expiresAt: Date.now() + MARKET_GACHA_CONFIRMATION_TTL_MS, paymentSource });
    setTimeout(() => this.confirmations.delete(id), MARKET_GACHA_CONFIRMATION_TTL_MS).unref();
    try {
      await interaction.editReply({
        content: `**確認**\n${paymentDescription}を消費して市場ガチャを引きます。\nよろしいですか？`,
        components: [createMarketGachaConfirmationRow(id)],
      });
    } catch (error) {
      this.confirmations.delete(id);
      throw error;
    }
  }

  private static async sendAudioPrizeDm(
    interaction: ButtonInteraction,
    prize: MarketGachaPrize,
    audioAsset: MarketGachaAudioAsset,
  ): Promise<boolean> {
    const audioPrizeName = prize.audioCategory === "superchat" ? "サプボ" : "歌みた";
    try {
      await interaction.user.send(
        `🎉 ${performerMention(audioAsset)}の${audioPrizeName}です！\nファイルURL: <${audioAsset.publicUrl}>\n\n${AUDIO_PRIZE_PROHIBITION_NOTICE}`,
      );
      return true;
    } catch (error) {
      console.error("[MarketGachaService] failed to send audio prize DM", {
        userId: interaction.user.id,
        prizeKey: prize.key,
        error,
      });
      return false;
    }
  }

  private static async sendDrawLog(
    interaction: ButtonInteraction,
    prize: MarketGachaPrize,
    paymentSource: MarketGachaPaymentSource,
  ): Promise<void> {
    try {
      const channel = await interaction.client.channels.fetch(
        THREAD_IDS.MARKET_GACHA_LOG_THREAD,
      );
      if (!channel || !channel.isThread() || !channel.isTextBased()) {
        throw new Error("市場ガチャログスレッドが見つからないか、書き込みできません。");
      }
      await (channel as ThreadChannel).send(
        formatMarketGachaDrawLog(interaction.user.id, prize, paymentSource),
      );
    } catch (error) {
      // ログ送信の失敗によって、確定済みのガチャ結果を利用者へ返せなくしない。
      console.error("[MarketGachaService] failed to send draw log", error);
    }
  }

  private static async selectAudioAsset(
    connection: PoolConnection,
    category?: MarketGachaAudioCategory,
    performerIds: string[] = [],
  ): Promise<MarketGachaAudioAsset | undefined> {
    if (!category) {
      return undefined;
    }

    if (!performerIds.length) throw new Error("賢者以上の当選音源がありません。運営へお問い合わせください。");
    const [rows] = await connection.execute<AudioAssetRow[]>(
      `SELECT id, performer_name, performer_user_id, file_name, public_url,
         UNIX_TIMESTAMP(created_at) AS created_at_epoch, UNIX_TIMESTAMP() AS selection_epoch
       FROM market_gacha_audio_assets
       WHERE category = ? AND is_active = 1
         AND performer_user_id IN (${performerIds.map(() => "?").join(",")})
       ORDER BY id`,
      [category, ...performerIds],
    );
    const asset = selectWeightedAudioAsset(rows, Number(rows[0]?.selection_epoch), Math.random());
    if (!asset) {
      throw new Error("当選ファイルがまだ登録されていません。運営へお問い合わせください。");
    }

    return {
      id: Number(asset.id),
      performerName: asset.performer_name,
      performerUserId: asset.performer_user_id ?? undefined,
      fileName: asset.file_name,
      publicUrl: asset.public_url,
    };
  }

  /**
   * 市場ガチャを一回実行する。日次上限、残高引落し、抽選記録を単一トランザクションで確定する。
   */
  static async draw(
    interaction: ButtonInteraction,
    paymentSource: MarketGachaPaymentSource = "currency",
  ): Promise<void> {
    if (!interaction.guild) throw new Error("サーバー内でのみ利用できます。");
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    const prize = resolveMarketGachaPrize(selectMarketGachaPrize(Math.random()), member);
    const performerIds = prize.audioCategory
      ? (await GuildMemberCacheService.getMembers(interaction.guild)).filter(isSageOrHigherPerformer).map(member => member.id)
      : [];
    const connection = await DbService.getConnection();

    let remainingDraws = 0;
    let afterWallet = 0;
    let afterGachaCoins: number | undefined;
    let audioAsset: MarketGachaAudioAsset | undefined;
    try {
      await connection.beginTransaction();
      await GachaCoinActivationService.lockDrawGate(connection);
      // 付与・交換・過去分集計とロック順を統一する。招待ポイント払いでも口座を先にロックする。
      const [accounts] = await connection.execute<RowDataPacket[]>("SELECT user_id FROM accounts WHERE user_id = ? FOR UPDATE", [interaction.user.id]);
      if (!accounts[0]) throw new Error("口座が見つかりません。");

      // 日付境界をまたいでも回数判定・抽選日時・追加枠を同じ日本時間の日に揃える。
      const [clockRows] = await connection.execute<RowDataPacket[]>("SELECT UNIX_TIMESTAMP() AS draw_epoch");
      const drawEpoch = Number(clockRows[0].draw_epoch);
      const [drawRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, bonus_draws_awarded
         FROM market_gacha_draws
         WHERE user_id = ?
           AND created_at >= CONVERT_TZ(DATE(CONVERT_TZ(FROM_UNIXTIME(?), '+00:00', '+09:00')), '+09:00', '+00:00')
           AND created_at < CONVERT_TZ(DATE_ADD(DATE(CONVERT_TZ(FROM_UNIXTIME(?), '+00:00', '+09:00')), INTERVAL 1 DAY), '+09:00', '+00:00')
         FOR UPDATE`,
        [interaction.user.id, drawEpoch, drawEpoch],
      );
      const dailyLimit = MARKET_GACHA_DAILY_LIMIT + drawRows.reduce((sum, row) => sum + Number(row.bonus_draws_awarded ?? 0), 0);
      if (drawRows.length >= dailyLimit) {
        throw new Error(`市場ガチャは本日${dailyLimit}回までです。`);
      }
      remainingDraws = dailyLimit - drawRows.length - 1 + (prize.key === "one_more_chance" ? 1 : 0);

      // 当選ファイルが未登録なら、料金を引き落とす前に中止する。
      audioAsset = await this.selectAudioAsset(connection, prize.audioCategory, performerIds);

      let botAfterWallet = 0;
      if (paymentSource === "currency") {
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
        botAfterWallet = Number(bot.wallet) + MARKET_GACHA_PRICE;
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
          afterWallet,
          interaction.user.id,
        ]);
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [
          botAfterWallet,
          BOT_ID,
        ]);
      } else {
        await InvitePointService.consumeForGacha(
          connection,
          interaction.user.id,
        );
      }
      const [drawResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO market_gacha_draws
         (user_id, prize_key, prize_name, payment_source, bonus_draws_awarded, created_at)
         VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
        [interaction.user.id, prize.key, prize.label, paymentSource, prize.key === "one_more_chance" ? 1 : 0, drawEpoch],
      );
      if (audioAsset) {
        await connection.execute(
          `INSERT INTO market_gacha_audio_deliveries (draw_id, audio_asset_id)
           VALUES (?, ?)`,
          [drawResult.insertId, audioAsset.id],
        );
      }
      if (prize.itemKey && prize.quantity) {
        await ItemService.grant(connection, interaction.user.id, prize.itemKey, prize.quantity);
      }
      if (prize.key === "one_more_chance") {
        await InvitePointService.grantForGachaReward(
          connection,
          interaction.user.id,
        );
      }
      if (paymentSource === "currency") {
        await connection.execute(
          `INSERT INTO actions
           (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ACTION_TYPES.MARKET_GACHA_DRAW,
            MARKET_GACHA_PRICE,
            interaction.user.id,
            BOT_ID,
            afterWallet,
            botAfterWallet,
            prize.label,
          ],
        );
      }

      afterGachaCoins = await GachaCoinActivationService.grantForDraw(connection, interaction.user.id, drawResult.insertId, prize.coins ?? 1);
      if (afterGachaCoins === undefined) throw new Error("ガチャコインの開始設定を確認してください。");
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await this.sendDrawLog(interaction, prize, paymentSource);
    const audioDmDelivered = audioAsset
      ? await this.sendAudioPrizeDm(interaction, prize, audioAsset)
      : false;
    await interaction.editReply({
      content: formatMarketGachaResult(prize, afterGachaCoins!, remainingDraws, audioAsset, audioDmDelivered),
      components: [],
      embeds: [],
    });
  }
}
