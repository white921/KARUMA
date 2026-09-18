import { ROLE_IDS } from "../shared/id";

export const ADMIN_MESSAGES = {
  NO_PERMISSION: "あなたは管理者権限を持っていません。",
  NO_GINKOU_TOHKATSU_PERMISSION: "あなたは銀行統括の権限を持っていません。",
};

export const ADMIN_BANK_PANEL_ROLE_IDS = [
  ROLE_IDS.GINKOU_LEADER,
  ROLE_IDS.GINKOU_STAFF,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.GIJUTU_LEADER,
];
