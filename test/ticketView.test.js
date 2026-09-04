const test = require("node:test");
const assert = require("node:assert/strict");

const { HOTEL_FREE_TICKET_TYPE } = require("../dist/constant/hotel.js");
const { GAME_FREE_TICKET_TYPE } = require("../dist/constant/gameTicket.js");
const { SHOP_TICKET_TYPE } = require("../dist/constant/shopTicket.js");
const { HotelFreeTicketService } = require("../dist/service/hotelFreeTicketService.js");
const { ShopTicketService } = require("../dist/service/shopTicketService.js");
const { GameFreeTicketService } = require("../dist/service/gameFreeTicketService.js");
const { TicketViewService } = require("../dist/service/ticketViewService.js");

test("ticket confirmation lists every owned ticket type", async () => {
  const originalHotel = HotelFreeTicketService.getTicketQuantities;
  const originalShop = ShopTicketService.getOwnedTickets;
  const originalGame = GameFreeTicketService.getTicketQuantities;
  HotelFreeTicketService.getTicketQuantities = async () => ({
    [HOTEL_FREE_TICKET_TYPE.SECRET]: 1,
    [HOTEL_FREE_TICKET_TYPE.FREEDOM]: 2,
  });
  ShopTicketService.getOwnedTickets = async () => [
    { type: SHOP_TICKET_TYPE.DISCOUNT_5, quantity: 3 },
  ];
  GameFreeTicketService.getTicketQuantities = async () => ({
    [GAME_FREE_TICKET_TYPE.VC_CREATE]: 4,
  });

  try {
    const message = await TicketViewService.createTicketMessage("user-id");

    assert.match(message, /VIPホテル（12時間）: 1枚/);
    assert.match(message, /フリーダム（12時間）: 2枚/);
    assert.match(message, /市場割引 5%OFF: 3枚/);
    assert.match(message, /市場割引 10%OFF: 0枚/);
    assert.match(message, /VC作成（24時間）: 4枚/);
  } finally {
    HotelFreeTicketService.getTicketQuantities = originalHotel;
    ShopTicketService.getOwnedTickets = originalShop;
    GameFreeTicketService.getTicketQuantities = originalGame;
  }
});
