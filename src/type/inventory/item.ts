import type { RowDataPacket } from "mysql2/promise";
import type { ITEM_KEY } from "../../constant/inventory/item";

export type ItemKey = (typeof ITEM_KEY)[keyof typeof ITEM_KEY];

export type ItemQuantityRow = RowDataPacket & {
  item_key: ItemKey;
  quantity: number;
};

export type ItemInventoryRow = ItemQuantityRow & {
  item_id: number;
};
