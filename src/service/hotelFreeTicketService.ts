import { PoolConnection } from "mysql2/promise";

import {
  HOTEL_FREE_TICKET_TYPE,
  HOTEL_MESSAGES,
  HotelFreeTicketType,
} from "../constant/hotel";
import { ITEM_KEY, ItemKey } from "../constant/item";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ItemService } from "./itemService";

export class HotelFreeTicketService {
  static getTicketType(commandId: string): HotelFreeTicketType | undefined {
    if (commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRET) {
      return HOTEL_FREE_TICKET_TYPE.SECRET;
    }
    if (commandId === PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM) {
      return HOTEL_FREE_TICKET_TYPE.FREEDOM;
    }
    return undefined;
  }

  static getItemKey(ticketType: HotelFreeTicketType): ItemKey {
    return ticketType === HOTEL_FREE_TICKET_TYPE.SECRET
      ? ITEM_KEY.HOTEL_SECRET_FREE
      : ITEM_KEY.HOTEL_FREEDOM_FREE;
  }

  static async hasTicket(userId: string, commandId: string): Promise<boolean> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) return false;
    return ItemService.hasItem(userId, this.getItemKey(ticketType));
  }

  static async getTicketQuantities(
    userId: string,
  ): Promise<Record<HotelFreeTicketType, number>> {
    const quantities: Record<HotelFreeTicketType, number> = {
      [HOTEL_FREE_TICKET_TYPE.SECRET]: 0,
      [HOTEL_FREE_TICKET_TYPE.FREEDOM]: 0,
    };
    const itemKeys = [
      this.getItemKey(HOTEL_FREE_TICKET_TYPE.SECRET),
      this.getItemKey(HOTEL_FREE_TICKET_TYPE.FREEDOM),
    ] as const;
    const quantitiesByItem = await ItemService.getQuantities(userId, itemKeys);
    quantities[HOTEL_FREE_TICKET_TYPE.SECRET] =
      quantitiesByItem.get(itemKeys[0]) ?? 0;
    quantities[HOTEL_FREE_TICKET_TYPE.FREEDOM] =
      quantitiesByItem.get(itemKeys[1]) ?? 0;
    return quantities;
  }

  /** 市場ガチャのトランザクション中で無料券を付与する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: HotelFreeTicketType,
    quantity: number,
  ): Promise<void> {
    await ItemService.grant(
      connection,
      userId,
      this.getItemKey(ticketType),
      quantity,
    );
  }

  /** 使用直前に1枚だけ消費する。 */
  static async consume(userId: string, commandId: string): Promise<void> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);

    const consumed = await ItemService.consumeOne(
      userId,
      this.getItemKey(ticketType),
    );
    if (!consumed) {
      throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);
    }
  }
}
