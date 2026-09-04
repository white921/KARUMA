import { ButtonInteraction } from "discord.js";

import {
  HOTEL_FREE_TICKET_TYPE,
} from "../constant/hotel";
import { GAME_FREE_TICKET_TYPE } from "../constant/gameTicket";
import { SHOP_TICKETS } from "../constant/shopTicket";
import { HotelFreeTicketService } from "./hotelFreeTicketService";
import { GameFreeTicketService } from "./gameFreeTicketService";
import { ShopTicketService } from "./shopTicketService";

export class TicketViewService {
  /** パネルの種類に関係なく、所持している全チケットを表示する。 */
  static async createTicketMessage(userId: string): Promise<string> {
    const [hotelQuantities, ownedShopTickets, gameQuantities] =
      await Promise.all([
        HotelFreeTicketService.getTicketQuantities(userId),
        ShopTicketService.getOwnedTickets(userId),
        GameFreeTicketService.getTicketQuantities(userId),
      ]);
    const shopQuantities = new Map(
      ownedShopTickets.map((ticket) => [ticket.type, ticket.quantity]),
    );

    return [
      "🎫 **所持チケット一覧**",
      "",
      "**ホテル無料券**",
      `VIPホテル（12時間）: ${hotelQuantities[HOTEL_FREE_TICKET_TYPE.SECRET]}枚`,
      `フリーダム（12時間）: ${hotelQuantities[HOTEL_FREE_TICKET_TYPE.FREEDOM]}枚`,
      "",
      "**市場割引券**",
      ...SHOP_TICKETS.map(
        (ticket) => `${ticket.label}: ${shopQuantities.get(ticket.type) ?? 0}枚`,
      ),
      "",
      "**遊戯チケット**",
      `VC作成（24時間）: ${gameQuantities[GAME_FREE_TICKET_TYPE.VC_CREATE]}枚`,
    ].join("\n");
  }

  static async createHotelTicketMessage(userId: string): Promise<string> {
    const quantities = await HotelFreeTicketService.getTicketQuantities(userId);
    return [
      "🎫 **ホテル無料券**",
      `VIPホテル（12時間）: ${quantities[HOTEL_FREE_TICKET_TYPE.SECRET]}枚`,
      `フリーダム（12時間）: ${quantities[HOTEL_FREE_TICKET_TYPE.FREEDOM]}枚`,
    ].join("\n");
  }

  static async createShopTicketMessage(userId: string): Promise<string> {
    const ownedTickets = await ShopTicketService.getOwnedTickets(userId);
    const quantities = new Map(
      ownedTickets.map((ticket) => [ticket.type, ticket.quantity]),
    );
    return [
      "🎫 **市場割引券**",
      ...SHOP_TICKETS.map(
        (ticket) => `${ticket.label}: ${quantities.get(ticket.type) ?? 0}枚`,
      ),
    ].join("\n");
  }

  static async createGameTicketMessage(userId: string): Promise<string> {
    const quantities = await GameFreeTicketService.getTicketQuantities(userId);
    return [
      "🎫 **遊戯チケット**",
      `VC作成（24時間）: ${quantities[GAME_FREE_TICKET_TYPE.VC_CREATE]}枚`,
    ].join("\n");
  }

  static async viewHotelTickets(interaction: ButtonInteraction): Promise<void> {
    await this.viewTickets(interaction);
  }

  static async viewShopTickets(interaction: ButtonInteraction): Promise<void> {
    await this.viewTickets(interaction);
  }

  static async viewGameTickets(interaction: ButtonInteraction): Promise<void> {
    await this.viewTickets(interaction);
  }

  static async viewTickets(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({
      content: await this.createTicketMessage(interaction.user.id),
    });
  }
}
