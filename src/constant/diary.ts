export const DIARY_TYPE = {
  PRIVATE: "diaryPrivate",
  PUBLIC: "diaryPublic",
} as const;

export type DiaryType = (typeof DIARY_TYPE)[keyof typeof DIARY_TYPE];

export const DIARY_TYPE_NAMES: Record<DiaryType, string> = {
  [DIARY_TYPE.PRIVATE]: "通常日記",
  [DIARY_TYPE.PUBLIC]: "VIP日記",
};

export const DIARY_PRICE: Record<DiaryType, number | null> = {
  [DIARY_TYPE.PRIVATE]: 5000,
  [DIARY_TYPE.PUBLIC]: 50000,
};

export const DIARY_MESSAGES = {
  CREATE: "日記作成",
  PRIVATE_CREATE: "通常日記を作成",
  PUBLIC_CREATE: "VIP日記を作成",
  UPDATE: "日記をアップデート",
  INSUFFICIENT_WALLET: "残高が不足しています。",
  TITLE_LABEL: "日記タイトル",
  TITLE_PLACEHOLDER: "日記のタイトルを入力してください",
  BODY_LABEL: "最初の本文",
  BODY_PLACEHOLDER: "最初に投稿したい内容を入力してください（省略可）",
  BODY_DEFAULT: "日記を作成しました。",
  FORUM_NOT_CONFIGURED:
    "日記フォーラムが未設定です。`FORUM_IDS.DIARY` を設定してください。",
  PRICE_NOT_CONFIGURED:
    "日記の価格が未設定です。`DIARY_PRICE` を設定してください。",
  FORUM_INVALID:
    "日記フォーラムが見つからないか、フォーラムチャンネルではありません。",
  CREATE_ERROR: "日記の作成に失敗しました。",
  ALREADY_EXISTS: "あなたの日記はすでに作成済みです。",
  NO_DIARY_TO_UPDATE: "通常日記がまだ作成されていません。",
  ALREADY_PUBLIC: "あなたの日記はすでにVIP日記です。",
  NO_ACTIVE: "あなたの日記は現在クローズされています。\n 再開するには、日記を作成してください。",
  SUB_ACCOUNT_NOT_ALLOWED:
    "サブ垢ロールが付いているユーザーは日記を作成できません。",
  CREATED:
    "{type}を作成しました！\n{thread}",
  REOPENED:
    "クローズされていた日記を再開しました。\nスレッド: {thread}",
  UPGRADED:
    "通常日記をVIP日記へアップグレードしました。\nスレッド: {thread}",
  REOPENED_AND_UPGRADED:
    "クローズされていた日記を再開し、VIP日記へアップグレードしました。\nスレッド: {thread}",
  FREE_CREATE_NOTE: "刻印ロール所持のため無料で作成されました。",
  PRIVATE_TITLE_PREFIX: "🔒 ",
  PRIVATE_PERMISSION_NOTE:
    "注意: Discordのフォーラム仕様上、スレッド単位で本人と紐づくサブアカウントのみに書き込みを完全制限する実装は未対応です。",
  INACTIVE_CLOSE_REASON:
    "本人または紐づくサブアカウントから3日間投稿がなかったためクローズしました。",
};
