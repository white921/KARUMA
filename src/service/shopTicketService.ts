import { PoolConnection } from "mysql2/promise";

import { SHOP_TICKET_TYPE, ShopTicketType } from "../constant/shopTicket";
import { ITEM_KEY, ItemKey } from "../constant/item";
import { ItemService } from "./itemService";

export type OwnedShopTicket = {
  type: ShopTicketType;
  quantity: number;
};

export class ShopTicketService {
  static getItemKey(ticketType: ShopTicketType): ItemKey {
    return ticketType === SHOP_TICKET_TYPE.DISCOUNT_5
      ? ITEM_KEY.SHOP_DISCOUNT_5
      : ITEM_KEY.SHOP_DISCOUNT_10;
  }

  /** 市場ガチャのトランザクション中でショップチケットを付与する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: ShopTicketType,
    quantity = 1,
  ): Promise<void> {
    await ItemService.grant(
      connection,
      userId,
      this.getItemKey(ticketType),
      quantity,
    );
  }

  static async getOwnedTickets(userId: string): Promise<OwnedShopTicket[]> {
    const itemKeys = [
      this.getItemKey(SHOP_TICKET_TYPE.DISCOUNT_5),
      this.getItemKey(SHOP_TICKET_TYPE.DISCOUNT_10),
    ] as const;
    const quantities = await ItemService.getQuantities(userId, itemKeys);
    return [
      {
        type: SHOP_TICKET_TYPE.DISCOUNT_5,
        quantity: quantities.get(itemKeys[0]) ?? 0,
      },
      {
        type: SHOP_TICKET_TYPE.DISCOUNT_10,
        quantity: quantities.get(itemKeys[1]) ?? 0,
      },
    ].filter((ticket) => ticket.quantity > 0);
  }

  /** 呼び出し元のトランザクション中で1枚だけ消費する。 */
  static async consume(
    connection: PoolConnection,
    userId: string,
    ticketType: ShopTicketType,
  ): Promise<void> {
    const consumed = await ItemService.consume(
      connection,
      userId,
      this.getItemKey(ticketType),
    );
    if (!consumed) {
      throw new Error("選択したショップチケットを所持していません。");
    }
  }
}
