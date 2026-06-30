import { VoiceChannel } from "discord.js";

import { DbService } from "../service/dbService";

/**
 * VCのメンバー数をカウント
 * @param voiceChannel VC
 * @returns メンバー数
 */
export function getVcMembersCount(voiceChannel: VoiceChannel): number {
  const members = voiceChannel.members.filter((member) => !member.user.bot);
  return members.size;
}

/**
 * VCの状態を更新
 * @param channelId VCチャンネルID
 * @param isActive 有効状態
 */
export async function updateVcStatus(
  channelId: string,
  isActive: boolean,
): Promise<void> {
  const connection = await DbService.getConnection();
  try {
    await connection.execute(`UPDATE vcs SET is_active = ? WHERE channel_id = ?`, [
      isActive,
      channelId,
    ]);
  } finally {
    connection.release();
  }
}
