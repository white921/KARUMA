import {
  StringSelectMenuInteraction,
  VoiceChannel,
  ModalSubmitInteraction,
  ButtonInteraction,
} from "discord.js";

import { DbService } from "./dbService";

import { VC_MESSAGES } from "../constant/vc";
import { HOTEL_TYPE } from "../constant/hotel";

export class VcService {
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
    try {
      await (interaction.channel as VoiceChannel).setName(newName);
      await interaction.reply({
        content: `VC名を${newName}に変更しました。`,
        ephemeral: true,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * VCメンバーのバリデーション
   * @param interaction ButtonInteraction
   */
  static async validateVcMember(interaction: ButtonInteraction) {
    try {
      const guild = interaction.guild;
      if (!guild) return;
      const member = await guild.members.fetch(interaction.user.id);
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
