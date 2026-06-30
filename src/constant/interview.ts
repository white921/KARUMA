export const INTERVIEW_MESSAGES = {
  SUCCESS: (name: string) => `✅ <@${name}>の面接通過処理が完了しました。`,
  NO_SHINMONMATI_ROLE:
    "❌ 対象ユーザーが「審問待ち」ロールを持っていません。",
  NO_TARGET_USERS:
    "❌ このVC内に面接通過処理対象の「審問待ち」ユーザーがいません。",
  NO_PERMISSION: "❌ 研修先導官または先導官の権限がありません。",
  NOT_IN_VOICE_CHANNEL: "❌ VCに参加している状態で実行してください。",
  INVALID_CATEGORY: "❌ このコマンドは指定されたカテゴリ内でのみ実行できます。",
  ERROR_HEADER: "❌ エラー",
  CREATE_EVALUATION_SHEET_ERROR: "❌ 評価シート作成に失敗しました。",
  EVALUATION_SHEET_CONTENT:
    "【適合世界】\n【声】\n【コミュ力】\n【モチベ】\n【ユーモア】\n【サーバー理解度】",
};
