import { ChannelType, ChatInputCommandInteraction, Message, PermissionFlagsBits } from "discord.js";
import type { ManagedVcRow } from "../../type/vc/vc";
import { ROLE_IDS } from "../../constant/shared/id";
import { VC_CLEAN_DURATION_MS } from "../../constant/shared/management";
import { hasOperatorRole } from "../../util/shared/operatorPermission";
import { hasManagementPermission } from "../../util/shared/managementPermission";
import { DbService } from "../system/dbService";

export function canCleanVc(member: unknown, userId: string, ownerId?: string): boolean {
  if (hasManagementPermission(member)) return true;
  if (ownerId) return ownerId === userId;
  return hasOperatorRole(member, [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN]);
}

export function shouldPreserveVcMessage(message: Pick<Message, "pinned" | "author" | "components" | "content" | "embeds">): boolean {
  if (message.pinned) return true;
  if (!message.author.bot) return false;
  return message.components.length > 0 || /期限|利用終了|終了時刻/.test(
    [message.content, ...message.embeds.map(embed => JSON.stringify(embed.toJSON()))].join("\n"),
  );
}

export class VcCleanService {
  private static readonly pending = new Set<string>();

  static async clean(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) throw new Error("サーバー内でのみ使用できます。");
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) throw new Error("掃除したいVCのインチャで実行してください。");
    const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
    if (member.voice.channelId !== channel.id) throw new Error("掃除したいVCに参加してから実行してください。");
    const connection = await DbService.getConnection();
    let ownerId: string | undefined;
    try {
      const [rows] = await connection.execute<ManagedVcRow[]>(
        "SELECT owner_id, type FROM vcs WHERE channel_id = ? AND is_active = TRUE ORDER BY id DESC LIMIT 1", [channel.id]);
      ownerId = rows[0] ? String(rows[0].owner_id) : undefined;
    } finally { connection.release(); }
    if (!canCleanVc(member, member.id, ownerId)) {
      throw new Error(ownerId ? "この部屋の部屋主・英傑・皇帝・システム支配人のみ掃除できます。" : "貴族・英傑・皇帝・システム支配人のみ掃除できます。");
    }
    const bot = await interaction.guild.members.fetchMe();
    if (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages])) {
      throw new Error("Botに「チャンネルを見る」「メッセージ履歴を読む」「メッセージの管理」の権限が必要です。");
    }
    if (this.pending.has(channel.id)) throw new Error("このインチャは掃除中です。完了までお待ちください。");
    this.pending.add(channel.id);
    let deleted = 0;
    let preserved = 0;
    let before = interaction.id; // 実行後の新しい会話は削除しない。
    const deadline = Date.now() + VC_CLEAN_DURATION_MS;
    try {
      while (true) {
        const page = await channel.messages.fetch({ limit: 100, before, cache: false });
        if (!page.size) return { deleted, preserved, complete: true };
        before = page.last()!.id;
        const candidates = page.filter(message => {
          if (shouldPreserveVcMessage(message)) { preserved++; return false; }
          return true;
        });
        // 14日境界付近は個別削除にして、一括削除時の経過時間による失敗を避ける。
        const recent = candidates.filter(message => message.createdTimestamp > Date.now() - 13 * 24 * 60 * 60 * 1000);
        if (recent.size) deleted += (await channel.bulkDelete(recent, true)).size;
        for (const message of candidates.values()) {
          if (recent.has(message.id)) continue;
          if (Date.now() >= deadline) return { deleted, preserved, complete: false };
          try { await message.delete(); deleted++; }
          catch (error) {
            if ((error as { code?: number }).code !== 10008) throw error;
          }
        }
        if (page.size < 100) return { deleted, preserved, complete: true };
        if (Date.now() >= deadline) return { deleted, preserved, complete: false };
      }
    } catch (error) {
      console.error("インチャ掃除エラー", { channelId: channel.id, deleted, error });
      throw new Error(`${deleted}件を削除したところで掃除を中断しました。権限や接続を確認して再実行してください。`);
    } finally { this.pending.delete(channel.id); }
  }
}
