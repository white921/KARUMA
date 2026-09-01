import { PoolConnection } from "mysql2/promise";

import {
  GAME_FREE_TICKET_TYPE,
  GameFreeTicketType,
} from "../constant/gameTicket";
import { ITEM_KEY, ItemKey } from "../constant/item";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { GAME_MESSAGES } from "../constant/game";
import { ItemService } from "./itemService";

export class GameFreeTicketService {
  static getTicketType(commandId: string): GameFreeTicketType | undefined {
    if (commandId === PANEL_COMMAND_NAMES.GAME_VC_CREATE) {
      return GAME_FREE_TICKET_TYPE.VC_CREATE;
    }
    return undefined;
  }

  static getItemKey(ticketType: GameFreeTicketType): ItemKey {
    if (ticketType === GAME_FREE_TICKET_TYPE.VC_CREATE) {
      return ITEM_KEY.GAME_SHORT_FREE;
    }
    throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);
  }

  static async hasTicket(userId: string, commandId: string): Promise<boolean> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) return false;

    return ItemService.hasItem(userId, this.getItemKey(ticketType));
  }

  static async getTicketQuantities(
    userId: string,
  ): Promise<Record<GameFreeTicketType, number>> {
    const quantities: Record<GameFreeTicketType, number> = {
      [GAME_FREE_TICKET_TYPE.VC_CREATE]: 0,
    };
    const itemKey = this.getItemKey(GAME_FREE_TICKET_TYPE.VC_CREATE);
    quantities[GAME_FREE_TICKET_TYPE.VC_CREATE] =
      (await ItemService.getQuantities(userId, [itemKey])).get(itemKey) ?? 0;
    return quantities;
  }

  /** 付与処理を行うトランザクション内で使用する。 */
  static async grant(
    connection: PoolConnection,
    userId: string,
    ticketType: GameFreeTicketType,
    quantity: number,
  ): Promise<void> {
    await ItemService.grant(
      connection,
      userId,
      this.getItemKey(ticketType),
      quantity,
    );
  }

  /** 確定時に遊戯VC作成券を1枚消費する。 */
  static async consume(userId: string, commandId: string): Promise<void> {
    const ticketType = this.getTicketType(commandId);
    if (!ticketType) throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);

    const consumed = await ItemService.consumeOne(
      userId,
      this.getItemKey(ticketType),
    );
    if (!consumed) {
      throw new Error(GAME_MESSAGES.HAS_NOT_TICKET);
    }
  }
}
