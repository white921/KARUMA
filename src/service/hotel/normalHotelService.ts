import { randomUUID } from "node:crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember } from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import { HOTEL_TYPE, HOTEL_TYPE_NAMES, NORMAL_HOTEL_CONFIRMATION_PREFIX } from "../../constant/hotel/hotel";
import { ITEM_KEY } from "../../constant/inventory/item";
import { BOT_ID, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { toActionType } from "../../constant/currency/action";
import { DbService } from "../system/dbService";
import { ItemService } from "../inventory/itemService";
import { HotelVcService } from "./hotelVcService";
import { ActionService } from "../currency/actionService";

type Quote = { price: number; useTicket: boolean; isBonus: boolean };
type Confirmation = Quote & { userId: string; guildId: string; channelId: string; expiresAt: number };
const TTL = 10 * 60 * 1000;

export class NormalHotelService {
  private static confirmations = new Map<string, Confirmation>();

  private static assertChannel(interaction: ButtonInteraction) {
    if (!interaction.guild || interaction.channelId !== TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL) {
      throw new Error("通常ホテルの利用パネルから操作してください。");
    }
  }

  private static async getQuote(member: GuildMember): Promise<Quote> {
    const isBonus = await HotelVcService.isNormalHotelBonusMember(member);
    const useTicket = !isBonus && await ItemService.hasItem(member.id, ITEM_KEY.HOTEL_NORMAL_FREE);
    return { isBonus, useTicket, price: isBonus || useTicket ? 0 : await HotelVcService.getHotelVcPrice(HOTEL_TYPE.NORMAL, member) };
  }

  static async showConfirmation(interaction: ButtonInteraction, notice = ""): Promise<void> {
    this.assertChannel(interaction);
    const member = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    const quote = await this.getQuote(member);
    const id = randomUUID();
    this.confirmations.set(id, { ...quote, userId: interaction.user.id, guildId: interaction.guildId!, channelId: interaction.channelId, expiresAt: Date.now() + TTL });
    setTimeout(() => this.confirmations.delete(id), TTL).unref();
    try {
      await interaction.editReply({
        content: notice,
        embeds: [new EmbedBuilder().setTitle("通常ホテルを作成しますか？")
          .setDescription(`料金：**${quote.useTicket ? "通常ホテル無料券1枚（LIA消費なし）" : quote.isBonus ? "無料（ロール特典）" : `${quote.price.toLocaleString()}LIA`}**\n${quote.isBonus ? "ロール特典の通常ホテルを作成します。" : "利用時間：12時間"}`)
          .setFooter({ text: "10分以内に確定してください。" })],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${NORMAL_HOTEL_CONFIRMATION_PREFIX}:cancel:${id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`${NORMAL_HOTEL_CONFIRMATION_PREFIX}:confirm:${id}`).setLabel("作成を確定").setStyle(ButtonStyle.Success),
        )],
      });
    } catch (error) { this.confirmations.delete(id); throw error; }
  }

  static async handleConfirmation(interaction: ButtonInteraction): Promise<void> {
    this.assertChannel(interaction);
    const [prefix, action, id, extra] = interaction.customId.split(":");
    const quote = this.confirmations.get(id);
    if (prefix !== NORMAL_HOTEL_CONFIRMATION_PREFIX || extra !== undefined || !["confirm", "cancel"].includes(action) || !quote || quote.expiresAt <= Date.now()) {
      throw new Error("この確認画面は期限切れ、または処理済みです。パネルからやり直してください。");
    }
    if (quote.userId !== interaction.user.id || quote.guildId !== interaction.guildId || quote.channelId !== interaction.channelId) throw new Error("この確認画面は操作できません。");
    this.confirmations.delete(id);
    await interaction.editReply({ content: action === "cancel" ? "キャンセルしました。" : "処理しています…", embeds: [], components: [] });
    if (action === "cancel") return;
    const member = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    const current = await this.getQuote(member);
    if (current.price !== quote.price || current.useTicket !== quote.useTicket || current.isBonus !== quote.isBonus) {
      await this.showConfirmation(interaction, "料金またはチケットの所持状況が変わりました。内容を確認してもう一度確定してください。");
      return;
    }
    // VCの作成・権限設定は既存処理を利用し、確定前の成功通知は抑える。
    const creationInteraction = Object.create(interaction) as ButtonInteraction;
    Object.defineProperty(creationInteraction, "member", { value: member });
    const voiceId = await HotelVcService.createHotelVc(creationInteraction, HOTEL_TYPE_NAMES.NORMAL, quote.isBonus, undefined, false);
    try {
      await this.recordPurchase(interaction.user.id, voiceId, quote);
    } catch (error) {
      await interaction.guild!.channels.fetch(voiceId).then(async channel => { if (channel) await channel.delete(); }).catch(cleanup => console.error("通常ホテル決済失敗後のVC削除に失敗しました:", cleanup));
      throw error;
    }
    await ActionService.createActionLogMessage(interaction, PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL, quote.price, interaction.user.id, BOT_ID,
      quote.useTicket ? "通常ホテル無料券1枚使用" : "").catch(error => console.error("通常ホテルログ送信に失敗しました:", error));
    await interaction.editReply({
      content: `✅ **通常ホテル**を作成しました！\n<#${voiceId}>\n${quote.useTicket ? "通常ホテル無料券を1枚使用しました。" : quote.isBonus ? "料金：無料（ロール特典）" : `料金：${quote.price.toLocaleString()}LIA`}`,
      embeds: [], components: [],
    });
  }

  private static async recordPurchase(userId: string, voiceId: string, quote: Quote): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
      if (!accounts[0]) throw new Error("口座が見つかりません。");
      const consumed = !quote.isBonus && await ItemService.consume(connection, userId, ITEM_KEY.HOTEL_NORMAL_FREE);
      if (consumed !== quote.useTicket) throw new Error("チケットの所持状況が変わりました。パネルからもう一度確認してください。");
      const afterWallet = Number(accounts[0].wallet) - quote.price;
      if (afterWallet < 0) throw new Error("残高が不足しています。");
      if (quote.price > 0) await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, userId]);
      await connection.execute(
        "INSERT INTO vcs (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at) VALUES (?, ?, NULL, ?, ?, ?, ?)",
        [voiceId, userId, HOTEL_TYPE.NORMAL, quote.useTicket, quote.isBonus, quote.isBonus ? null : new Date(Date.now() + 12 * 3600000)],
      );
      const [bot] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ?", [BOT_ID]);
      await connection.execute("INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [toActionType(PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL), quote.price, userId, BOT_ID, afterWallet, bot[0]?.wallet ?? 0,
          `通常ホテルVC作成${quote.useTicket ? "（通常ホテル無料券1枚使用）" : quote.isBonus ? "（ロール特典）" : ""}`]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
}
