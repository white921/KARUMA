export const ITEM_KEY = {
  HOTEL_SECRET_FREE: "HOTEL_SECRET_FREE",
  HOTEL_FREEDOM_FREE: "HOTEL_FREEDOM_FREE",
  SHOP_DISCOUNT_5: "SHOP_DISCOUNT_5",
  SHOP_DISCOUNT_10: "SHOP_DISCOUNT_10",
  GAME_SHORT_FREE: "GAME_SHORT_FREE",
} as const;

export type ItemKey = (typeof ITEM_KEY)[keyof typeof ITEM_KEY];

export const ITEM_DEFINITIONS: readonly {
  key: ItemKey;
  name: string;
  description: string;
}[] = [
  {
    key: ITEM_KEY.HOTEL_SECRET_FREE,
    name: "VIPホテル無料券",
    description: "VIPホテル（12時間）を無料で利用できる券",
  },
  {
    key: ITEM_KEY.HOTEL_FREEDOM_FREE,
    name: "フリーダム無料券",
    description: "フリーダム（12時間）を無料で利用できる券",
  },
  {
    key: ITEM_KEY.SHOP_DISCOUNT_5,
    name: "市場割引券 5%OFF",
    description: "100万LIA未満の市場支払いに使える5%割引券",
  },
  {
    key: ITEM_KEY.SHOP_DISCOUNT_10,
    name: "市場割引券 10%OFF",
    description: "100万LIA未満の市場支払いに使える10%割引券",
  },
  {
    key: ITEM_KEY.GAME_SHORT_FREE,
    name: "遊戯チケット",
    description: "遊戯VCを1部屋（24時間）無料で作成できる券",
  },
];
