import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
  EmbedBuilder, MessageFlags, ModalSubmitInteraction,
} from "discord.js";
import { PAYMENT_CONFIRMATION_PREFIX, PAYMENT_CONFIRMATION_TTL_MS } from "../../constant/currency/paymentConfirmation";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { COLOR } from "../../constant/shared/color";
import { CASINO_MESSAGES } from "../../constant/casino/casino";
import { getShopTicket, SHOP_TICKET_NONE, SHOP_TICKET_MAX_APPLICABLE_AMOUNT } from "../../constant/market/shopTicket";
import { STAGE_OPTIONS } from "../../constant/market/superchat";
import type { PendingPayment, PaymentConfirmationSession } from "../../type/currency/paymentConfirmation";
import { ShopPaymentService } from "../market/shopPaymentService";
import { SuperchatService } from "../market/superchatService";
import { SendService } from "./sendService";

export class PaymentConfirmationService {
  private static sessions = new Map<string, PaymentConfirmationSession>();

  static async show(interaction: ModalSubmitInteraction, payment: PendingPayment): Promise<void> {
    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
      throw new Error("金額は1以上の整数で入力してください。");
    }
    const embed = new EmbedBuilder().setColor(COLOR.YELLOW)
      .setDescription(`金額：**${payment.amount.toLocaleString("ja-JP")}${CURRENCY_NAMES}**`)
      .setFooter({ text: "10分以内に確定してください。キャンセルした場合、支払いは発生しません。" });
    if (payment.kind === "shop") {
      if (!payment.comment.trim()) throw new Error("商品名を入力してください。");
      if (payment.commandName !== PANEL_COMMAND_NAMES.SHOP_SEND) {
        payment = { ...payment, ticketType: SHOP_TICKET_NONE };
      }
      if (payment.ticketType !== SHOP_TICKET_NONE && payment.amount >= SHOP_TICKET_MAX_APPLICABLE_AMOUNT) {
        throw new Error("市場割引券は100万LIA以上の商品には使用できません。");
      }
      const shop = payment.commandName === PANEL_COMMAND_NAMES.COURT_SHOP_SEND ? "宮廷市場"
        : payment.commandName === PANEL_COMMAND_NAMES.DARK_SHOP_SEND ? "闇市場" : "市場";
      embed.setTitle(`${shop}で購入しますか？`).addFields(
        { name: "商品名", value: payment.comment.trim() },
        { name: "使用チケット", value: payment.ticketType === SHOP_TICKET_NONE ? "消費しない" : `${getShopTicket(payment.ticketType).label}（1枚）` },
      );
    } else if (payment.kind === "superchat") {
      const stageValue = payment.stage;
      const stage = STAGE_OPTIONS.find((option) => option.value === stageValue);
      if (!payment.streamerId || !stage) throw new Error("無効なスパチャ送信先です。");
      embed.setTitle("スパチャを送りますか？").addFields(
        { name: "配信者", value: `<@${payment.streamerId}>` },
        { name: "ステージ", value: stage.label },
        { name: "コメント", value: payment.comment || "コメントなし" },
      );
    } else {
      const label = {
        [PANEL_COMMAND_NAMES.SEND]: "送金",
        [PANEL_COMMAND_NAMES.CASINO_GF]: CASINO_MESSAGES.SEND_FOR_GF,
        [PANEL_COMMAND_NAMES.CASINO_MAJONG]: CASINO_MESSAGES.SEND_FOR_MAJONG,
        [PANEL_COMMAND_NAMES.CASINO_OTHER]: CASINO_MESSAGES.SEND_FOR_OTHER,
      }[payment.commandName];
      if (!label || !payment.toUserId) throw new Error("無効な送金内容です。");
      if (payment.toUserId === interaction.user.id) throw new Error("自分自身には送金できません。");
      embed.setTitle(`${label}しますか？`).addFields(
        { name: "送金先", value: `<@${payment.toUserId}>` },
        { name: "備考", value: payment.comment || "なし" },
      );
    }

    const id = randomUUID();
    this.sessions.set(id, {
      userId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId,
      expiresAt: Date.now() + PAYMENT_CONFIRMATION_TTL_MS, payment: { ...payment },
    });
    setTimeout(() => this.sessions.delete(id), PAYMENT_CONFIRMATION_TTL_MS).unref();
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.editReply({
        content: "", embeds: [embed], allowedMentions: { parse: [] },
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${PAYMENT_CONFIRMATION_PREFIX}:confirm:${id}`)
            .setLabel(payment.kind === "shop" ? "購入を確定" : "送金を確定").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`${PAYMENT_CONFIRMATION_PREFIX}:cancel:${id}`)
            .setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
        )],
      });
    } catch (error) {
      this.sessions.delete(id);
      throw error;
    }
  }

  static async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [prefix, action, id, extra] = interaction.customId.split(":");
    const session = this.sessions.get(id);
    if (prefix !== PAYMENT_CONFIRMATION_PREFIX || extra || !["confirm", "cancel"].includes(action) || !session || session.expiresAt <= Date.now()) {
      throw new Error("この確認画面は期限切れ、または処理済みです。パネルからやり直してください。");
    }
    if (session.userId !== interaction.user.id || session.guildId !== interaction.guildId || session.channelId !== interaction.channelId) {
      throw new Error("この確認画面は操作できません。");
    }
    // awaitより先に取り除き、連打・キャンセル後の再実行を防ぐ。
    // 処理結果が不明な失敗でも、同じ画面から決済を再実行しない。
    this.sessions.delete(id);
    await interaction.editReply({
      content: action === "cancel" ? "キャンセルしました。支払いは発生していません。" : "処理しています…",
      embeds: [], components: [],
    });
    if (action === "cancel") return;

    const payment = session.payment;
    if (payment.kind === "shop") {
      await ShopPaymentService.pay(interaction, payment.amount, payment.comment, payment.ticketType, payment.commandName);
    } else if (payment.kind === "superchat") {
      await SuperchatService.send(interaction, payment.amount, payment.comment, payment.streamerId, payment.stage);
    } else {
      await SendService.executeSend(interaction, session.userId, payment.toUserId, payment.amount, payment.comment, payment.commandName, "editReply");
    }
  }
}
