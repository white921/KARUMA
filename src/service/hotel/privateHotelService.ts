import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder,
  UserSelectMenuBuilder, UserSelectMenuInteraction,
} from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import {
  getPrivateHotelPlan, PRIVATE_HOTEL_PREFIX, resolvePrivateHotelPayment,
  PrivateHotelHours, PrivateHotelKind,
} from "../../constant/hotel/privateHotel";
import { BOT_ID, TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { toActionType } from "../../constant/currency/action";
import { COLOR } from "../../constant/shared/color";
import { ItemService } from "../inventory/itemService";
import { DbService } from "../system/dbService";
import { HotelVcService } from "./hotelVcService";
import { AccountService } from "../account/accountService";

type Interaction = ButtonInteraction | UserSelectMenuInteraction;
type Payment = "ticket" | "money";
type Session = {
  id: string; userId: string; guildId: string; kind: PrivateHotelKind;
  expiresAt: number; hours?: PrivateHotelHours; guestId?: string; payment?: Payment;
  step: "duration" | "guest" | "confirm" | "processing";
};
type WalletRow = RowDataPacket & { wallet: number };
type InventoryRow = RowDataPacket & { quantity: number };
const SESSION_MS = 15 * 60 * 1000;

export class PrivateHotelService {
  private static sessions = new Map<string, Session>();
  private static processingUsers = new Set<string>();

  private static assertChannel(interaction: Interaction) {
    if (!interaction.guild || interaction.channelId !== TEXT_CHANNEL_IDS.PRIVATE_HOTEL_PANEL) {
      throw new Error("新ホテルの利用パネルから操作してください。");
    }
  }

  private static getSession(interaction: Interaction, id: string) {
    this.assertChannel(interaction);
    const session = this.sessions.get(id);
    if (!session || session.expiresAt < Date.now() || session.userId !== interaction.user.id ||
        session.guildId !== interaction.guildId) {
      throw new Error("この操作は期限切れです。パネルから選び直してください。");
    }
    if (session.step === "processing") throw new Error("作成処理中です。しばらくお待ちください。");
    return session;
  }

  static async handleButton(interaction: ButtonInteraction) {
    this.assertChannel(interaction);
    const [, action, id, duration] = interaction.customId.split(":");
    if (action === "vip" || action === "freedom") {
      for (const [key, value] of this.sessions) {
        if (value.step !== "processing" && (value.expiresAt < Date.now() || value.userId === interaction.user.id)) {
          this.sessions.delete(key);
        }
      }
      if (this.processingUsers.has(interaction.user.id)) throw new Error("作成処理中です。");
      const session: Session = {
        id: randomUUID(), userId: interaction.user.id, guildId: interaction.guildId!,
        kind: action, expiresAt: Date.now() + SESSION_MS, step: "duration",
      };
      this.sessions.set(session.id, session);
      await interaction.editReply({
        content: `${action === "vip" ? "VIPホテル" : "フリーダムホテル"}の利用時間を選択してください。`,
        embeds: [],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...([12, 24] as const).map(hours => new ButtonBuilder()
            .setCustomId(`${PRIVATE_HOTEL_PREFIX}duration:${session.id}:${hours}`)
            .setLabel(`${hours}時間`).setStyle(ButtonStyle.Primary)),
        )],
      });
      return;
    }
    const session = this.getSession(interaction, id);
    if (action === "cancel") {
      this.sessions.delete(session.id);
      await interaction.editReply({ content: "キャンセルしました。", embeds: [], components: [] });
      return;
    }
    if (action === "duration" && session.step === "duration" && (duration === "12" || duration === "24")) {
      session.hours = Number(duration) as PrivateHotelHours;
      if (session.kind === "vip") {
        session.step = "guest";
        await interaction.editReply({
          content: `VIPホテル（${session.hours}時間）の相手を選択してください。`, embeds: [],
          components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder().setCustomId(`${PRIVATE_HOTEL_PREFIX}guest:${session.id}`)
              .setPlaceholder("一緒に利用する相手").setMinValues(1).setMaxValues(1),
          )],
        });
      } else {
        await this.showConfirmation(interaction, session);
      }
      return;
    }
    if (action === "confirm" && session.step === "confirm") {
      await this.create(interaction, session);
      return;
    }
    throw new Error("操作が古くなっています。パネルから選び直してください。");
  }

  static async handleUserSelect(interaction: UserSelectMenuInteraction) {
    const [, action, id] = interaction.customId.split(":");
    const session = this.getSession(interaction, id);
    if (action !== "guest" || session.kind !== "vip" || session.step !== "guest") {
      throw new Error("操作が古くなっています。パネルから選び直してください。");
    }
    const guestId = interaction.values[0];
    if (guestId === interaction.user.id) throw new Error("自分を選択することはできません。");
    const guest = await interaction.guild!.members.fetch(guestId);
    if (guest.user.bot) throw new Error("Botを相手に選択することはできません。");
    session.guestId = guestId;
    await this.showConfirmation(interaction, session);
  }

  private static async getPayment(session: Session): Promise<Payment> {
    const plan = getPrivateHotelPlan(session.kind, session.hours!);
    const quantities = await ItemService.getQuantities(session.userId, [plan.itemKey]);
    return resolvePrivateHotelPayment(quantities.get(plan.itemKey) ?? 0, plan.ticketCount);
  }

  private static paymentLabel(session: Session) {
    const plan = getPrivateHotelPlan(session.kind, session.hours!);
    return session.payment === "ticket"
      ? `12時間用チケットを${plan.ticketCount}枚消費`
      : `${plan.price.toLocaleString("ja-JP")}${CURRENCY_NAMES}を消費`;
  }

  private static async showConfirmation(interaction: Interaction, session: Session, notice = "") {
    session.payment = await this.getPayment(session);
    session.step = "confirm";
    const plan = getPrivateHotelPlan(session.kind, session.hours!);
    await interaction.editReply({
      content: notice,
      embeds: [new EmbedBuilder().setTitle(plan.name).setColor(COLOR.YELLOW).setDescription(
        `${this.paymentLabel(session)}して作成しますか？` +
        (session.guestId ? `\n相手：<@${session.guestId}>` : "") +
        (session.payment === "ticket" ? "\n必要枚数を所持しているため、チケットを優先して使用します。" : ""),
      )],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${PRIVATE_HOTEL_PREFIX}confirm:${session.id}`).setLabel("作成する").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${PRIVATE_HOTEL_PREFIX}cancel:${session.id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
      )],
    });
  }

  private static async create(interaction: ButtonInteraction, session: Session) {
    if (this.processingUsers.has(session.userId)) throw new Error("作成処理中です。");
    session.step = "processing";
    this.processingUsers.add(session.userId);
    try {
      // 確認後に在庫が変わった場合、別の支払方法で勝手に決済しない。
      if (await this.getPayment(session) !== session.payment) {
        await this.showConfirmation(interaction, session, "チケットの所持数が変わったため、支払い内容をもう一度確認してください。");
        return;
      }
      const plan = getPrivateHotelPlan(session.kind, session.hours!);
      if (session.payment === "money") {
        const account = (await AccountService.getAccountByUserId(session.userId))[0];
        if (!account) throw new Error("口座が見つかりません。");
        if (Number(account.wallet) < plan.price) throw new Error("残高が不足しています。");
      }
      if (session.kind === "vip") {
        if (!session.guestId) throw new Error("相手を選択してください。");
        await interaction.guild!.members.fetch(session.guestId);
      }
      // ログ先の設定不備を決済前に検出する。
      const logChannel = await interaction.guild!.channels.fetch(TEXT_CHANNEL_IDS.PRIVATE_HOTEL_LOG);
      if (!logChannel || !logChannel.isTextBased() || !("send" in logChannel)) {
        throw new Error("新ホテルのログチャンネルが見つかりません。");
      }
      await interaction.editReply({ content: "ホテルを作成しています…", embeds: [], components: [] });
      const voiceChannelId = await HotelVcService.createHotelVc(interaction, plan.name, false, session.guestId, false);
      try {
        await this.recordCreation(session, voiceChannelId);
      } catch (error) {
        await interaction.guild!.channels.delete(voiceChannelId).catch(cleanupError =>
          console.error("新ホテルの決済失敗後のVC削除に失敗しました:", cleanupError));
        throw error;
      }
      this.sessions.delete(session.id);
      try {
        await logChannel.send({
          content: `**ホテルVC作成**\n作成者：<@${session.userId}>\n種類：${plan.name}\n` +
            (session.guestId ? `相手：<@${session.guestId}>\n` : "") +
            `支払い：${this.paymentLabel(session)}\nVC：<#${voiceChannelId}>`,
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        // 決済完了後の通知失敗で、再購入を促さない。
        console.error(`新ホテル作成ログの送信に失敗しました（VC ${voiceChannelId}）:`, error);
      }
      await interaction.editReply({ content: `✅ **${plan.name}**を作成しました！\n${this.paymentLabel(session)}しました。\n<#${voiceChannelId}>`, embeds: [], components: [] });
    } catch (error) {
      this.sessions.delete(session.id);
      throw error;
    } finally {
      this.processingUsers.delete(session.userId);
    }
  }

  /** 在庫・残高・VC・取引履歴を同一トランザクションで確定する。旧パネルはこの経路を使わない。 */
  private static async recordCreation(session: Session, voiceChannelId: string) {
    const plan = getPrivateHotelPlan(session.kind, session.hours!);
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<WalletRow[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [session.userId]);
      if (!accounts[0]) throw new Error("口座が見つかりません。");
      const [inventory] = await connection.execute<InventoryRow[]>(
        `SELECT iu.quantity FROM item_users iu INNER JOIN items i ON i.id = iu.item_id
         WHERE iu.user_id = ? AND i.item_key = ? FOR UPDATE`, [session.userId, plan.itemKey],
      );
      const payment = resolvePrivateHotelPayment(Number(inventory[0]?.quantity ?? 0), plan.ticketCount);
      if (payment !== session.payment) throw new Error("チケットの所持数が変わりました。パネルからもう一度確認してください。");
      const price = payment === "money" ? plan.price : 0;
      const afterWallet = Number(accounts[0].wallet) - price;
      if (afterWallet < 0) throw new Error("残高が不足しています。");
      if (payment === "ticket") {
        for (let i = 0; i < plan.ticketCount; i++) {
          if (!await ItemService.consume(connection, session.userId, plan.itemKey)) {
            throw new Error("チケットが不足しています。");
          }
        }
      } else {
        await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [afterWallet, session.userId]);
      }
      const expireAt = new Date(Date.now() + plan.hours * 60 * 60 * 1000);
      await connection.execute(
        `INSERT INTO vcs (channel_id, owner_id, guest_id, type, is_ticket, is_bonus, expire_at)
         VALUES (?, ?, ?, ?, ?, FALSE, ?)`,
        [voiceChannelId, session.userId, session.guestId ?? null, plan.type, payment === "ticket", expireAt],
      );
      const [botAccounts] = await connection.execute<WalletRow[]>("SELECT wallet FROM accounts WHERE user_id = ?", [BOT_ID]);
      await connection.execute(
        `INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [toActionType(plan.type), price, session.userId, BOT_ID, afterWallet, botAccounts[0]?.wallet ?? 0,
          `${voiceChannelId}：${plan.name}` +
            (payment === "ticket" ? `／${this.paymentLabel(session)}` : "")],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
