import { ROLE_IDS } from "../shared/id";

export const LINK_ACCOUNT_MESSAGES = {
  NO_PERMISSION: "サブ垢登録を実行する権限がありません。",
  CHANGE_DISPLAY_NAME_FAILED: "表示名の変更に失敗しました。",
  DISPLAY_NAME_TOO_LONG: "表示名が長すぎます。10文字以内にしてください。",
  REGISTER_SUB_ACCOUNT_FAILED: "サブアカウントテーブルへの登録に失敗しました。",
  ACCOUNT_NOT_FOUND: "口座が見つかりません。",
};

export const LINK_ACCOUNT_OPERATOR_ROLE_IDS = [
  ROLE_IDS.SHOP_LEADER,
  ROLE_IDS.SHOP_STAFF,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.GIJUTU_LEADER,
] as const;
