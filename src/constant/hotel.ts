import { CURRENCY_NAMES } from "./currency";

export const HOTEL_TYPE = {
  NORMAL: "NORMAL",
  SECRET: "SECRET",
  SECRETLONG: "SECRETLONG",
  FREEDOM: "FREEDOM",
  FREEDOMLONG: "FREEDOMLONG",
};

export const HOTEL_TYPE_NAMES = {
  NORMAL: "通常ホテル",
  SECRET: "VIPホテル (12時間)",
  SECRETLONG: "VIPホテル (24時間)",
  FREEDOM: "フリーダム(12時間)",
  FREEDOMLONG: "フリーダム(24時間)",
};

export const HOTEL_PURCHASE_WAY_TYPE = {
  MONEY: CURRENCY_NAMES,
  TICKET: "チケット",
};

/** 市場ガチャで付与する、12時間ホテル専用の無料券種別 */
export const HOTEL_FREE_TICKET_TYPE = {
  SECRET: "SECRET",
  FREEDOM: "FREEDOM",
} as const;

export type HotelFreeTicketType =
  (typeof HOTEL_FREE_TICKET_TYPE)[keyof typeof HOTEL_FREE_TICKET_TYPE];

export const HOTEL_PRICE = {
  NORMAL: 10000,
  SECRET: 30000,
  SECRETLONG: 50000,
  FREEDOM: 50000,
  FREEDOMLONG: 90000,
};

export const HOTEL_MESSAGES = {
  SELECT_USER: `VIPホテルでお話し`,
  NO_USER_SELECTED: "ユーザーが選択されていません",
  UNDEFINED_TYPE_OF_HOTEL: "無効なホテルVCタイプです",
  DO_NOT_SELECT_MYSELF: "自分を選択することはできません",
  NO_HOTEL_SALE_WAY_SELECTED: "ホテル購入方法が選択されていません",
  DELETE_EXPIRED_VC_FAILED: "期限切れVCの削除に失敗しました",
  CHECK_ALL_BONUS_VCS_FAILED: "無料VCの人数チェックに失敗しました",
  UPDATE_VC_STATUS_FAILED: "VCの状態更新に失敗しました",
  DELETE_EMPTY_BONUS_VC_FAILED: "空になった無料VCの削除に失敗しました",
  CHECK_VC_EMPTY_FAILED: "VCの空チェックに失敗しました",
  HAS_NOT_TICKET: "チケットがありません",
};
