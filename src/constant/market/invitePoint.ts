import { ROLE_IDS } from "../shared/id";

export const INVITE_POINT_GACHA_COST = 1;

export const INVITE_POINT_MESSAGES = {
  OPERATOR_ONLY:
    "招待ポイントの追加は、システム管理・皇帝・英傑・市場支配人・商人のみ実行できます。",
  ACCOUNT_NOT_FOUND: "対象ユーザーの口座が見つかりません。先に口座を開設してください。",
  INSUFFICIENT_POINTS: "招待ポイントが不足しています。必要なポイント: 1pt",
};

export const INVITE_POINT_OPERATOR_ROLE_IDS = [
  ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.GINKOU_STAFF,
  ROLE_IDS.SHOP_LEADER,
  ROLE_IDS.SHOP_STAFF,
];
