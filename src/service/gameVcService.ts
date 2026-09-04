import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  OverwriteType,
  PermissionsBitField,
  ThreadChannel,
} from "discord.js";
import dayjs, { Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ResultSetHeader, RowDataPacket } from "mysql2";

import { toActionType } from "../constant/action";
import { COLOR } from "../constant/color";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { GAME_MESSAGES, GAME_VC } from "../constant/game";
import { GAME_FREE_TICKET_TYPE } from "../constant/gameTicket";
import {
  BOT_ID,
  CATEGORY_IDS,
  ROLE_IDS,
  TEXT_CHANNEL_IDS,
  THREAD_IDS,
} from "../constant/id";
import { formatNumber } from "../util/number";
import { addRole } from "../util/role";
import { GameFreeTicketService } from "./gameFreeTicketService";
import { ItemService } from "./itemService";
import { DbService } from "./dbService";

dayjs.extend(utc);
dayjs.extend(timezone);

type GameVcPayment = "money" | "ticket" | "pass" | "staff";
type GamePassPlan = "twoWeeks" | "oneMonth";

type GameVcTier = {
  label: string;
  price: number;
};

type WalletRow = RowDataPacket & { wallet: number };
type PassRow = RowDataPacket & { expire_at: Date | null; is_deleted: number };

const TRAVELER_OR_ABOVE_ROLE_IDS = [
  ROLE_IDS.SABANUSI,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
];

const VC_CONNECT_ROLE_IDS = [
  ...TRAVELER_OR_ABOVE_ROLE_IDS,
];

const GAME_VC_MESSAGE_PERMISSIONS = [
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.SendVoiceMessages,
  PermissionsBitField.Flags.UseEmbeddedActivities,
];

const GAME_VC_CONNECT_PERMISSIONS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.Connect,
  PermissionsBitField.Flags.Speak,
  PermissionsBitField.Flags.UseVAD,
  PermissionsBitField.Flags.Stream,
  ...GAME_VC_MESSAGE_PERMISSIONS,
];

/** 遊戯VC用の権限。空位者は旅人以上と同じ接続権限、罪人は接続権限購入時のみ接続できる。 */
export function createGameVcPermissionOverwrites(
  guildId: string,
  creatorUserId: string,
) {
  return [
    {
      id: guildId,
      type: OverwriteType.Role,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    ...VC_CONNECT_ROLE_IDS.map((roleId) => ({
      id: roleId,
      type: OverwriteType.Role,
      allow: GAME_VC_CONNECT_PERMISSIONS,
    })),
    {
      id: ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN,
      type: OverwriteType.Role,
      allow: GAME_VC_CONNECT_PERMISSIONS,
    },
    {
      id: ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI,
      type: OverwriteType.Role,
      allow: [PermissionsBitField.Flags.ViewChannel, ...GAME_VC_MESSAGE_PERMISSIONS],
      deny: [PermissionsBitField.Flags.Connect],
    },
    {
      id: ROLE_IDS.GAME_CRIMINAL_ACCESS,
      type: OverwriteType.Role,
      allow: GAME_VC_CONNECT_PERMISSIONS,
    },
    {
      id: creatorUserId,
      type: OverwriteType.Member,
      allow: GAME_VC_CONNECT_PERMISSIONS,
    },
    {
      id: ROLE_IDS.GAME_STAFF,
      type: OverwriteType.Role,
      allow: GAME_VC_CONNECT_PERMISSIONS,
    },
  ];
}

export function getGameVcTier(member: GuildMember): GameVcTier {
  if (member.roles.cache.has(ROLE_IDS.GAME_STAFF)) {
    return { label: "歓楽師", price: 0 };
  }
  if (TRAVELER_OR_ABOVE_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
    return { label: "旅人以上", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE };
  }
  if (member.roles.cache.has(ROLE_IDS.HOTEL_LEADER)) {
    return { label: "支配人", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE };
  }
  if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN)) {
    return { label: "空位者", price: GAME_VC.PRICES.VACANT };
  }
  if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
    return { label: "罪人", price: GAME_VC.PRICES.CRIMINAL };
  }
  throw new Error(GAME_MESSAGES.NO_ELIGIBLE_ROLE);
}

export function canPurchaseGamePass(member: GuildMember): boolean {
  return (
    TRAVELER_OR_ABOVE_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId)) ||
    member.roles.cache.has(ROLE_IDS.HOTEL_LEADER)
  );
}

export function calculateGamePassExpireAt(
  plan: GamePassPlan,
  now = dayjs(),
): Dayjs {
  const jstNow = now.tz("Asia/Tokyo");
  return plan === "twoWeeks"
    ? jstNow.add(2, "week").tz("UTC")
    : jstNow.add(1, "month").tz("UTC");
}

export function calculateGameCriminalAccessExpireAt(
  now = dayjs(),
): Dayjs {
  return now.add(GAME_VC.CRIMINAL_ACCESS_DURATION_HOURS, "hour");
}

export function buildGameVcCreateConfirmationDescription(
  tier: GameVcTier,
  isFree: boolean,
): string {
  return (
    `利用時間：${GAME_VC.DURATION_HOURS}時間\n` +
    (isFree
      ? "料金：**無料**"
      : `料金：**${formatNumber(tier.price)}${CURRENCY_NAMES}**`)
  );
}

function getPassPlanDetail(plan: GamePassPlan) {
  return plan === "twoWeeks"
    ? {
        label: "ゲームパス（2週間）",
        price: GAME_VC.PASS_PRICES.TWO_WEEKS,
        commandName: PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS,
      }
    : {
        label: "ゲームパス（1か月）",
        price: GAME_VC.PASS_PRICES.ONE_MONTH,
        commandName: PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH,
      };
}

export class GameVcService {
  static async showCreateConfirmation(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCreatePanelAccess(interaction, member);
    const tier = getGameVcTier(member);
    const isFree =
      tier.price === 0 || member.roles.cache.has(ROLE_IDS.GAME_PASS);
    const hasTicket =
      !isFree &&
      (await GameFreeTicketService.hasTicket(
        interaction.user.id,
        PANEL_COMMAND_NAMES.GAME_VC_CREATE,
      ));

    const buttons: ButtonBuilder[] = [];
    if (isFree) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.GAME_VC_CREATE_MONEY)
          .setLabel("無料で作成")
          .setStyle(ButtonStyle.Success),
      );
    } else {
      if (hasTicket) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.GAME_VC_CREATE_TICKET)
            .setLabel("チケットで作成")
            .setStyle(ButtonStyle.Success),
        );
      }
      buttons.push(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.GAME_VC_CREATE_MONEY)
          .setLabel(`${formatNumber(tier.price)}${CURRENCY_NAMES}で作成`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    buttons.push(
      new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("キャンセル")
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("遊戯VCを作成しますか？")
          .setDescription(buildGameVcCreateConfirmationDescription(tier, isFree))
          .setColor(COLOR.YELLOW),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
    });
  }

  static async createVc(
    interaction: ButtonInteraction,
    requestedPayment: "money" | "ticket",
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) throw new Error("この操作はサーバー内でのみ実行できます。");

    const member = interaction.member as GuildMember;
    this.assertCreatePanelAccess(interaction, member);
    const tier = getGameVcTier(member);
    const payment = await this.resolvePayment(
      member,
      interaction.user.id,
      tier,
      requestedPayment,
    );
    await interaction.editReply({
      content: "遊戯VCを作成しています…",
      embeds: [],
      components: [],
    });

    const category = await guild.channels.fetch(CATEGORY_IDS.GAME);
    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error("遊戯VCカテゴリが見つからないか、無効な型です。");
    }

    const voiceChannel = await guild.channels.create({
      name: `遊戯 - ${member.displayName}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: createGameVcPermissionOverwrites(
        guild.id,
        interaction.user.id,
      ),
    });
    const expireAt = new Date(Date.now() + GAME_VC.DURATION_HOURS * 60 * 60 * 1000);

    let afterWallet: number;
    try {
      afterWallet = await this.recordVcCreation(
        interaction.user.id,
        voiceChannel.id,
        payment,
        tier.price,
        expireAt,
      );
    } catch (error) {
      await voiceChannel.delete().catch((deleteError) =>
        console.error("遊戯VC作成失敗後のVC削除に失敗しました:", deleteError),
      );
      throw error;
    }

    const expiryText = expireAt.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    await voiceChannel.send(`有効期限: ${expiryText}\n期限になるとVCは削除されます。`).catch((error) =>
      console.error("遊戯VCへの案内送信に失敗しました:", error),
    );
    await this.sendVcLog(interaction, tier, payment, voiceChannel.id, afterWallet, expiryText);
    await interaction.editReply({
      content:
        `✅ 遊戯VCを作成しました。\n<#${voiceChannel.id}>\n` +
        `${this.paymentLabel(payment)}\n有効期限：${expiryText}`,
    });
  }

  static async purchasePass(
    interaction: ButtonInteraction,
    plan: GamePassPlan,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertRegularPanel(interaction, member);
    if (!canPurchaseGamePass(member)) {
      throw new Error(GAME_MESSAGES.PASS_PURCHASE_REQUIRES_TRAVELER);
    }

    const detail = getPassPlanDetail(plan);
    await interaction.editReply({
      content: `${detail.label}を購入しています…`,
      embeds: [],
      components: [],
    });
    const result = await this.recordPassPurchase(interaction.user.id, plan);

    try {
      await addRole(member, ROLE_IDS.GAME_PASS);
    } catch (error) {
      await this.rollbackPassPurchase(interaction.user.id, result);
      throw error;
    }

    const expiryText = result.expireAt.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    await this.sendPassLog(interaction, detail.label, detail.price, result.afterWallet, expiryText);
    await interaction.editReply({
      content: `✅ ${detail.label}を購入しました。\n有効期限：${expiryText}`,
    });
  }

  static async showCriminalAccessConfirmation(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCriminalPanel(interaction, member);
    if (member.roles.cache.has(ROLE_IDS.GAME_CRIMINAL_ACCESS)) {
      throw new Error(GAME_MESSAGES.CRIMINAL_ACCESS_ALREADY_ACTIVE);
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("遊戯VC接続権限を購入しますか？")
          .setDescription(
            `利用時間：${GAME_VC.CRIMINAL_ACCESS_DURATION_HOURS}時間\n` +
              `料金：**${formatNumber(GAME_VC.CRIMINAL_ACCESS_PRICE)}${CURRENCY_NAMES}**`,
          )
          .setColor(COLOR.YELLOW),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.GAME_CRIMINAL_ACCESS_CONFIRM)
            .setLabel("購入を確定")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("cancel")
            .setLabel("キャンセル")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  static async purchaseCriminalAccess(
    interaction: ButtonInteraction,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCriminalPanel(interaction, member);
    if (member.roles.cache.has(ROLE_IDS.GAME_CRIMINAL_ACCESS)) {
      throw new Error(GAME_MESSAGES.CRIMINAL_ACCESS_ALREADY_ACTIVE);
    }

    await interaction.editReply({
      content: "遊戯VC接続権限を購入しています…",
      embeds: [],
      components: [],
    });
    const result = await this.recordCriminalAccessPurchase(interaction.user.id);

    try {
      await addRole(member, ROLE_IDS.GAME_CRIMINAL_ACCESS);
    } catch (error) {
      await this.rollbackCriminalAccessPurchase(interaction.user.id, result);
      throw error;
    }

    const expiryText = result.expireAt.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    await this.sendCriminalAccessLog(interaction, result.afterWallet, expiryText);
    await interaction.editReply({
      content:
        `✅ 遊戯VC接続権限を購入しました。\n` +
        `有効期限：${expiryText}`,
    });
  }

  private static assertCreatePanelAccess(
    interaction: ButtonInteraction,
    member: GuildMember,
  ): void {
    if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
      this.assertCriminalPanel(interaction, member);
      return;
    }
    this.assertRegularPanel(interaction, member);
  }

  private static assertRegularPanel(
    interaction: ButtonInteraction,
    member: GuildMember,
  ): void {
    if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
      throw new Error(GAME_MESSAGES.CRIMINAL_PANEL_ONLY);
    }
    if (interaction.channelId !== TEXT_CHANNEL_IDS.GAME_PANEL) {
      throw new Error("遊戯パネルで操作してください。");
    }
  }

  private static assertCriminalPanel(
    interaction: ButtonInteraction,
    member: GuildMember,
  ): void {
    if (!member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
      throw new Error(GAME_MESSAGES.CRIMINAL_ROLE_REQUIRED);
    }
    if (interaction.channelId !== TEXT_CHANNEL_IDS.GAME_CRIMINAL_PANEL) {
      throw new Error(GAME_MESSAGES.CRIMINAL_PANEL_ONLY);
    }
  }

  private static async resolvePayment(
    member: GuildMember,
    userId: string,
    tier: GameVcTier,
    requestedPayment: "money" | "ticket",
  ): Promise<GameVcPayment> {
    if (tier.price === 0) return "staff";
    if (member.roles.cache.has(ROLE_IDS.GAME_PASS)) return "pass";
    if (requestedPayment === "ticket") {
      const hasTicket = await GameFreeTicketService.hasTicket(
        userId,
        PANEL_COMMAND_NAMES.GAME_VC_CREATE,
      );
      if (!hasTicket) throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);
      return "ticket";
    }
    return "money";
  }

  private static async recordVcCreation(
    userId: string,
    voiceChannelId: string,
    payment: GameVcPayment,
    tierPrice: number,
    expireAt: Date,
  ): Promise<number> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accountRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const account = accountRows[0];
      if (!account) throw new Error("口座が見つかりません。");

      const price = payment === "money" ? tierPrice : 0;
      if (account.wallet < price) throw new Error(GAME_MESSAGES.NOT_ENOUGH_BALANCE);
      if (payment === "ticket") {
        const consumed = await ItemService.consume(
          connection,
          userId,
          GameFreeTicketService.getItemKey(GAME_FREE_TICKET_TYPE.VC_CREATE),
        );
        if (!consumed) throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);
      }
      const afterWallet = account.wallet - price;
      if (price > 0) {
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, userId]);
      }
      await connection.execute(
        `INSERT INTO vcs (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at)
         VALUES (?, ?, NULL, ?, ?, FALSE, ?)`,
        [voiceChannelId, userId, GAME_VC.TYPE, payment === "ticket", expireAt],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      await connection.execute<ResultSetHeader>(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          toActionType(PANEL_COMMAND_NAMES.GAME_VC_CREATE),
          price,
          userId,
          BOT_ID,
          afterWallet,
          botRows[0]?.wallet ?? 0,
          `遊戯VCを${GAME_VC.DURATION_HOURS}時間作成しました。`,
        ],
      );
      await connection.commit();
      return afterWallet;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static async recordPassPurchase(userId: string, plan: GamePassPlan) {
    const detail = getPassPlanDetail(plan);
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accountRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const account = accountRows[0];
      if (!account) throw new Error("口座が見つかりません。");
      if (account.wallet < detail.price) throw new Error(GAME_MESSAGES.NOT_ENOUGH_BALANCE);

      const [passRows] = await connection.execute<PassRow[]>(
        "SELECT expire_at, is_deleted FROM role_management_logs WHERE user_id = ? AND role_id = ? FOR UPDATE",
        [userId, ROLE_IDS.GAME_PASS],
      );
      const previousPass = passRows[0];
      const now = dayjs();
      const activeExpiry =
        previousPass && !previousPass.is_deleted && previousPass.expire_at && dayjs(previousPass.expire_at).isAfter(now)
          ? dayjs(previousPass.expire_at)
          : now;
      const expireAt = calculateGamePassExpireAt(plan, activeExpiry).toDate();
      const afterWallet = account.wallet - detail.price;

      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, userId]);
      await connection.execute(
        `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at)
         VALUES (?, ?, FALSE, ?)
         ON DUPLICATE KEY UPDATE is_deleted = FALSE, expire_at = VALUES(expire_at), updated_at = CURRENT_TIMESTAMP`,
        [userId, ROLE_IDS.GAME_PASS, expireAt],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const [actionResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          toActionType(detail.commandName),
          detail.price,
          userId,
          BOT_ID,
          afterWallet,
          botRows[0]?.wallet ?? 0,
          `${detail.label}を購入しました。`,
        ],
      );
      await connection.commit();
      return {
        afterWallet,
        expireAt,
        previousPass,
        previousWallet: account.wallet,
        actionId: actionResult.insertId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static async rollbackPassPurchase(
    userId: string,
    result: {
      previousWallet: number;
      previousPass: PassRow | undefined;
      actionId: number;
    },
  ): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [result.previousWallet, userId]);
      await connection.execute("DELETE FROM actions WHERE id = ?", [result.actionId]);
      if (result.previousPass) {
        await connection.execute(
          "UPDATE role_management_logs SET is_deleted = ?, expire_at = ? WHERE user_id = ? AND role_id = ?",
          [result.previousPass.is_deleted, result.previousPass.expire_at, userId, ROLE_IDS.GAME_PASS],
        );
      } else {
        await connection.execute(
          "DELETE FROM role_management_logs WHERE user_id = ? AND role_id = ?",
          [userId, ROLE_IDS.GAME_PASS],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("ゲームパス付与失敗後のロールバックに失敗しました:", error);
    } finally {
      connection.release();
    }
  }

  private static async recordCriminalAccessPurchase(userId: string) {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accountRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const account = accountRows[0];
      if (!account) throw new Error("口座が見つかりません。");
      if (account.wallet < GAME_VC.CRIMINAL_ACCESS_PRICE) {
        throw new Error(GAME_MESSAGES.NOT_ENOUGH_BALANCE);
      }

      const [roleRows] = await connection.execute<PassRow[]>(
        "SELECT expire_at, is_deleted FROM role_management_logs WHERE user_id = ? AND role_id = ? FOR UPDATE",
        [userId, ROLE_IDS.GAME_CRIMINAL_ACCESS],
      );
      const previousRole = roleRows[0];
      if (
        previousRole &&
        !previousRole.is_deleted &&
        previousRole.expire_at &&
        dayjs(previousRole.expire_at).isAfter(dayjs())
      ) {
        throw new Error(GAME_MESSAGES.CRIMINAL_ACCESS_ALREADY_ACTIVE);
      }

      const expireAt = calculateGameCriminalAccessExpireAt().toDate();
      const afterWallet = account.wallet - GAME_VC.CRIMINAL_ACCESS_PRICE;
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?",
        [afterWallet, userId],
      );
      await connection.execute(
        `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at)
         VALUES (?, ?, FALSE, ?)
         ON DUPLICATE KEY UPDATE is_deleted = FALSE, expire_at = VALUES(expire_at), updated_at = CURRENT_TIMESTAMP`,
        [userId, ROLE_IDS.GAME_CRIMINAL_ACCESS, expireAt],
      );
      const [botRows] = await connection.execute<WalletRow[]>(
        "SELECT wallet FROM accounts WHERE user_id = ?",
        [BOT_ID],
      );
      const [actionResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO actions
         (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          toActionType(PANEL_COMMAND_NAMES.GAME_CRIMINAL_ACCESS_PURCHASE),
          GAME_VC.CRIMINAL_ACCESS_PRICE,
          userId,
          BOT_ID,
          afterWallet,
          botRows[0]?.wallet ?? 0,
          `遊戯VC接続権限を${GAME_VC.CRIMINAL_ACCESS_DURATION_HOURS}時間購入しました。`,
        ],
      );
      await connection.commit();
      return {
        afterWallet,
        expireAt,
        previousRole,
        previousWallet: account.wallet,
        actionId: actionResult.insertId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private static async rollbackCriminalAccessPurchase(
    userId: string,
    result: {
      previousWallet: number;
      previousRole: PassRow | undefined;
      actionId: number;
    },
  ): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "UPDATE accounts SET wallet = ? WHERE user_id = ?",
        [result.previousWallet, userId],
      );
      await connection.execute("DELETE FROM actions WHERE id = ?", [result.actionId]);
      if (result.previousRole) {
        await connection.execute(
          "UPDATE role_management_logs SET is_deleted = ?, expire_at = ? WHERE user_id = ? AND role_id = ?",
          [
            result.previousRole.is_deleted,
            result.previousRole.expire_at,
            userId,
            ROLE_IDS.GAME_CRIMINAL_ACCESS,
          ],
        );
      } else {
        await connection.execute(
          "DELETE FROM role_management_logs WHERE user_id = ? AND role_id = ?",
          [userId, ROLE_IDS.GAME_CRIMINAL_ACCESS],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error("罪人用遊戯VC接続権限付与失敗後のロールバックに失敗しました:", error);
    } finally {
      connection.release();
    }
  }

  private static paymentLabel(payment: GameVcPayment): string {
    switch (payment) {
      case "ticket":
        return "料金：遊戯チケットを1枚消費";
      case "pass":
        return "料金：ゲームパスにより無料";
      case "staff":
        return "料金：歓楽師特典により無料";
      default:
        return "料金：LIAで支払い済み";
    }
  }

  private static async sendVcLog(
    interaction: ButtonInteraction,
    tier: GameVcTier,
    payment: GameVcPayment,
    voiceChannelId: string,
    afterWallet: number,
    expiryText: string,
  ): Promise<void> {
    try {
      const threadId =
        tier.label === "罪人"
          ? THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD
          : THREAD_IDS.GAME_VC_CREATE_LOG_THREAD;
      const thread = await interaction.client.channels.fetch(threadId);
      if (!thread || !thread.isThread() || !thread.isTextBased()) {
        throw new Error("VC作成ログスレッドが見つかりません。");
      }
      await (thread as ThreadChannel).send(
        `**${tier.label === "罪人" ? "罪人用遊戯VC作成" : "遊戯VC作成"}**\n<@${interaction.user.id}>\n` +
          `対象ロール: ${tier.label}\n${this.paymentLabel(payment)}\n` +
          `残高: ${formatNumber(afterWallet)}${CURRENCY_NAMES}\n` +
          `作成VC: <#${voiceChannelId}>\n有効期限: ${expiryText}`,
      );
    } catch (error) {
      console.error("遊戯VC作成ログの送信に失敗しました:", error);
    }
  }

  private static async sendCriminalAccessLog(
    interaction: ButtonInteraction,
    afterWallet: number,
    expiryText: string,
  ): Promise<void> {
    try {
      const thread = await interaction.client.channels.fetch(
        THREAD_IDS.GAME_CRIMINAL_ACCESS_LOG_THREAD,
      );
      if (!thread || !thread.isThread() || !thread.isTextBased()) {
        throw new Error("罪人用VC接続権限購入ログスレッドが見つかりません。");
      }
      await (thread as ThreadChannel).send(
        `**罪人用遊戯VC接続権限購入**\n<@${interaction.user.id}>\n` +
          `料金: ${formatNumber(GAME_VC.CRIMINAL_ACCESS_PRICE)}${CURRENCY_NAMES}\n` +
          `残高: ${formatNumber(afterWallet)}${CURRENCY_NAMES}\n有効期限: ${expiryText}`,
      );
    } catch (error) {
      console.error("罪人用遊戯VC接続権限購入ログの送信に失敗しました:", error);
    }
  }

  private static async sendPassLog(
    interaction: ButtonInteraction,
    label: string,
    price: number,
    afterWallet: number,
    expiryText: string,
  ): Promise<void> {
    try {
      const thread = await interaction.client.channels.fetch(THREAD_IDS.GAME_PASS_LOG_THREAD);
      if (!thread || !thread.isThread() || !thread.isTextBased()) {
        throw new Error("ゲームパス購入ログスレッドが見つかりません。");
      }
      await (thread as ThreadChannel).send(
        `**ゲームパス購入**\n<@${interaction.user.id}>\n` +
          `プラン: ${label}\n料金: ${formatNumber(price)}${CURRENCY_NAMES}\n` +
          `残高: ${formatNumber(afterWallet)}${CURRENCY_NAMES}\n有効期限: ${expiryText}`,
      );
    } catch (error) {
      console.error("ゲームパス購入ログの送信に失敗しました:", error);
    }
  }
}
