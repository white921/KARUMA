import { randomUUID } from "node:crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember } from "discord.js";
import type { RowDataPacket } from "mysql2/promise";
import dayjs, { Dayjs } from "dayjs";

import { HAZAMA_ACCESS_DURATION_HOURS, HAZAMA_MESSAGES, HAZAMA_PRICE } from "../../constant/vc/hazama";
import { BOT_ID, ROLE_IDS } from "../../constant/shared/id";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { ITEM_KEY } from "../../constant/inventory/item";
import { toActionType } from "../../constant/currency/action";
import { hasRole } from "../../util/member/role";
import { ActionService } from "../currency/actionService";
import { ItemService } from "../inventory/itemService";
import { DbService } from "../system/dbService";

export function calculateHazamaAccessExpireAt(now = dayjs()): Dayjs {
  return now.add(HAZAMA_ACCESS_DURATION_HOURS, "hour");
}

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
type Confirmation = {
  userId: string; guildId: string | null; channelId: string; expiresAt: number; useTicket: boolean;
};

export class HazamaService {
  private static confirmations = new Map<string, Confirmation>();

  static async isFree(member: GuildMember): Promise<boolean> {
    return (await hasRole(member, ROLE_IDS.HAZAMA_LEADER)) || (await hasRole(member, ROLE_IDS.HAZAMA_STAFF));
  }

  static async getPrice(): Promise<number> { return HAZAMA_PRICE; }

  static async showConfirmation(interaction: ButtonInteraction): Promise<void> {
    const member = await interaction.guild!.members.fetch({ user: interaction.user.id, force: true });
    if (await this.isFree(member)) {
      await interaction.editReply({ content: HAZAMA_MESSAGES.FREE_ACCESS, embeds: [], components: [] });
      return;
    }
    if (member.roles.cache.has(ROLE_IDS.HAZAMA_ACCESS)) throw new Error(HAZAMA_MESSAGES.ALREADY_HAS_ROLE);
    const useTicket = await ItemService.hasItem(interaction.user.id, ITEM_KEY.HAZAMA_FREE);
    const id = randomUUID();
    this.confirmations.set(id, {
      userId: interaction.user.id, guildId: interaction.guildId, channelId: interaction.channelId,
      expiresAt: Date.now() + CONFIRMATION_TTL_MS, useTicket,
    });
    setTimeout(() => this.confirmations.delete(id), CONFIRMATION_TTL_MS).unref();
    try {
      await interaction.editReply({
        content: "",
        embeds: [new EmbedBuilder().setTitle("辺境の狭間の滞在許可証を取得しますか？")
          .setDescription(`料金：**${useTicket ? "辺境の狭間無料券1枚（LIA消費なし）" : "1,000LIA"}**\n利用時間：12時間`)
          .setFooter({ text: "10分以内に確定してください。" })],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${PANEL_COMMAND_NAMES.HAZAMA_CANCEL}:${id}`).setLabel("キャンセル").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`${PANEL_COMMAND_NAMES.HAZAMA_CONFIRM}:${id}`).setLabel("取得を確定").setStyle(ButtonStyle.Success),
        )],
      });
    } catch (error) {
      this.confirmations.delete(id);
      throw error;
    }
  }

  static async handleConfirmation(interaction: ButtonInteraction): Promise<void> {
    const [action, id, extra] = interaction.customId.split(":");
    const confirmation = this.confirmations.get(id);
    if (extra !== undefined || ![PANEL_COMMAND_NAMES.HAZAMA_CONFIRM, PANEL_COMMAND_NAMES.HAZAMA_CANCEL].includes(action) || !confirmation || confirmation.expiresAt <= Date.now()) {
      throw new Error("この確認画面は期限切れ、または処理済みです。パネルからやり直してください。");
    }
    if (confirmation.userId !== interaction.user.id || confirmation.guildId !== interaction.guildId || confirmation.channelId !== interaction.channelId) {
      throw new Error("この確認画面は操作できません。");
    }
    this.confirmations.delete(id);
    const cancel = action === PANEL_COMMAND_NAMES.HAZAMA_CANCEL;
    await interaction.editReply({ content: cancel ? "キャンセルしました。" : "処理しています…", embeds: [], components: [] });
    if (!cancel) await this.purchase(interaction, confirmation.useTicket);
  }

  private static async purchase(interaction: ButtonInteraction, useTicket: boolean): Promise<void> {
    const userId = interaction.user.id;
    const connection = await DbService.getConnection();
    let grantedMember: GuildMember | undefined;
    const expireAt = calculateHazamaAccessExpireAt();
    const price = useTicket ? 0 : HAZAMA_PRICE;
    try {
      await connection.beginTransaction();
      const [accounts] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ? FOR UPDATE", [userId]);
      if (!accounts[0]) throw new Error("口座が見つかりません。");
      // 口座ロックを取得した後でDiscordとDBの双方を確認し、別の確認画面からの二重取得も防ぐ。
      const member = await interaction.guild!.members.fetch({ user: userId, force: true });
      if (await this.isFree(member)) {
        await connection.rollback();
        await interaction.editReply({ content: HAZAMA_MESSAGES.FREE_ACCESS, embeds: [], components: [] });
        return;
      }
      const [active] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM role_management_logs WHERE user_id = ? AND role_id = ? AND is_deleted = FALSE AND expire_at > UTC_TIMESTAMP() FOR UPDATE",
        [userId, ROLE_IDS.HAZAMA_ACCESS],
      );
      if (member.roles.cache.has(ROLE_IDS.HAZAMA_ACCESS) || active.length) throw new Error(HAZAMA_MESSAGES.ALREADY_HAS_ROLE);
      // 在庫が確認時から変わった場合はロールバックし、勝手にLIA払いへ切り替えない。
      const consumed = await ItemService.consume(connection, userId, ITEM_KEY.HAZAMA_FREE);
      if (consumed !== useTicket) throw new Error("チケットの所持状況が変わりました。パネルからもう一度確認してください。");
      const wallet = Number(accounts[0].wallet);
      if (wallet < price) throw new Error(HAZAMA_MESSAGES.NOT_ENOUGH_BALANCE);
      if (price > 0) await connection.execute("UPDATE accounts SET wallet = wallet - ? WHERE user_id = ?", [price, userId]);
      await connection.execute(
        `INSERT INTO role_management_logs (user_id, role_id, is_deleted, expire_at) VALUES (?, ?, FALSE, ?)
         ON DUPLICATE KEY UPDATE is_deleted = FALSE, expire_at = VALUES(expire_at), updated_at = CURRENT_TIMESTAMP`,
        [userId, ROLE_IDS.HAZAMA_ACCESS, expireAt.toDate()],
      );
      const [bot] = await connection.execute<RowDataPacket[]>("SELECT wallet FROM accounts WHERE user_id = ?", [BOT_ID]);
      await connection.execute(
        `INSERT INTO actions (command_name, amount, from_user_id, to_user_id, from_after_wallet, to_after_wallet, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [toActionType(PANEL_COMMAND_NAMES.HAZAMA_ACCESS), price, userId, BOT_ID, wallet - price, bot[0]?.wallet ?? 0,
          `${HAZAMA_MESSAGES.ACCESS}を取得（${useTicket ? "辺境の狭間無料券1枚使用" : "LIA払い"}）`],
      );
      // Discordで権限付与に失敗すれば、チケット・料金・履歴を同じトランザクションで戻す。
      await member.roles.add(ROLE_IDS.HAZAMA_ACCESS);
      grantedMember = member;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (grantedMember) await grantedMember.roles.remove(ROLE_IDS.HAZAMA_ACCESS).catch(cleanupError => console.error("狭間の取得失敗後にロールを削除できませんでした:", cleanupError));
      throw error;
    } finally {
      connection.release();
    }
    await ActionService.createActionLogMessage(interaction, PANEL_COMMAND_NAMES.HAZAMA_ACCESS, price, userId, BOT_ID,
      useTicket ? "辺境の狭間無料券1枚使用" : "").catch(error => console.error("狭間ログの送信に失敗しました:", error));
    const jstExpireDateTime = expireAt.toDate().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    await interaction.editReply({
      content: `${HAZAMA_MESSAGES.ACCESS}を取得しました。\n${useTicket ? "辺境の狭間無料券を1枚使用しました。\n" : ""}有効期限は${jstExpireDateTime}までです。`,
      embeds: [], components: [],
    });
  }
}
