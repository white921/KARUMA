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
      "🎫 **ショップ割引券**",
      ...SHOP_TICKETS.map(
        (ticket) => `${ticket.label}: ${quantities.get(ticket.type) ?? 0}枚`,
      ),
    ].join("\n");
  }

  static async createGameTicketMessage(userId: string): Promise<string> {
    const quantities = await GameFreeTicketService.getTicketQuantities(userId);
    return [
      "🎫 **遊戯チケット**",
      `6時間プラン: ${quantities[GAME_FREE_TICKET_TYPE.SHORT]}枚`,
    ].join("\n");
  }

  static async viewHotelTickets(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({
      content: await this.createHotelTicketMessage(interaction.user.id),
    });
  }

  static async viewShopTickets(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({
      content: await this.createShopTicketMessage(interaction.user.id),
    });
  }

  static async viewGameTickets(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({
      content: await this.createGameTicketMessage(interaction.user.id),
    });
  }
}
