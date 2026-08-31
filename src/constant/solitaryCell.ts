export const SOLITARY_CELL = {
  TYPE: "SOLITARY_CELL",
  DURATION_HOURS: 12,
  USER_LIMIT: 1,
  PRICES: {
    VACANT: 0,
    SUMMONED_CRIME: 10000,
    MILITARY_CRIME: 20000,
    CONSCRIPTION_CRIME: 30000,
  },
} as const;

export const SOLITARY_CELL_MESSAGES = {
  TITLE: "独房作成パネル",
  DESCRIPTION:
    "独房を12時間作成できます。\n\n" +
    "空位者：無料\n" +
    "召役罪：10,000LIA\n" +
    "従軍罪：20,000LIA\n" +
    "徴兵罪：30,000LIA\n\n" +
    "残高確認ボタンから現在のLIA残高を確認できます。\n\n" +
    "作成した独房は期限になると削除されます。",
  CREATE: "独房を作成",
  CANCEL: "キャンセル",
  NO_ELIGIBLE_ROLE: "独房を作成できるロールではありません。",
  EXPIRED_NOTICE: "期限になると独房は削除されます。",
} as const;
