import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { CURRENCY_NAMES } from "../constant/currency";
import { ROLE_IDS } from "../constant/id";
import { CREATOR_EMBLEM_PANEL_MESSAGES } from "../constant/panel";
import { COLOR } from "../constant/color";
import { SendService } from "./sendService";

export type EmblemProduct = "personal" | "large";

const PRODUCTS: Record<EmblemProduct, { label: string; apostlePrice: number; memberPrice?: number }> = {
  personal: { label: "個人紋章", apostlePrice: 60_000, memberPrice: 100_000 },
  large: { label: "デカ紋章", apostlePrice: 150_000 },
};

export class CreatorEmblemPaymentService {
  static readonly PRODUCT_SELECT_ID = "creatorEmblemProductSelect";
  static readonly CREATOR_SELECT_PREFIX = "creatorEmblemCreatorSelect";
  private static readonly CONFIRM_PREFIX = "creatorEmblemConfirm";

  static isConfirmCustomId(customId: string): boolean {
    return customId.startsWith(`${this.CONFIRM_PREFIX}:`);
  }

  private static hasApostlePricing(member: GuildMember): boolean {
    return member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.HONMEN) ||
      member.roles.cache.has(ROLE_IDS.KANRISYA) ||
      member.roles.cache.has(ROLE_IDS.SABANUSI) ||
      member.roles.cache.has(ROLE_IDS.GIJUTU_LEADER);
  }

  private static hasMemberRole(member: GuildMember): boolean {
    return member.roles.cache.has(ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN);
  }

  private static assertCanUse(member: GuildMember): void {
    if (!this.hasApostlePricing(member) && !this.hasMemberRole(member)) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.MEMBER_ONLY);
    }
  }

  private static isProduct(value: string): value is EmblemProduct {
    return value === "personal" || value === "large";
  }

  private static assertProductEligibility(member: GuildMember, product: EmblemProduct): void {
    this.assertCanUse(member);
    if (product === "large" && !this.hasApostlePricing(member)) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.APOSTLE_ONLY);
    }
  }

  static getPriceForMember(member: GuildMember, product: EmblemProduct): number {
    this.assertProductEligibility(member, product);
    return this.hasApostlePricing(member)
      ? PRODUCTS[product].apostlePrice
      : PRODUCTS[product].memberPrice!;
  }

  private static isCreator(member: GuildMember): boolean {
    return member.roles.cache.has(ROLE_IDS.EMBLEM_CREATOR) ||
      member.roles.cache.has(ROLE_IDS.EMBLEM_CREATOR_LEADER);
  }

  static async showProductSelect(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    this.assertCanUse(member);

    const select = new StringSelectMenuBuilder()
      .setCustomId(this.PRODUCT_SELECT_ID)
      .setPlaceholder("紋章の種類を選択してください")
      .addOptions(
        {
          label: "個人紋章",
          value: "personal",
          description: `賢者 100,000${CURRENCY_NAMES} / 貴族 60,000${CURRENCY_NAMES}`,
        },
        {
          label: "デカ紋章",
          value: "large",
          description: `貴族 150,000${CURRENCY_NAMES}`,
        },
      );
    const embed = new EmbedBuilder()
      .setTitle("紋章の種類を選択")
      .setDescription("購入する紋章の種類を選択してください。")
      .setColor(COLOR.GREEN);

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showCreatorSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const product = interaction.values[0];
    if (!this.isProduct(product)) {
      throw new Error("無効な紋章商品です。");
    }
    const payer = await interaction.guild!.members.fetch(interaction.user.id);
    this.assertProductEligibility(payer, product);

    const members = await interaction.guild!.members.fetch();
    const creators = members
      .filter((member) => !member.user.bot && this.isCreator(member))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
    if (creators.size === 0) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.NO_CREATOR);
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`${this.CREATOR_SELECT_PREFIX}:${product}`)
      .setPlaceholder("夢印屋さんを選択してください")
      .addOptions(
        creators.first(25).map((member) => ({
          label: member.displayName.slice(0, 100),
          value: member.id,
          description: member.roles.cache.has(ROLE_IDS.EMBLEM_CREATOR_LEADER)
            ? "夢印屋さん店長"
            : "夢印屋さん",
        })),
      );
    const embed = new EmbedBuilder()
      .setTitle("夢印屋さんを選択")
      .setDescription("夢印屋さんまたは夢印屋さん店長のみが表示されています。")
      .setColor(COLOR.GREEN);

    await interaction.update({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showConfirmation(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, productValue] = interaction.customId.split(":");
    const creatorId = interaction.values[0];
    if (!this.isProduct(productValue)) {
      throw new Error("無効な紋章商品です。");
    }

    const payer = await interaction.guild!.members.fetch(interaction.user.id);
    const creator = await interaction.guild!.members.fetch(creatorId);
    const price = this.getPriceForMember(payer, productValue);
    if (!this.isCreator(creator)) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.INVALID_CREATOR);
    }

    const product = PRODUCTS[productValue];
    const embed = new EmbedBuilder()
      .setTitle("支払い内容の確認")
      .setDescription(
        `商品: **${product.label}**\n` +
        `夢印屋さん: <@${creator.id}>\n` +
        `支払い金額: **${price.toLocaleString()}${CURRENCY_NAMES}**\n\n` +
        "この内容で送金しますか？",
      )
      .setColor(COLOR.YELLOW);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${this.CONFIRM_PREFIX}:${productValue}:${creator.id}`)
        .setLabel("確定して支払う")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("キャンセル")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.update({ embeds: [embed], components: [row] });
  }

  static async pay(interaction: ButtonInteraction): Promise<void> {
    const [, productValue, creatorId] = interaction.customId.split(":");
    if (!this.isProduct(productValue) || !creatorId) {
      throw new Error("無効な支払い内容です。最初からやり直してください。");
    }

    const payer = await interaction.guild!.members.fetch(interaction.user.id);
    const creator = await interaction.guild!.members.fetch(creatorId);
    const price = this.getPriceForMember(payer, productValue);
    if (!this.isCreator(creator)) {
      throw new Error(CREATOR_EMBLEM_PANEL_MESSAGES.INVALID_CREATOR);
    }

    await SendService.executeSend(
      interaction,
      interaction.user.id,
      creator.id,
      price,
      `夢印工房送金: ${PRODUCTS[productValue].label}`,
      PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY,
      "editReply",
    );
  }
}
