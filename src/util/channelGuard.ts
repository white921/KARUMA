// src/utils/channelGuard.ts
import { ChatInputCommandInteraction } from "discord.js";

/**
 * このコマンドを使ってよいフォーラム（親チャンネル）かを判定。
 * フォーラム内スレッドでも親IDを見て判定します。
 */
export async function requireForum(
  interaction: ChatInputCommandInteraction,
  allowedForumIds: string[],
  opts?: { ephemeral?: boolean }
): Promise<boolean> {
  const ephemeral = opts?.ephemeral ?? true;
  const ch = interaction.channel;

  // チャンネルが存在しない場合もfalse
  if (!ch) {
    return false;
  }

  // フォーラムは基本スレッドで運用されるため、親ID＝フォーラムIDを見る
  const forumId = (ch.isThread() ? ch.parentId : ch.id) ?? null;
  if (!forumId || !allowedForumIds.includes(forumId)) {
    return false;
  }
  return true;
}

/**
 * 実行したいコマンドが実行されたチャンネルで使えるかどうかを判定
 * @param interaction Discordのコマンドインタラクション
 * @param allowedChannelIds 許可するチャンネルIDの配列
 */
export async function requireChannel(
  interaction: ChatInputCommandInteraction,
  allowedChannelIds: string[]
): Promise<boolean> {
  const ch = interaction.channel;
  // チャンネルが存在しない場合もfalse
  if (!ch) {
    return false;
  }
  if (!allowedChannelIds.includes(ch.id)) {
    return false;
  }
  return true;
}
