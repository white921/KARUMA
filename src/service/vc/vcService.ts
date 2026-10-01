import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  REST,
  StringSelectMenuInteraction,
  VoiceChannel,
} from "discord.js";
import { HOTEL_TYPE } from "../../constant/hotel/hotel";
import { GAME_VC } from "../../constant/game/game";
import { CATEGORY_IDS } from "../../constant/shared/id";
import { TELEPORT_TYPE, USER_EDITABLE_VC_TYPES, VC_MESSAGES } from "../../constant/vc/vc";
import type { ManagedVcRow } from "../../type/vc/vc";
import { hasSystemAdminRole } from "../../util/shared/operatorPermission";
import { DbService } from "../system/dbService";

export function isUserEditableManagedVc(
  type: string,
  parentId: string | null,
): boolean {
  if (USER_EDITABLE_VC_TYPES.has(type)) {
    return true;
  }
  return (
    type === TELEPORT_TYPE.TELEPORT &&
    (parentId === CATEGORY_IDS.GAME || parentId === CATEGORY_IDS.HAZAMA)
  );
}

export class VcService {
  private static readonly pendingNameChanges = new Set<string>();
  private static readonly nameRateLimitedUntil = new Map<string, number>();

  private static formatRetryAfter(milliseconds: number): string {
    const totalSeconds = Math.max(1, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}秒`;
    return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
  }

  private static nameRateLimitError(channelId: string): Error | null {
    const limitedUntil = this.nameRateLimitedUntil.get(channelId);
    if (!limitedUntil) return null;
    const remainingMs = limitedUntil - Date.now();
    if (remainingMs <= 0) {
      this.nameRateLimitedUntil.delete(channelId);
      return null;
    }
    return new Error(
      `DiscordのVC名変更上限に達しています。あと${this.formatRetryAfter(remainingMs)}ほどで再操作できます。`,
    );
  }

  /** discord.jsの長時間キューを使わず、429の再試行時刻を利用者へ即時返却する。 */
  static async updateVcName(channel: VoiceChannel, name: string): Promise<void> {
    const cachedError = this.nameRateLimitError(channel.id);
    if (cachedError) throw cachedError;

    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      await channel.setName(name);
      return;
    }

    let response: Response;
    try {
      response = await fetch(`https://discord.com/api/v10/channels/${channel.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error("Discord VC名変更リクエスト失敗", {
        channelId: channel.id,
        error,
      });
      throw new Error("DiscordへのVC名変更リクエストがタイムアウトしました。もう一度お試しください。");
    }

    const resetAfterSeconds = Number(response.headers.get("x-ratelimit-reset-after"));
    const body = await response.json().catch(() => ({})) as {
      message?: string;
      retry_after?: number;
    };
    if (response.status === 429) {
      const retryAfterMs = Math.max(
        1_000,
        Math.ceil(Number(body.retry_after || resetAfterSeconds || 60) * 1000),
      );
      this.nameRateLimitedUntil.set(channel.id, Date.now() + retryAfterMs);
      throw this.nameRateLimitError(channel.id)!;
    }
    if (!response.ok) {
      console.error("Discord VC名変更APIエラー", {
        channelId: channel.id,
        status: response.status,
        message: body.message,
      });
      throw new Error("VC名を変更できませんでした。Botのチャンネル管理権限をご確認ください。");
    }

    if (
      response.headers.get("x-ratelimit-remaining") === "0" &&
      Number.isFinite(resetAfterSeconds) &&
      resetAfterSeconds > 0
    ) {
      this.nameRateLimitedUntil.set(
        channel.id,
        Date.now() + Math.ceil(resetAfterSeconds * 1000),
      );
    }
  }

  /** 鍵は名前の目印のみ。チャンネルの権限には触れない。 */
  static async toggleVcLockMark(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.deferred) await interaction.deferReply({ ephemeral: true });
    await this.validateVcMember(interaction);
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      throw new Error("遊戯・ホテルVCの操作パネルで使用してください。");
    }
    const vcType = await this.getVcTypeFromDb(channel.id);
    if (vcType !== GAME_VC.TYPE && !Object.values(HOTEL_TYPE).includes(vcType ?? "")) {
      throw new Error("遊戯・ホテルVCの操作パネルで使用してください。");
    }
    if (this.pendingNameChanges.has(channel.id)) {
      throw new Error("VC名を変更中です。しばらくお待ちください。");
    }
    this.pendingNameChanges.add(channel.id);
    try {
      const locked = channel.name.startsWith("🔒");
      const name = locked ? channel.name.replace(/^🔒[\uFE0E\uFE0F]?\s*/, "") : `🔒 ${channel.name}`;
      if (!name.trim() || name.length > 100) {
        throw new Error("🔒を付け外しした後のVC名が1〜100文字になるように変更してください。");
      }
      await interaction.editReply({ content: "VC名の変更をDiscordへ申請しています…" });
      await this.updateVcName(channel, name);
      await interaction.editReply({ content: `VC名の先頭の🔒を${locked ? "外しました" : "付けました"}。` });
    } finally {
      this.pendingNameChanges.delete(channel.id);
    }
  }

  private static async getOwnedManagedVoiceChannel(
    interaction: ChatInputCommandInteraction,
  ): Promise<VoiceChannel> {
    const guild = interaction.guild;
    if (!guild) {
      throw new Error("このコマンドはサーバー内でのみ実行できます。");
    }

    const member = await guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error("変更したいBot作成VCに参加してから実行してください。");
    }

    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<ManagedVcRow[]>(
        `SELECT owner_id, type FROM vcs
         WHERE channel_id = ? AND is_active = TRUE`,
        [voiceChannel.id],
      );
      const vc = rows[0];
      if (!vc || !isUserEditableManagedVc(vc.type, voiceChannel.parentId)) {
        throw new Error("このコマンドはBotが作成したゲーム・ホテル・独房・狭間のVCでのみ使用できます。");
      }
      if (String(vc.owner_id) !== interaction.user.id && !hasSystemAdminRole(member)) {
        throw new Error("このVCの作成者のみ変更できます。");
      }
      return voiceChannel;
    } finally {
      connection.release();
    }
  }

  static async changeOwnedManagedVcName(
    interaction: ChatInputCommandInteraction,
    newName: string,
  ): Promise<string> {
    const name = newName.trim();
    if (!name) {
      throw new Error(VC_MESSAGES.NO_NEW_NAME_INPUT);
    }

    const voiceChannel = await this.getOwnedManagedVoiceChannel(interaction);
    await voiceChannel.setName(name);
    return name;
  }

  /**
   * VCタイプをデータベースから取得
   * @param channelId VCチャンネルID
   * @returns VCタイプ（存在しない場合はnull）
   */
  static async getVcTypeFromDb(channelId: string): Promise<string | null> {
    const connection = await DbService.getConnection();
    try {
      const [rows]: any = await connection.execute(
        `SELECT type FROM vcs WHERE channel_id = ? AND is_active = TRUE`,
        [channelId]
      );

      if (rows && rows.length > 0) {
        return rows[0].type;
      }
      return null;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * VCの人数制限を更新
   * @param interaction StringSelectMenuInteraction
   * @param limit 人数制限（0の場合は無制限）
   */
  static async updateVcLimit(
    interaction: StringSelectMenuInteraction,
    limit: number
  ) {
    try {
      const voiceChannel = interaction.channel as VoiceChannel;

      // データベースからVCタイプを取得
      const vcType = await this.getVcTypeFromDb(voiceChannel.id);
      if (vcType) {
        // フリーダム以外のVCは無制限に変更できない
        if (vcType !== HOTEL_TYPE.FREEDOM && limit === 0) {
          throw new Error(VC_MESSAGES.DO_NOT_UPDATE_VC_LIMIT_TO_INFINITY);
        }
      }

      // VCの人数制限を変更（0の場合は無制限）
      await (interaction.channel as VoiceChannel).setUserLimit(limit);

      const limitText = limit === 0 ? "無制限" : `${limit}人`;
      await interaction.reply({
        content: `VCの人数制限を${limitText}に変更しました。`,
        ephemeral: true,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * VCの人数制限を現在値から増減する
   * 無制限VC(userLimit=0)は変更しない
   * @param voiceChannel 対象VC
   * @param diff 増減値
   */
  static async adjustVcLimitByDelta(
    voiceChannel: VoiceChannel,
    diff: number,
  ): Promise<void> {
    if (diff === 0) {
      return;
    }

    const currentLimit = voiceChannel.userLimit;
    if (currentLimit === 0) {
      return;
    }

    // 人数制限1人のVCからBotを退出させると無制限(limit=0)になってしまうのを回避
    if (diff === -1 && currentLimit === 1) {
      return;
    }

    //マイナスにはならないために0との比較を行う
    const nextLimit = Math.max(0, currentLimit + diff);
    if (nextLimit === currentLimit) {
      return;
    }

    await voiceChannel.setUserLimit(nextLimit);
  }

  /**
   * VC名変更
   * @param interaction
   * @param newName 新しいVC名
   */
  static async changeVcName(
    interaction: ModalSubmitInteraction,
    newName: string
  ) {
    if (!interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }
    await this.validateVcMember(interaction);
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      throw new Error(VC_MESSAGES.ERROR);
    }
    if (this.pendingNameChanges.has(channel.id)) {
      throw new Error("VC名を変更中です。しばらくお待ちください。");
    }

    this.pendingNameChanges.add(channel.id);
    try {
      await interaction.editReply({ content: "VC名の変更をDiscordへ申請しています…" });
      await this.updateVcName(channel, newName);
      await interaction.editReply({
        content: `VC名を${newName}に変更しました。`,
      });
    } finally {
      this.pendingNameChanges.delete(channel.id);
    }
  }

  /** VCのステータスを変更する。 */
  static async changeVcStatus(
    interaction: ModalSubmitInteraction,
    newStatus: string,
  ) {
    if (!interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }
    await this.validateVcMember(interaction);
    const status = newStatus.trim();

    const voiceChannel = interaction.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      throw new Error(VC_MESSAGES.ERROR);
    }

    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_TOKEN!,
    );
    await rest.put(`/channels/${voiceChannel.id}/voice-status`, {
      body: { status: status || null },
    });
    await interaction.editReply({
      content: status
        ? `VCステータスを「${status}」に変更しました。`
        : "VCステータスを削除しました。",
    });
  }

  /**
   * VCメンバーのバリデーション
   * @param interaction ButtonInteraction
   */
  static async validateVcMember(interaction: ButtonInteraction | ModalSubmitInteraction) {
    try {
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(interaction.user.id);
      if (hasSystemAdminRole(member)) return;
      const vcId = interaction.channel?.id!;
      // 操作した人がVC内にいなければエラーが起きる
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel || voiceChannel.id !== vcId) {
        throw new Error(VC_MESSAGES.DONT_OPERATE_FROM_OUTSIDE_VC);
      }
    } catch (error) {
      throw error;
    }
  }
}
