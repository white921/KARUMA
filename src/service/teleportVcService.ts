import {
  VoiceChannel,
  ChannelType,
  GuildMember,
  GuildBasedChannel,
} from "discord.js";

import { getVcMembersCount, updateVcStatus } from "../util/vc";

import { VcPanelService } from "./vcPanelService";
import { DbService } from "./dbService";

import { CATEGORY_IDS, VC_IDS } from "../constant/id";
import { TELEPORT_MESSAGE } from "../constant/teleport";
import { TELEPORT_TYPE } from "../constant/vc";

export class TeleportVcService {
  /**
   * 転送先VCを作成
   * @param member VCに入ったメンバー
   */
  static async createTeleportVc(member: GuildMember): Promise<void> {
    try {
      const guild = member.guild;
      if (!guild) {
        throw new Error(TELEPORT_MESSAGE.NOT_SERVER_FOUND);
      }

      // カテゴリーを取得
      const category = await guild.channels.fetch(CATEGORY_IDS.GAME);
      if (!category) {
        throw new Error(TELEPORT_MESSAGE.NOT_CATEGORY_FOUND);
      }

      let parentVc: GuildBasedChannel | null = null;

      try {
        // 親VC（転送用VC）を取得して権限を引き継ぐ
        parentVc = await guild.channels.fetch(VC_IDS.TELEPORT);
        if (!parentVc || parentVc.type !== ChannelType.GuildVoice) {
          throw new Error(TELEPORT_MESSAGE.NOT_TELEPORT_VC_FOUND);
        }
      } catch (error: any) {
        throw new Error(TELEPORT_MESSAGE.NOT_TELEPORT_VC_FOUND);
      }

      // 親VCの権限を取得
      const permissionOverwrites = Array.from(
        (parentVc as VoiceChannel).permissionOverwrites.cache.values(),
      ).map((overwrite) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow,
        deny: overwrite.deny,
      }));

      // VC名を生成（ユーザー名）
      const channelName = `${member.displayName}のVC`;

      // 新しいVCを作成（親VCの権限を引き継ぐ）
      const voiceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: CATEGORY_IDS.GAME,
        permissionOverwrites: permissionOverwrites,
      });

      // VCパネルを送信
      const inChatPanel = await VcPanelService.createVcPanel(false, true);
      if (inChatPanel) {
        await voiceChannel.send({
          embeds: [inChatPanel.embeds[0]],
          components: [inChatPanel.components[0]],
        });
      }

      // メンバーを新しいVCに移動
      await member.voice.setChannel(voiceChannel.id);

      // データベースに転送VC情報を記録
      await this.insertIntoVcs(voiceChannel.id, member.id);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 空になった転送先VCを削除
   * @param channel 削除するVCチャンネル
   */
  static async deleteEmptyTeleportVc(channel: VoiceChannel): Promise<void> {
    try {
      // 転送Botで作成されたVCかどうかを確認
      const isTeleportVc = await this.isTeleportVc(channel.id);
      if (!isTeleportVc) {
        // 転送Botで作成されたVCではない場合は削除しない
        return;
      }

      // Bot以外のメンバー数を確認
      const membersCount = getVcMembersCount(channel);

      // 空になった場合、削除
      if (membersCount === 0) {
        await channel.delete();

        // データベースのis_activeをfalseに更新
        await updateVcStatus(channel.id, false);
      }
    } catch (error: any) {
      throw new Error(TELEPORT_MESSAGE.DELETE_TELEPORT_FAILED);
    }
  }

  /**
   * 転送先VC情報をデータベースに挿入
   * @param voiceChannelId 作成されたVCチャンネルID
   * @param ownerId 作成者のユーザーID
   */
  static async insertIntoVcs(
    voiceChannelId: string,
    ownerId: string,
  ): Promise<void> {
    const connection = await DbService.getConnection();
    try {
      await connection.execute(
        `INSERT INTO vcs (channel_id, owner_id, type, is_ticket, is_bonus, expire_at) VALUES (?, ?, ?, ?, ?, ?);`,
        [
          voiceChannelId,
          ownerId,
          TELEPORT_TYPE.TELEPORT,
          false,
          true, // 転送VCは無料なのでis_bonus=true
          null, // 転送VCは期限なし
        ],
      );
    } catch (error: any) {
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 転送Botで作成されたVCかどうかを確認
   * @param channelId VCチャンネルID
   * @returns 転送Botで作成されたVCの場合true
   */
  static async isTeleportVc(channelId: string): Promise<boolean> {
    const connection = await DbService.getConnection();
    try {
      const [rows] = await connection.execute<any[]>(
        `SELECT channel_id FROM vcs 
         WHERE channel_id = ? AND is_active = TRUE AND type = ?`,
        [channelId, TELEPORT_TYPE.TELEPORT],
      );

      return rows && rows.length > 0;
    } catch (error: any) {
      // エラーが発生した場合は安全のためfalseを返す
      return false;
    } finally {
      connection.release();
    }
  }
}
