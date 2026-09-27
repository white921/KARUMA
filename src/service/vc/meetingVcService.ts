import {
  CategoryChannel, ChannelType, Client, GuildMember, MessageFlags,
  OverwriteType, PermissionFlagsBits, PermissionsBitField, RESTJSONErrorCodes,
  StringSelectMenuInteraction, VoiceChannel,
} from "discord.js";
import {
  MEETING_CATEGORY_ID, MEETING_JOIN_GRACE_MS, MEETING_PANEL_CHANNEL_ID,
  MEETING_TEMPLATES, MEETING_VC_TYPE,
} from "../../constant/vc/meeting";
import { DbService } from "../system/dbService";

type MeetingOverwrite = { id: string; type: OverwriteType; allow: bigint; deny: bigint };
const { ViewChannel, Connect, Administrator } = PermissionFlagsBits;

export function buildMeetingOverwrites(source: VoiceChannel, category: CategoryChannel): MeetingOverwrite[] {
  const overwrites = new Map<string, MeetingOverwrite>();
  for (const entry of source.permissionOverwrites.cache.values()) {
    overwrites.set(entry.id, { id: entry.id, type: entry.type, allow: entry.allow.bitfield, deny: entry.deny.bitfield });
  }
  // カテゴリー内の一般閲覧ロールには閲覧だけを許可する。
  // 劇場の一般ロールへの接続許可と、システムの非表示設定もここで統一する。
  for (const entry of category.permissionOverwrites.cache.values()) {
    if (entry.type !== OverwriteType.Role || !entry.allow.has(ViewChannel)) continue;
    const existing = overwrites.get(entry.id) ?? { id: entry.id, type: entry.type, allow: 0n, deny: 0n };
    existing.allow = (existing.allow | ViewChannel) & ~Connect;
    existing.deny = (existing.deny | Connect) & ~ViewChannel;
    overwrites.set(entry.id, existing);
  }
  const everyone = overwrites.get(source.guild.id) ?? { id: source.guild.id, type: OverwriteType.Role, allow: 0n, deny: 0n };
  everyone.allow &= ~Connect;
  everyone.deny |= Connect;
  overwrites.set(everyone.id, everyone);
  // 接続許可を持つ従業員は、一般閲覧ロールがなくてもVCを見られる。
  for (const entry of overwrites.values()) {
    if ((entry.allow & Connect) !== 0n) {
      entry.allow |= ViewChannel;
      entry.deny &= ~ViewChannel;
    }
  }
  return [...overwrites.values()];
}

export function canJoinMeeting(member: GuildMember, overwrites: MeetingOverwrite[]): boolean {
  if (member.id === member.guild.ownerId || member.permissions.has(Administrator)) return true;
  let permissions = member.permissions.bitfield;
  const everyone = overwrites.find(entry => entry.id === member.guild.id);
  if (everyone) permissions = (permissions & ~everyone.deny) | everyone.allow;
  let allow = 0n;
  let deny = 0n;
  for (const entry of overwrites) {
    if (entry.type === OverwriteType.Role && entry.id !== member.guild.id && member.roles.cache.has(entry.id)) {
      allow |= entry.allow;
      deny |= entry.deny;
    }
  }
  permissions = (permissions & ~deny) | allow;
  const personal = overwrites.find(entry => entry.type === OverwriteType.Member && entry.id === member.id);
  if (personal) permissions = (permissions & ~personal.deny) | personal.allow;
  return new PermissionsBitField(permissions).has([ViewChannel, Connect]);
}

export class MeetingVcService {
  private static creating = new Set<string>();
  private static deleting = new Set<string>();
  private static checking = false;
  private static timer: NodeJS.Timeout | null = null;

  static async create(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const template = MEETING_TEMPLATES.find(entry => entry.id === interaction.values[0]);
    if (!guild || guild.id !== process.env.GUILD_ID || interaction.channelId !== MEETING_PANEL_CHANNEL_ID || !template) {
      throw new Error("会議VC作成パネルからカテゴリーを選び直してください。");
    }
    const key = `${guild.id}:${interaction.user.id}`;
    if (this.creating.has(key)) throw new Error("会議VCを作成中です。しばらくお待ちください。");
    this.creating.add(key);
    try {
      const [source, category, member] = await Promise.all([
        guild.channels.fetch(template.id, { force: true }),
        guild.channels.fetch(MEETING_CATEGORY_ID, { force: true }),
        guild.members.fetch({ user: interaction.user.id, force: true }),
        guild.roles.fetch(),
      ]);
      if (!source || source.type !== ChannelType.GuildVoice || source.parentId !== MEETING_CATEGORY_ID ||
          !category || category.type !== ChannelType.GuildCategory) {
        throw new Error("参照元の会議VCが見つかりません。管理者にお問い合わせください。");
      }
      const permissionOverwrites = buildMeetingOverwrites(source, category);
      if (!canJoinMeeting(member, permissionOverwrites)) {
        throw new Error("この会議VCを作成できるのは、接続権限を持つ関係者のみです。");
      }
      // DB接続に失敗した場合、VCを先に作って残さない。
      const connection = await DbService.getConnection();
      let channel: VoiceChannel;
      try {
        channel = await guild.channels.create({
          name: `${template.label}会議`, type: ChannelType.GuildVoice,
          parent: MEETING_CATEGORY_ID, permissionOverwrites,
          bitrate: source.bitrate, userLimit: 0,
          reason: `会議パネル: ${member.id} / 参照元 ${template.id}`,
        });
        try {
          // is_bonus はホテルの掃除対象になるため false。通貨・チケット処理は行わない。
          await connection.execute(
            "INSERT INTO vcs (channel_id, owner_id, type, is_ticket, is_bonus, expire_at) VALUES (?, ?, ?, FALSE, FALSE, NULL)",
            [channel.id, member.id, MEETING_VC_TYPE],
          );
        } catch (error) {
          await channel.delete("会議VCの保存失敗による取消").catch(cleanupError => console.error("会議VCの作成取消失敗:", channel.id, cleanupError));
          throw error;
        }
      } finally {
        connection.release();
      }
      await interaction.editReply({
        content: `✅ <#${channel.id}> を無料で作成しました。\n5分以内に入室してください。全員が退出すると自動で削除されます。`,
        allowedMentions: { parse: [] },
      });
    } finally {
      this.creating.delete(key);
    }
  }

  private static async deactivate(channelId: string) {
    const connection = await DbService.getConnection();
    try {
      await connection.execute("UPDATE vcs SET is_active = FALSE WHERE channel_id = ? AND type = ?", [channelId, MEETING_VC_TYPE]);
    } finally {
      connection.release();
    }
  }

  static async deleteIfEmpty(channel: VoiceChannel): Promise<boolean> {
    if (channel.guild.id !== process.env.GUILD_ID || channel.parentId !== MEETING_CATEGORY_ID ||
        MEETING_TEMPLATES.some(entry => entry.id === channel.id) ||
        channel.members.size > 0 || this.deleting.has(channel.id)) return false;
    this.deleting.add(channel.id);
    try {
      const connection = await DbService.getConnection();
      let rows: any[];
      try {
        [rows] = await connection.execute<any[]>(
          "SELECT channel_id FROM vcs WHERE channel_id = ? AND type = ? AND is_active = TRUE",
          [channel.id, MEETING_VC_TYPE],
        );
      } finally {
        connection.release();
      }
      // DB待機中の入室も確認する。Botを含め、完全に0人のときだけ削除する。
      if (!rows.length || channel.members.size > 0 || !channel.client.isReady()) return false;
      try {
        await channel.delete("会議VCが0人になったため自動削除");
      } catch (error: any) {
        if (error.code !== RESTJSONErrorCodes.UnknownChannel) throw error;
      }
      await this.deactivate(channel.id);
      return true;
    } finally {
      this.deleting.delete(channel.id);
    }
  }

  static async cleanup(client: Client) {
    if (this.checking || !client.isReady()) return;
    this.checking = true;
    try {
      const connection = await DbService.getConnection();
      let rows: any[];
      try {
        [rows] = await connection.execute<any[]>(
          "SELECT channel_id FROM vcs WHERE type = ? AND is_active = TRUE AND created_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)",
          [MEETING_VC_TYPE, MEETING_JOIN_GRACE_MS / 1000],
        );
      } finally {
        connection.release();
      }
      for (const row of rows) {
        const channelId = String(row.channel_id);
        try {
          const channel = await client.channels.fetch(channelId);
          if (!channel) await this.deactivate(channelId);
          else if (channel.type === ChannelType.GuildVoice) await this.deleteIfEmpty(channel);
        } catch (error: any) {
          if (error.code === RESTJSONErrorCodes.UnknownChannel) await this.deactivate(channelId);
          else console.error("会議VCの自動削除失敗:", channelId, error);
        }
      }
    } finally {
      this.checking = false;
    }
  }

  static startCleanup(client: Client) {
    if (this.timer) return;
    const run = () => this.cleanup(client).catch(error => console.error("会議VCの巡回失敗:", error));
    void run();
    this.timer = setInterval(run, 60_000);
    this.timer.unref();
  }
}
