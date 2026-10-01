import { PermissionsBitField } from "discord.js";
import { ROLE_IDS } from "../shared/id";

export const GAME_PRICE = {
  SHORT: 5000,
  LONG: 10000,
  PASS: 100000,
};

export const GAME_VC = {
  TYPE: "GAME",
  LEGACY_DURATION_HOURS: 24,
  OWNER_ABSENCE_DELETE_MINUTES: 10,
  LIMITED_HUMAN_LIMIT: 6,
  PLANS: {
    LIMITED: "limited",
    UNLIMITED: "unlimited",
  },
  PRICES: {
    REGULAR: {
      limited: 3000,
      unlimited: 5000,
    },
    VACANT: {
      limited: 4000,
      unlimited: 6000,
    },
    CRIMINAL: {
      limited: 6000,
      unlimited: 10000,
    },
  },
  TICKET_COSTS: {
    REGULAR: {
      limited: 1,
      unlimited: 2,
    },
    VACANT: {
      limited: 1,
      unlimited: 2,
    },
    CRIMINAL: {
      limited: 2,
      unlimited: 4,
    },
  },
  PASS_PRICES: {
    TWO_WEEKS: 50000,
    ONE_MONTH: 100000,
  },
  CRIMINAL_ACCESS_PRICE: 5000,
  CRIMINAL_ACCESS_DURATION_HOURS: 24,
} as const;

export const GAME_MESSAGES = {
  NO_PERMISSION: "あなたは遊戯師の権限を持っていません。",
  GAME_SHORT: "6時間プラン",
  GAME_LONG: "12時間プラン",
  GAME_PASS: "ゲームパス",
  NOT_ENOUGH_BALANCE: "残高が不足しています。",
  INVALID_GAME_TYPE: "無効な遊戯タイプです。",
  CREATE_CONDITIONS_CHANGED: "ロール・料金・チケット枚数が変更されました。遊戯パネルから選び直してください。",
  INVALID_ROLE: "無効なロールです。",
  ALREADY_HAS_ROLE: "既にロールが付与されています。",
  INVALID_EXPIRE_AT: "有効期限が無効です。",
  HAS_NOT_TICKET: "遊戯チケットがありません。",
  NO_ELIGIBLE_ROLE: "遊戯VCを作成できるロールではありません。",
  PASS_PURCHASE_REQUIRES_TRAVELER: "ゲームパスを購入できるロールではありません。",
  PASS_ALREADY_ACTIVE: "ゲームパスをすでに所持しているため、購入できません。",
  CRIMINAL_PANEL_ONLY: "罪人は罪人用の遊戯パネルをご利用ください。",
  CRIMINAL_ROLE_REQUIRED: "罪人用の遊戯パネルです。",
  CRIMINAL_ACCESS_ALREADY_ACTIVE: "遊戯VC接続権限はすでに有効です。",
};

export const TRAVELER_OR_ABOVE_ROLE_IDS = [
  ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN,
  ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
];

export const VC_CONNECT_ROLE_IDS = [
  ...TRAVELER_OR_ABOVE_ROLE_IDS,
];

export const GAME_VC_MESSAGE_PERMISSIONS = [
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.SendVoiceMessages,
  PermissionsBitField.Flags.UseEmbeddedActivities,
];

export const GAME_VC_CONNECT_PERMISSIONS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.Connect,
  PermissionsBitField.Flags.Speak,
  PermissionsBitField.Flags.UseVAD,
  PermissionsBitField.Flags.Stream,
  ...GAME_VC_MESSAGE_PERMISSIONS,
];
