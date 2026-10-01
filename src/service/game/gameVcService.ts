import dayjs, { Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
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
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ThreadChannel,
} from "discord.js";
import type { ResultSetHeader } from "mysql2";
import { ACTION_TYPES, toActionType } from "../../constant/currency/action";
import { COLOR } from "../../constant/shared/color";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import {
  GAME_MESSAGES,
  GAME_VC,
  GAME_VC_CONNECT_PERMISSIONS,
  GAME_VC_MESSAGE_PERMISSIONS,
  TRAVELER_OR_ABOVE_ROLE_IDS,
  VC_CONNECT_ROLE_IDS,
} from "../../constant/game/game";
import { GAME_FREE_TICKET_TYPE } from "../../constant/game/gameTicket";
import {
  BOT_ID,
  CATEGORY_IDS,
  ROLE_IDS,
  TEXT_CHANNEL_IDS,
  THREAD_IDS,
} from "../../constant/shared/id";
import type {
  GamePassPlan,
  GameVcPlan,
  GameVcPayment,
  GameVcRequestedPayment,
  GameVcTier,
  PassRow,
  WalletRow,
} from "../../type/game/gameVc";
import { formatNumber } from "../../util/shared/number";
import { hasSystemAdminRole } from "../../util/shared/operatorPermission";
import { addRole } from "../../util/member/role";
import { ItemService } from "../inventory/itemService";
import { DbService } from "../system/dbService";
import { GameFreeTicketService } from "./gameFreeTicketService";
import { VcPanelService } from "../../panel/vc/vcPanelService";

dayjs.extend(utc);

dayjs.extend(timezone);

const GAME_VC_CREATE_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

type GameVcCreateConfirmation = {
  userId: string;
  channelId: string;
  plan: GameVcPlan;
  tierKind: GameVcTier["kind"];
  expectedValues: Partial<Record<GameVcRequestedPayment, string>>;
};

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
    return { label: "歓楽師", kind: "staff" };
  }
  if (TRAVELER_OR_ABOVE_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
    return { label: "旅人以上", kind: "regular" };
  }
  if (member.roles.cache.has(ROLE_IDS.HOTEL_LEADER)) {
    return { label: "支配人", kind: "regular" };
  }
  if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN)) {
    return { label: "空位者", kind: "vacant" };
  }
  if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
    return { label: "罪人", kind: "criminal" };
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

export function getGameVcCreateActionType(tier: GameVcTier): string {
  return tier.kind === "criminal"
    ? ACTION_TYPES.GAME_CRIMINAL_VC_CREATE
    : ACTION_TYPES.GAME_VC_CREATE;
}

export function parseGameVcPlan(value: string): GameVcPlan {
  if (value === GAME_VC.PLANS.LIMITED || value === GAME_VC.PLANS.UNLIMITED) {
    return value;
  }
  throw new Error(GAME_MESSAGES.INVALID_GAME_TYPE);
}

export function getGameVcPrice(tier: GameVcTier, plan: GameVcPlan): number {
  if (tier.kind === "staff") return 0;
  const prices = tier.kind === "criminal"
    ? GAME_VC.PRICES.CRIMINAL
    : tier.kind === "vacant"
      ? GAME_VC.PRICES.VACANT
      : GAME_VC.PRICES.REGULAR;
  return prices[plan];
}

export function getGameVcTicketCost(tier: GameVcTier, plan: GameVcPlan): number {
  const costs = tier.kind === "criminal"
    ? GAME_VC.TICKET_COSTS.CRIMINAL
    : tier.kind === "vacant"
      ? GAME_VC.TICKET_COSTS.VACANT
      : GAME_VC.TICKET_COSTS.REGULAR;
  return costs[plan];
}

export function getGameVcPlanLabel(plan: GameVcPlan): string {
  return plan === GAME_VC.PLANS.LIMITED ? "6人コース" : "人数フリーコース";
}

export function buildGameVcCreateConfirmationDescription(
  tier: GameVcTier,
  plan: GameVcPlan,
  isBenefit: boolean,
): string {
  const price = getGameVcPrice(tier, plan);
  const ticketCost = getGameVcTicketCost(tier, plan);
  return (
    `コース：**${getGameVcPlanLabel(plan)}**\n` +
    `人数：${plan === GAME_VC.PLANS.LIMITED ? `人間${GAME_VC.LIMITED_HUMAN_LIMIT}人まで（部屋主を含む・Botは人数外）` : "無制限"}\n` +
    "利用時間：**無制限**\n" +
    (isBenefit
      ? "料金：**無料**\n"
      : `料金：**${formatNumber(price)}${CURRENCY_NAMES}** または **遊戯チケット${ticketCost}枚**\n`) +
    `部屋主が一度入室した後、退出して${GAME_VC.OWNER_ABSENCE_DELETE_MINUTES}分間戻らなければ、ほかの利用者がいてもVCは削除されます。`
  );
}

function getPassPlanDetail(plan: GamePassPlan) {
  return plan === "twoWeeks"
    ? {
        label: "ゲームパス（2週間）",
        price: GAME_VC.PASS_PRICES.TWO_WEEKS,
        commandName: PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS,
        confirmCommandName: PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS_CONFIRM,
      }
    : {
        label: "ゲームパス（1か月）",
        price: GAME_VC.PASS_PRICES.ONE_MONTH,
        commandName: PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH,
        confirmCommandName: PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH_CONFIRM,
      };
}

export class GameVcService {
  private static readonly createConfirmations = new Map<string, GameVcCreateConfirmation>();

  static async showPlanSelection(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCreatePanelAccess(interaction, member);
    const tier = getGameVcTier(member);
    if (tier.kind === "staff" || member.roles.cache.has(ROLE_IDS.GAME_PASS)) {
      await this.showCreateConfirmation(interaction, GAME_VC.PLANS.UNLIMITED);
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.GAME_VC_PLAN_SELECT)
      .setPlaceholder("コースを選択してください")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        [GAME_VC.PLANS.LIMITED, GAME_VC.PLANS.UNLIMITED].map((plan) => ({
          label: getGameVcPlanLabel(plan),
          value: plan,
          description:
            `${formatNumber(getGameVcPrice(tier, plan))}${CURRENCY_NAMES} / ` +
            `遊戯チケット${getGameVcTicketCost(tier, plan)}枚`,
        })),
      );

    await interaction.editReply({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setTitle("遊戯VCのコースを選択")
          .setDescription(
            `**6人コース**：人間${GAME_VC.LIMITED_HUMAN_LIMIT}人まで（部屋主を含む・Botは人数外）\n` +
            "**人数フリーコース**：人数無制限\n\nどちらも利用時間は無制限です。",
          )
          .setColor(COLOR.YELLOW),
      ],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showCreateConfirmation(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    requestedPlan: string,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCreatePanelAccess(interaction, member);
    const tier = getGameVcTier(member);
    const plan = parseGameVcPlan(requestedPlan);
    const isBenefit = tier.kind === "staff" || member.roles.cache.has(ROLE_IDS.GAME_PASS);
    if (isBenefit && plan !== GAME_VC.PLANS.UNLIMITED) {
      throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
    }
    const ticketCost = getGameVcTicketCost(tier, plan);
    const hasTicket =
      !isBenefit &&
      (await GameFreeTicketService.hasTicket(
        interaction.user.id,
        PANEL_COMMAND_NAMES.GAME_VC_CREATE,
        ticketCost,
      ));

    const buttons: ButtonBuilder[] = [];
    const expectedValues: GameVcCreateConfirmation["expectedValues"] = {};
    const confirmationId = interaction.id;
    if (isBenefit) {
      expectedValues.benefit = "0";
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${PANEL_COMMAND_NAMES.GAME_VC_CREATE_BENEFIT}:${confirmationId}:${plan}:${tier.kind}:0`)
          .setLabel("無料で作成")
          .setStyle(ButtonStyle.Success),
      );
    } else {
      if (hasTicket) {
        expectedValues.ticket = String(ticketCost);
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`${PANEL_COMMAND_NAMES.GAME_VC_CREATE_TICKET}:${confirmationId}:${plan}:${tier.kind}:${ticketCost}`)
            .setLabel(`チケット${ticketCost}枚で作成`)
            .setStyle(ButtonStyle.Success),
        );
      }
      const price = getGameVcPrice(tier, plan);
      expectedValues.money = String(price);
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${PANEL_COMMAND_NAMES.GAME_VC_CREATE_MONEY}:${confirmationId}:${plan}:${tier.kind}:${price}`)
          .setLabel(`${formatNumber(price)}${CURRENCY_NAMES}で作成`)
          .setStyle(ButtonStyle.Primary),
      );
    }
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${PANEL_COMMAND_NAMES.GAME_VC_CREATE_CANCEL}:${confirmationId}`)
        .setLabel("キャンセル")
        .setStyle(ButtonStyle.Secondary),
    );

    this.createConfirmations.set(confirmationId, {
      userId: interaction.user.id,
      channelId: interaction.channelId,
      plan,
      tierKind: tier.kind,
      expectedValues,
    });
    setTimeout(() => this.createConfirmations.delete(confirmationId), GAME_VC_CREATE_CONFIRMATION_TTL_MS).unref();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("遊戯VCを作成しますか？")
          .setDescription(buildGameVcCreateConfirmationDescription(tier, plan, isBenefit))
          .setColor(COLOR.YELLOW),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
    });
  }

  static async createVc(
    interaction: ButtonInteraction,
    confirmationId: string,
    requestedPayment: GameVcRequestedPayment,
    requestedPlan: string,
    expectedTierKind: string,
    expectedValue: string,
  ): Promise<void> {
    this.consumeCreateConfirmation(
      confirmationId,
      interaction,
      requestedPayment,
      requestedPlan,
      expectedTierKind,
      expectedValue,
    );
    const guild = interaction.guild;
    if (!guild) throw new Error("この操作はサーバー内でのみ実行できます。");

    const member = interaction.member as GuildMember;
    this.assertCreatePanelAccess(interaction, member);
    const tier = getGameVcTier(member);
    const plan = parseGameVcPlan(requestedPlan);
    const payment = await this.resolvePayment(
      member,
      interaction.user.id,
      tier,
      requestedPayment,
      plan,
      expectedTierKind,
      expectedValue,
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
      userLimit: plan === GAME_VC.PLANS.LIMITED ? GAME_VC.LIMITED_HUMAN_LIMIT : 0,
      permissionOverwrites: createGameVcPermissionOverwrites(
        guild.id,
        interaction.user.id,
      ),
    });
    try {
      await this.recordVcCreation(
        interaction.user.id,
        voiceChannel.id,
        tier,
        payment,
        plan,
      );
    } catch (error) {
      await voiceChannel.delete().catch((deleteError) =>
        console.error("遊戯VC作成失敗後のVC削除に失敗しました:", deleteError),
      );
      throw error;
    }

    try {
      await voiceChannel.send(await VcPanelService.createGameVcPanel(getGameVcPlanLabel(plan)));
    } catch (error) {
      console.error("遊戯VCへの操作パネル送信に失敗しました:", error);
    }
    await this.sendVcLog(interaction, tier, payment, plan, voiceChannel.id);
    await interaction.editReply({
      content:
        `✅ 遊戯VCを作成しました。\n<#${voiceChannel.id}>\n` +
        `コース：${getGameVcPlanLabel(plan)}\n${this.paymentLabel(payment, tier, plan)}\n` +
        `利用時間：無制限\n部屋主の初回入室後、退出から${GAME_VC.OWNER_ABSENCE_DELETE_MINUTES}分不在で削除されます。`,
    });
  }

  static async cancelCreate(interaction: ButtonInteraction, confirmationId: string): Promise<void> {
    const confirmation = this.createConfirmations.get(confirmationId);
    if (
      !confirmation || confirmation.userId !== interaction.user.id ||
      confirmation.channelId !== interaction.channelId
    ) {
      throw new Error("この確認画面は期限切れです。遊戯パネルからやり直してください。");
    }
    this.createConfirmations.delete(confirmationId);
    await interaction.editReply({
      content: "遊戯VCの作成をキャンセルしました。",
      embeds: [],
      components: [],
    });
  }

  private static consumeCreateConfirmation(
    confirmationId: string,
    interaction: ButtonInteraction,
    requestedPayment: GameVcRequestedPayment,
    requestedPlan: string,
    expectedTierKind: string,
    expectedValue: string,
  ): void {
    const confirmation = this.createConfirmations.get(confirmationId);
    this.createConfirmations.delete(confirmationId);
    if (
      !confirmation || confirmation.userId !== interaction.user.id ||
      confirmation.channelId !== interaction.channelId ||
      confirmation.plan !== requestedPlan || confirmation.tierKind !== expectedTierKind ||
      confirmation.expectedValues[requestedPayment] !== expectedValue
    ) {
      throw new Error("この確認画面は期限切れ、処理済み、または内容が不正です。遊戯パネルからやり直してください。");
    }
  }

  static async showPassConfirmation(
    interaction: ButtonInteraction,
    plan: GamePassPlan,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertRegularPanel(interaction, member);
    if (member.roles.cache.has(ROLE_IDS.GAME_PASS)) {
      await interaction.editReply({
        content: GAME_MESSAGES.PASS_ALREADY_ACTIVE,
        embeds: [],
        components: [],
      });
      return;
    }
    if (!canPurchaseGamePass(member)) {
      throw new Error(GAME_MESSAGES.PASS_PURCHASE_REQUIRES_TRAVELER);
    }

    const detail = getPassPlanDetail(plan);
    await interaction.editReply({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setTitle(`${detail.label}を購入しますか？`)
          .setDescription(
            `料金：**${formatNumber(detail.price)}${CURRENCY_NAMES}**\n` +
              "所持中は無料で遊戯VCを作成できます。",
          )
          .setColor(COLOR.YELLOW),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(detail.confirmCommandName)
            .setLabel("購入を確定")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.GAME_PASS_CANCEL)
            .setLabel("キャンセル")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
  }

  static async purchasePass(
    interaction: ButtonInteraction,
    plan: GamePassPlan,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertRegularPanel(interaction, member);
    if (member.roles.cache.has(ROLE_IDS.GAME_PASS)) {
      await interaction.editReply({
        content: GAME_MESSAGES.PASS_ALREADY_ACTIVE,
        embeds: [],
        components: [],
      });
      return;
    }
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
    await this.sendPassLog(interaction, detail.label, detail.price, expiryText);
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
    await this.sendCriminalAccessLog(interaction, expiryText);
    await interaction.editReply({
      content:
        `✅ 遊戯VC接続権限を購入しました。\n` +
        `有効期限：${expiryText}`,
    });
  }

  private static assertCreatePanelAccess(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    member: GuildMember,
  ): void {
    if (hasSystemAdminRole(member)) return;
    if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
      this.assertCriminalPanel(interaction, member);
      return;
    }
    this.assertRegularPanel(interaction, member);
  }

  private static assertRegularPanel(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    member: GuildMember,
  ): void {
    if (hasSystemAdminRole(member)) return;
    if (member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI)) {
      throw new Error(GAME_MESSAGES.CRIMINAL_PANEL_ONLY);
    }
    if (interaction.channelId !== TEXT_CHANNEL_IDS.GAME_PANEL) {
      throw new Error("遊戯パネルで操作してください。");
    }
  }

  private static assertCriminalPanel(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    member: GuildMember,
  ): void {
    if (hasSystemAdminRole(member)) return;
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
    requestedPayment: GameVcRequestedPayment,
    plan: GameVcPlan,
    expectedTierKind: string,
    expectedValue: string,
  ): Promise<GameVcPayment> {
    if (tier.kind !== expectedTierKind) {
      throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
    }
    const hasPass = member.roles.cache.has(ROLE_IDS.GAME_PASS);
    const hasBenefit = tier.kind === "staff" || hasPass;
    if (requestedPayment === "benefit") {
      if (!hasBenefit || plan !== GAME_VC.PLANS.UNLIMITED || Number(expectedValue) !== 0) {
        throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
      }
      return tier.kind === "staff" ? "staff" : "pass";
    }
    if (hasBenefit) throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
    if (requestedPayment === "ticket") {
      const ticketCost = getGameVcTicketCost(tier, plan);
      if (Number(expectedValue) !== ticketCost) {
        throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
      }
      const hasTicket = await GameFreeTicketService.hasTicket(
        userId,
        PANEL_COMMAND_NAMES.GAME_VC_CREATE,
        ticketCost,
      );
      if (!hasTicket) throw new Error(`遊戯チケットが不足しています。必要枚数：${ticketCost}枚`);
      return "ticket";
    }
    if (Number(expectedValue) !== getGameVcPrice(tier, plan)) {
      throw new Error(GAME_MESSAGES.CREATE_CONDITIONS_CHANGED);
    }
    return "money";
  }

  private static async recordVcCreation(
    userId: string,
    voiceChannelId: string,
    tier: GameVcTier,
    payment: GameVcPayment,
    plan: GameVcPlan,
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

      const price = payment === "money" ? getGameVcPrice(tier, plan) : 0;
      if (account.wallet < price) throw new Error(GAME_MESSAGES.NOT_ENOUGH_BALANCE);
      if (payment === "ticket") {
        const ticketCost = getGameVcTicketCost(tier, plan);
        const consumed = await ItemService.consume(
          connection,
          userId,
          GameFreeTicketService.getItemKey(GAME_FREE_TICKET_TYPE.VC_CREATE),
          ticketCost,
        );
        if (!consumed) throw new Error(`遊戯チケットが不足しています。必要枚数：${ticketCost}枚`);
      }
      const afterWallet = account.wallet - price;
      if (price > 0) {
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, userId]);
      }
      await connection.execute(
        `INSERT INTO vcs
         (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at, game_plan, owner_has_joined, owner_left_at)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, FALSE, NULL)`,
        [voiceChannelId, userId, GAME_VC.TYPE, payment === "ticket", payment === "pass" || payment === "staff", plan],
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
          getGameVcCreateActionType(tier),
          price,
          userId,
          BOT_ID,
          afterWallet,
          botRows[0]?.wallet ?? 0,
          `遊戯VC（${getGameVcPlanLabel(plan)}・時間無制限）を作成しました。`,
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
      if (previousPass && !previousPass.is_deleted && previousPass.expire_at && dayjs(previousPass.expire_at).isAfter(now)) {
        throw new Error(GAME_MESSAGES.PASS_ALREADY_ACTIVE);
      }
      const expireAt = calculateGamePassExpireAt(plan, now).toDate();
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

  private static paymentLabel(
    payment: GameVcPayment,
    tier: GameVcTier,
    plan: GameVcPlan,
  ): string {
    switch (payment) {
      case "ticket":
        return `料金：遊戯チケットを${getGameVcTicketCost(tier, plan)}枚消費`;
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
    plan: GameVcPlan,
    voiceChannelId: string,
  ): Promise<void> {
    try {
      const threadId =
        tier.kind === "criminal"
          ? THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD
          : THREAD_IDS.GAME_VC_CREATE_LOG_THREAD;
      const thread = await interaction.client.channels.fetch(threadId);
      if (!thread || !thread.isThread() || !thread.isTextBased()) {
        throw new Error("VC作成ログスレッドが見つかりません。");
      }
      await (thread as ThreadChannel).send(
        `**${tier.kind === "criminal" ? "罪人用遊戯VC作成" : "遊戯VC作成"}**\n<@${interaction.user.id}>\n` +
          `対象ロール: ${tier.label}\nコース: ${getGameVcPlanLabel(plan)}\n` +
          `${this.paymentLabel(payment, tier, plan)}\n作成VC: <#${voiceChannelId}>\n` +
          `利用時間: 無制限\n部屋主退出後${GAME_VC.OWNER_ABSENCE_DELETE_MINUTES}分で削除`,
      );
    } catch (error) {
      console.error("遊戯VC作成ログの送信に失敗しました:", error);
    }
  }

  private static async sendCriminalAccessLog(
    interaction: ButtonInteraction,
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
          `有効期限: ${expiryText}`,
      );
    } catch (error) {
      console.error("罪人用遊戯VC接続権限購入ログの送信に失敗しました:", error);
    }
  }

  private static async sendPassLog(
    interaction: ButtonInteraction,
    label: string,
    price: number,
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
          `有効期限: ${expiryText}`,
      );
    } catch (error) {
      console.error("ゲームパス購入ログの送信に失敗しました:", error);
    }
  }
}
