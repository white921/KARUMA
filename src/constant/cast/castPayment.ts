import { THREAD_IDS } from "../shared/id";
export const CAST_PAYMENT_PREFIX = "castPayment";
export const CAST_PAYMENT_TITLE = "執事・メイド ご利用パネル";
export const CAST_SESSION_TTL_MS = 30 * 60 * 1000;
export const CAST_PAGE_SIZE = 25;
export const CAST_MAX_SELECTION = 100;
export const CAST_TIME_STEP_HOURS = 0.5;
export const CAST_MAX_AMOUNT = 2_147_483_647;
export const CAST_MENUS = {
  twoshot: { label: "ツーショ", ratePerHalfHour: 10_000, threadId: THREAD_IDS.CAST_BASIC_LOG },
  free: { label: "フリー", ratePerHalfHour: 5_000, threadId: THREAD_IDS.CAST_BASIC_LOG },
  group: { label: "団体指名", ratePerHalfHour: 25_000, threadId: THREAD_IDS.CAST_BASIC_LOG },
  maid: { label: "お給仕メイド", ratePerHalfHour: 0, threadId: THREAD_IDS.CAST_MAID_LOG },
  butler: { label: "お仕え執事", ratePerHalfHour: 0, threadId: THREAD_IDS.CAST_BUTLER_LOG },
} as const;
