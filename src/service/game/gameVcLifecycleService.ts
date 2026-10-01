import {
  ChannelType,
  Client,
  RESTJSONErrorCodes,
  VoiceChannel,
  VoiceState,
} from "discord.js";
import type { RowDataPacket } from "mysql2";
import { GAME_VC } from "../../constant/game/game";
import { updateVcStatus } from "../../util/vc/vc";
import { DbService } from "../system/dbService";

type GameVcLifecycleRow = RowDataPacket & {
  channel_id: string;
  owner_id: string;
  game_plan: string;
  owner_has_joined: number;
  owner_left_at: Date | null;
  delete_due: number;
};

export class GameVcLifecycleService {
  /**
   * 部屋主本人の入退室だけを記録する。作成直後は開始せず、初回入室後の退出から計測する。
   */
  static async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
  ): Promise<void> {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot || oldState.channelId === newState.channelId) return;

    const connection = await DbService.getConnection();
    try {
      if (oldState.channelId) {
        await connection.execute(
          `UPDATE vcs
           SET owner_left_at = UTC_TIMESTAMP()
           WHERE channel_id = ? AND owner_id = ? AND type = ? AND is_active = TRUE
             AND game_plan IS NOT NULL AND owner_has_joined = TRUE AND owner_left_at IS NULL`,
          [oldState.channelId, member.id, GAME_VC.TYPE],
        );
      }
      if (newState.channelId) {
        await connection.execute(
          `UPDATE vcs
           SET owner_has_joined = TRUE, owner_left_at = NULL
           WHERE channel_id = ? AND owner_id = ? AND type = ? AND is_active = TRUE
             AND game_plan IS NOT NULL`,
          [newState.channelId, member.id, GAME_VC.TYPE],
        );
      }
    } finally {
      connection.release();
    }
  }

  /** Botを人数外にするため、6人コースのDiscord上限を「人間6人 + Bot数」に合わせる。 */
  static async adjustLimitedVcLimit(voiceChannel: VoiceChannel): Promise<boolean> {
    const connection = await DbService.getConnection();
    let isLimited = false;
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT game_plan FROM vcs
         WHERE channel_id = ? AND type = ? AND is_active = TRUE AND game_plan IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
        [voiceChannel.id, GAME_VC.TYPE],
      );
      isLimited = rows[0]?.game_plan === GAME_VC.PLANS.LIMITED;
    } finally {
      connection.release();
    }
    if (!isLimited) return false;

    const botCount = voiceChannel.members.filter((member) => member.user.bot).size;
    const desiredLimit = Math.min(99, GAME_VC.LIMITED_HUMAN_LIMIT + botCount);
    if (voiceChannel.userLimit !== desiredLimit) {
      await voiceChannel.setUserLimit(desiredLimit, "遊戯VCの人間6人上限を維持");
    }
    return true;
  }

  /** イベント取りこぼしを補正し、部屋主が10分不在の新仕様VCを削除する。 */
  static async reconcileAndDelete(client: Client): Promise<void> {
    const connection = await DbService.getConnection();
    let rows: GameVcLifecycleRow[];
    try {
      [rows] = await connection.execute<GameVcLifecycleRow[]>(
        `SELECT channel_id, owner_id, game_plan, owner_has_joined, owner_left_at,
                owner_left_at IS NOT NULL
                  AND owner_left_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE) AS delete_due
         FROM vcs
         WHERE type = ? AND is_active = TRUE AND game_plan IS NOT NULL`,
        [GAME_VC.OWNER_ABSENCE_DELETE_MINUTES, GAME_VC.TYPE],
      );
    } finally {
      connection.release();
    }

    for (const row of rows) {
      try {
        await this.reconcileOne(client, row);
      } catch (error) {
        console.error("遊戯VCの部屋主不在チェックに失敗しました。次回再試行します:", String(row.channel_id), error);
      }
    }
  }

  private static async reconcileOne(client: Client, row: GameVcLifecycleRow): Promise<void> {
    const channelId = String(row.channel_id);
    let channel;
    try {
      channel = await client.channels.fetch(channelId);
    } catch (error) {
      if ((error as { code?: number }).code !== RESTJSONErrorCodes.UnknownChannel) throw error;
      await updateVcStatus(channelId, false);
      return;
    }
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await updateVcStatus(channelId, false);
      return;
    }

    const voiceChannel = channel as VoiceChannel;
    const ownerIsPresent = voiceChannel.members.has(String(row.owner_id));
    if (ownerIsPresent) {
      await this.markOwnerPresent(channelId, String(row.owner_id));
      await this.adjustLimitedVcLimit(voiceChannel);
      return;
    }
    if (!Number(row.owner_has_joined)) {
      await this.adjustLimitedVcLimit(voiceChannel);
      return;
    }
    if (!row.owner_left_at) {
      await this.markOwnerAbsent(channelId, String(row.owner_id));
      await this.adjustLimitedVcLimit(voiceChannel);
      return;
    }
    if (!Number(row.delete_due)) {
      await this.adjustLimitedVcLimit(voiceChannel);
      return;
    }

    // 削除直前にもキャッシュを確認し、戻ってきた部屋主のVCを消さない。
    if (voiceChannel.members.has(String(row.owner_id))) {
      await this.markOwnerPresent(channelId, String(row.owner_id));
      return;
    }
    await voiceChannel.delete(`部屋主が${GAME_VC.OWNER_ABSENCE_DELETE_MINUTES}分間不在`);
    await updateVcStatus(channelId, false);
  }

  private static async markOwnerPresent(channelId: string, ownerId: string): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE vcs SET owner_has_joined = TRUE, owner_left_at = NULL
         WHERE channel_id = ? AND owner_id = ? AND type = ? AND is_active = TRUE
           AND game_plan IS NOT NULL`,
        [channelId, ownerId, GAME_VC.TYPE],
      );
    } finally {
      connection.release();
    }
  }

  private static async markOwnerAbsent(channelId: string, ownerId: string): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `UPDATE vcs SET owner_left_at = UTC_TIMESTAMP()
         WHERE channel_id = ? AND owner_id = ? AND type = ? AND is_active = TRUE
           AND game_plan IS NOT NULL AND owner_has_joined = TRUE AND owner_left_at IS NULL`,
        [channelId, ownerId, GAME_VC.TYPE],
      );
    } finally {
      connection.release();
    }
  }
}
