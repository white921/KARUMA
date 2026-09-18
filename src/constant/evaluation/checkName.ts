export const CHECK_NAME_MESSAGES = {
  NO_PERMISSION:
    "❌ 見習い面接官、面接官、面接官統括または技術統括の権限がありません。",
  NOT_IN_VOICE_CHANNEL: "❌ VCに参加している状態で実行してください。",
  NO_TARGET_USERS:
    "❌ このVC内に名前チェック対象の「面接待ち」ユーザーがいません。",
  DUPLICATE_NAME: (memberId: string) =>
    `⚠️ <@${memberId}> と同じ名前です。変更をお願いする場合があります。`,
};
