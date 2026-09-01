const test = require("node:test");
const assert = require("node:assert/strict");

const { ITEM_DEFINITIONS, ITEM_KEY } = require("../dist/constant/item.js");
const { HOTEL_FREE_TICKET_TYPE } = require("../dist/constant/hotel.js");
const { SHOP_TICKET_TYPE } = require("../dist/constant/shopTicket.js");
const { GAME_FREE_TICKET_TYPE } = require("../dist/constant/gameTicket.js");
const { HotelFreeTicketService } = require("../dist/service/hotelFreeTicketService.js");
const { ShopTicketService } = require("../dist/service/shopTicketService.js");
const { GameFreeTicketService } = require("../dist/service/gameFreeTicketService.js");

test("all ticket types have registered item definitions", () => {
  assert.deepEqual(
    ITEM_DEFINITIONS.map((item) => item.key),
    [
      ITEM_KEY.HOTEL_SECRET_FREE,
      ITEM_KEY.HOTEL_FREEDOM_FREE,
      ITEM_KEY.SHOP_DISCOUNT_5,
      ITEM_KEY.SHOP_DISCOUNT_10,
      ITEM_KEY.GAME_SHORT_FREE,
    ],
  );
});

test("each ticket service maps to its registered item", () => {
  assert.equal(
    HotelFreeTicketService.getItemKey(HOTEL_FREE_TICKET_TYPE.SECRET),
    ITEM_KEY.HOTEL_SECRET_FREE,
  );
  assert.equal(
    HotelFreeTicketService.getItemKey(HOTEL_FREE_TICKET_TYPE.FREEDOM),
    ITEM_KEY.HOTEL_FREEDOM_FREE,
  );
  assert.equal(
    ShopTicketService.getItemKey(SHOP_TICKET_TYPE.DISCOUNT_5),
    ITEM_KEY.SHOP_DISCOUNT_5,
  );
  assert.equal(
    ShopTicketService.getItemKey(SHOP_TICKET_TYPE.DISCOUNT_10),
    ITEM_KEY.SHOP_DISCOUNT_10,
  );
  assert.equal(
    GameFreeTicketService.getItemKey(GAME_FREE_TICKET_TYPE.VC_CREATE),
    ITEM_KEY.GAME_SHORT_FREE,
  );
});
