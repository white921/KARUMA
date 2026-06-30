import { HOTEL_TYPE } from "./hotel";

export const TELEPORT_TYPE = {
  TELEPORT: "TELEPORT",
};

export const VC_ALL_TYPES = {
  ...HOTEL_TYPE,
  ...TELEPORT_TYPE,
};

export const VC_MESSAGES = {
  ERROR: "VCチャンネルが見つからないか、無効な型です。",
  DONT_OPERATE_FROM_OUTSIDE_VC: "VCにいる方のみ操作可能です",
  CHANGE_VC_NAME: "VC名変更",
  NO_NEW_NAME_INPUT: "新しいVC名が入力されていません。",
  DO_NOT_UPDATE_VC_LIMIT_TO_INFINITY:
    "このVCの人数制限は無制限に変更できません。",
};
