import type { PoolConnection } from "mysql2/promise";
import { ITEM_KEY } from "../../constant/inventory/item";
import { SHOP_TICKET_TYPE } from "../../constant/market/shopTicket";
import type { ItemKey } from "../../type/inventory/item";
import type { OwnedShopTicket, ShopTicketType } from "../../type/market/shopTicket";
import { ItemService } from "../inventory/itemService";

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
      throw new Error("選択した市場チケットを所持していません。");
    }
  }
}
