import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import type { RowDataPacket } from "mysql2";
import { ACTION_TYPES } from "../../constant/currency/action";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import {
  CREATOR_EMBLEM_CANCEL_ID,
  CREATOR_EMBLEM_CONFIRM_PREFIX,
  CREATOR_EMBLEM_ENABLED,
  CREATOR_EMBLEM_NOBLE_PRICING_ROLES,
  CREATOR_EMBLEM_PRICING_ROLES,
  CREATOR_EMBLEM_PRODUCT_SELECT_ID,
  CREATOR_EMBLEM_RECIPIENT_ID,
  PRODUCTS,
} from "../../constant/market/creatorEmblem";
import { CREATOR_EMBLEM_PANEL_MESSAGES } from "../../constant/panel/panel";
import { COLOR } from "../../constant/shared/color";
import { THREAD_IDS } from "../../constant/shared/id";
import type { Account } from "../../type/account/account";
import type {
  EmblemPaymentActionRow,
  EmblemPaymentDetails,
  EmblemPricingTier,
  EmblemProduct,
} from "../../type/market/creatorEmblemPayment";
import { SendService } from "../currency/sendService";
import { DbService } from "../system/dbService";

function getPricingRole(roleIds: string[], tier: EmblemPricingTier) {
  return (tier === "noble" && CREATOR_EMBLEM_NOBLE_PRICING_ROLES.find((role) => roleIds.includes(role.id))) ||
    CREATOR_EMBLEM_PRICING_ROLES[tier];
}

export function createCreatorEmblemPaymentLogEmbed(payment: EmblemPaymentDetails) {
  const role = getPricingRole(payment.roleIds, payment.pricingTier);
  return new EmbedBuilder()
    .setTitle("スタンプ支払い完了")
    .setColor(COLOR.GREEN)
    .addFields(
      { name: "購入者", value: `<@${payment.payerId}>\nID: ${payment.payerId}` },
      { name: "商品", value: PRODUCTS[payment.product].label, inline: true },
      { name: "送金額", value: `${payment.amount.toLocaleString()} ${CURRENCY_NAMES}`, inline: true },
      { name: "適用ロール", value: `<@&${role.id}>（${role.label}）`, inline: true },
      { name: "支払先", value: `<@${CREATOR_EMBLEM_RECIPIENT_ID}>（うゆSub）` },
    )
    .setFooter({ text: `確認ID: ${payment.confirmationId}` })
    .setTimestamp();
}

export class CreatorEmblemPaymentService {
  static isConfirmCustomId(customId: string): boolean {
    return customId.startsWith(`${CREATOR_EMBLEM_CONFIRM_PREFIX}:`);
  }

  private static assertEnabled(): void {
    if (!CREATOR_EMBLEM_ENABLED) throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.DISABLED);
  }

  private static isProduct(value: string): value is EmblemProduct {
    return value === "personal" || value === "large";
  }

  static getPricingTier(member: GuildMember): EmblemPricingTier {
    if (CREATOR_EMBLEM_NOBLE_PRICING_ROLES.some((role) => member.roles.cache.has(role.id))) return "noble";
    if (member.roles.cache.has(CREATOR_EMBLEM_PRICING_ROLES.knight.id)) return "knight";
    throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.MEMBER_ONLY);
  }

  static getPriceForMember(member: GuildMember, product: EmblemProduct): number {
    const price = PRODUCTS[product].prices[this.getPricingTier(member)];
    if (price === undefined) throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.NOBLE_ONLY);
    return price;
  }

  static async showProductSelect(interaction: ButtonInteraction): Promise<void> {
    this.assertEnabled();
    const payer = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    const tier = this.getPricingTier(payer);
    const products = (Object.keys(PRODUCTS) as EmblemProduct[])
      .filter((product) => PRODUCTS[product].prices[tier] !== undefined);
    const select = new StringSelectMenuBuilder()
      .setCustomId(CREATOR_EMBLEM_PRODUCT_SELECT_ID)
      .setPlaceholder("購入する商品を選択してください")
      .addOptions(products.map((product) => ({
        label: PRODUCTS[product].label,
        value: product,
        description: `${CREATOR_EMBLEM_PRICING_ROLES[tier].label}：${PRODUCTS[product].prices[tier]!.toLocaleString()} ${CURRENCY_NAMES}`,
      })));
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle("商品の選択")
        .setDescription("支払先はうゆSubです。商品を選択すると支払い確認に進みます。")
        .setColor(COLOR.GREEN)],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showConfirmation(interaction: StringSelectMenuInteraction): Promise<void> {
    this.assertEnabled();
    const product = interaction.values[0];
    if (!this.isProduct(product)) throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.INVALID_PAYMENT);
    const payer = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    const price = this.getPriceForMember(payer, product);
    const tier = this.getPricingTier(payer);
    const embed = new EmbedBuilder().setTitle("支払い内容の確認")
      .setDescription(
        `商品：**${PRODUCTS[product].label}**\n` +
        `適用ロール：**${getPricingRole([...payer.roles.cache.keys()], tier).label}**\n` +
        `支払先：<@${CREATOR_EMBLEM_RECIPIENT_ID}>（うゆSub）\n` +
        `支払い金額：**${price.toLocaleString()} ${CURRENCY_NAMES}**\n\nこの内容で送金しますか？`,
      ).setColor(COLOR.YELLOW);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CREATOR_EMBLEM_CONFIRM_PREFIX}:${product}:${price}:${payer.id}`)
        .setLabel("確定して支払う").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(CREATOR_EMBLEM_CANCEL_ID)
        .setLabel("キャンセル").setStyle(ButtonStyle.Danger),
    );
    await interaction.update({ embeds: [embed], components: [row] });
  }

  /** 同じ確認メッセージの再送・二重押しを、口座ロックと取引履歴で判定する。 */
  private static async transfer(payment: EmblemPaymentDetails): Promise<boolean> {
    const connection = await DbService.getConnection();
    const paymentKey = `スタンプ支払い [確認ID:${payment.confirmationId}]`;
    const comment = `${paymentKey} ${PRODUCTS[payment.product].label} / 適用ロール:${getPricingRole(payment.roleIds, payment.pricingTier).label}`;
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<Account[] & RowDataPacket[]>(
        "SELECT * FROM accounts WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE",
        [payment.payerId, CREATOR_EMBLEM_RECIPIENT_ID],
      );
      const [previous] = await connection.execute<EmblemPaymentActionRow[]>(
        "SELECT id FROM actions WHERE command_name = ? AND from_user_id = ? AND comment LIKE ? LIMIT 1 FOR UPDATE",
        [ACTION_TYPES.CREATOR_EMBLEM_PAYMENT, payment.payerId, `${paymentKey}%`],
      );
      if (previous.length) {
        await connection.rollback();
        return false;
      }
      const payer = accounts.find((account) => String(account.user_id) === payment.payerId);
      const recipient = accounts.find((account) => String(account.user_id) === CREATOR_EMBLEM_RECIPIENT_ID);
      await SendService.validateSend(payer!, recipient!, payment.amount);
      await connection.execute("UPDATE accounts SET wallet = wallet - ? WHERE user_id = ?", [payment.amount, payment.payerId]);
      await connection.execute("UPDATE accounts SET wallet = wallet + ? WHERE user_id = ?", [payment.amount, CREATOR_EMBLEM_RECIPIENT_ID]);
      await connection.execute(
        `INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ACTION_TYPES.CREATOR_EMBLEM_PAYMENT, payment.amount, payment.payerId, CREATOR_EMBLEM_RECIPIENT_ID,
          Number(payer!.wallet) - payment.amount, Number(recipient!.wallet) + payment.amount, comment],
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async pay(interaction: ButtonInteraction): Promise<void> {
    this.assertEnabled();
    const [prefix, product, confirmedPrice, payerId, ...rest] = interaction.customId.split(":");
    if (prefix !== CREATOR_EMBLEM_CONFIRM_PREFIX || !this.isProduct(product) ||
        payerId !== interaction.user.id || rest.length || !interaction.message.id) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.INVALID_PAYMENT);
    }
    const payer = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    const amount = this.getPriceForMember(payer, product);
    if (confirmedPrice !== String(amount)) throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.PRICE_CHANGED);
    const thread = await interaction.client.channels.fetch(THREAD_IDS.CREATOR_EMBLEM_LOG_THREAD);
    const bot = await interaction.guild!.members.fetchMe();
    if (!thread?.isThread() || !thread.isTextBased() || thread.locked ||
        !thread.permissionsFor(bot)?.has([
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessagesInThreads,
          PermissionsBitField.Flags.EmbedLinks,
        ])) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.LOG_UNAVAILABLE);
    }
    await SendService.validateMonthlySendLimit(payer.id, CREATOR_EMBLEM_RECIPIENT_ID, amount, interaction.guild);
    const payment: EmblemPaymentDetails = {
      payerId: payer.id, product, amount, pricingTier: this.getPricingTier(payer),
      roleIds: payer.roles.cache.filter((role) => role.id !== interaction.guildId).map((role) => role.id),
      confirmationId: interaction.message.id,
    };
    const paid = await this.transfer(payment);
    if (!paid) {
      await interaction.editReply({ content: CREATOR_EMBLEM_PANEL_MESSAGES.ALREADY_PAID, embeds: [], components: [] });
      return;
    }
    let logFailed = false;
    try {
      await thread.send({ embeds: [createCreatorEmblemPaymentLogEmbed(payment)], allowedMentions: { parse: [] } });
    } catch (error) {
      logFailed = true;
      console.error(`[CreatorEmblemPayment] Payment committed but log failed. confirmation=${payment.confirmationId}`, error);
    }
    await interaction.editReply({
      content: `✅ **${PRODUCTS[product].label}** の支払いとして、<@${CREATOR_EMBLEM_RECIPIENT_ID}> に **${amount.toLocaleString()} ${CURRENCY_NAMES}** を送金しました。` +
        (logFailed ? `\n${CREATOR_EMBLEM_PANEL_MESSAGES.LOG_FAILED_AFTER_PAYMENT}` : ""),
      embeds: [], components: [],
    });
  }
}
