export const INITIAL_WALLET = 30000;
export const MAX_DISPLAY_NAME_LENGTH = 21;
export const SUB_ACCOUNT_SUFFIX_LENGTH = 6;

export const ACCOUNT_MESSAGES = {
  ACCOUNT_EXISTS: "❌ このユーザーは既に口座が開設されています。",
  ACCOUNT_NOT_FOUND: "❌ このユーザーの口座が見つかりません。",
  ACCOUNT_NAME_TOO_LONG: `❌ 名前が長すぎます。15文字以内にしてください。`,
  ACCOUNT_NAME_END_WITH_SUB: "❌ 名前は(sub)で終わることはできません。",
  ACCOUNT_NAME_SAME: "❌ 既に存在する名前は設定できません。",
  ACCOUNT_NAME_SYMBOL:
    "❌ 絵文字、記号、特殊文字は使用できません。文字と数字のみを使用してください。",
  GET_SUB_USER_ID_BY_MAIN_USER_ID_FAILED:
    "❌ サブアカウントユーザーIDの取得に失敗しました。",
  HAS_NO_SUB_ACCOUNT: "❌ サブアカウントが存在しません。",
};
