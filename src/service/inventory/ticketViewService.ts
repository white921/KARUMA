import { ButtonInteraction } from "discord.js";
import { ITEM_KEY } from "../../constant/inventory/item";
import type { ItemKey } from "../../type/inventory/item";
import { ItemService } from "./itemService";

const GROUPS: readonly { title: string; tickets: readonly { key: ItemKey; label: string }[] }[] = [
  { title: "ホテル無料券", tickets: [
    { key: ITEM_KEY.HOTEL_SECRET_FREE, label: "VIPホテル（12時間）" },
    { key: ITEM_KEY.HOTEL_FREEDOM_FREE, label: "フリーダム（12時間）" },
  ] },
  { title: "市場割引券", tickets: [
    { key: ITEM_KEY.SHOP_DISCOUNT_5, label: "市場割引 5%OFF" },
    { key: ITEM_KEY.SHOP_DISCOUNT_10, label: "市場割引 10%OFF" },
  ] },
  { title: "遊戯チケット", tickets: [
    { key: ITEM_KEY.GAME_SHORT_FREE, label: "VC作成（24時間）" },
  ] },
  { title: "狭間・独房無料券", tickets: [
    { key: ITEM_KEY.HAZAMA_FREE, label: "辺境の狭間（12時間）" },
    { key: ITEM_KEY.SOLITARY_CELL_FREE, label: "独房（12時間）" },
  ] },
];

export class TicketViewService {
  private static async createMessage(userId: string, groups = GROUPS, title = "所持チケット一覧"): Promise<string> {
    const quantities = await ItemService.getQuantities(userId, groups.flatMap(group => group.tickets.map(ticket => ticket.key)));
    const sections = groups.flatMap(group => {
      const tickets = group.tickets.filter(ticket => (quantities.get(ticket.key) ?? 0) >= 1);
      return tickets.length ? [`**${group.title}**\n${tickets.map(ticket => `${ticket.label}: ${quantities.get(ticket.key)}枚`).join("\n")}`] : [];
    });
    return [`🎫 **${title}**`, ...(sections.length ? sections : ["所持しているチケットはありません。"])].join("\n\n");
  }

  /** パネルの種類に関係なく、1枚以上所持している全チケットを表示する。 */
  static async createTicketMessage(userId: string): Promise<string> {
    return this.createMessage(userId);
  }

  static async createHotelTicketMessage(userId: string): Promise<string> {
    return this.createMessage(userId, [GROUPS[0]], "ホテル無料券");
  }

  static async createShopTicketMessage(userId: string): Promise<string> {
    return this.createMessage(userId, [GROUPS[1]], "市場割引券");
  }

  static async createGameTicketMessage(userId: string): Promise<string> {
    return this.createMessage(userId, [GROUPS[2]], "遊戯チケット");
  }

  static async viewHotelTickets(interaction: ButtonInteraction): Promise<void> { await this.viewTickets(interaction); }
  static async viewShopTickets(interaction: ButtonInteraction): Promise<void> { await this.viewTickets(interaction); }
  static async viewGameTickets(interaction: ButtonInteraction): Promise<void> { await this.viewTickets(interaction); }

  static async viewTickets(interaction: ButtonInteraction): Promise<void> {
    await interaction.editReply({ content: await this.createTicketMessage(interaction.user.id) });
  }
}
