const test = require("node:test");
const assert = require("node:assert/strict");
const { ITEM_KEY: K } = require("../dist/constant/inventory/item");
const { ItemService } = require("../dist/service/inventory/itemService");
const { TicketViewService: View } = require("../dist/service/inventory/ticketViewService");
const { AccountService } = require("../dist/service/account/accountService");
const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler");
const { PANEL_COMMAND_NAMES: C } = require("../dist/constant/shared/command");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck");

test("チケット確認は1枚以上だけを表示し、空の見出しも省く", async t => {
  t.mock.method(ItemService, "getQuantities", async () => new Map([
    [K.HOTEL_SECRET_FREE, 1], [K.HOTEL_FREEDOM_FREE, 0], [K.SHOP_DISCOUNT_5, 3],
    [K.SHOP_DISCOUNT_10, 0], [K.GAME_SHORT_FREE, 0], [K.HAZAMA_FREE, 2], [K.SOLITARY_CELL_FREE, 1],
  ]));
  const message = await View.createTicketMessage("user");
  for (const text of ["VIPホテル（12時間）: 1枚", "市場割引 5%OFF: 3枚", "辺境の狭間（12時間）: 2枚", "独房（12時間）: 1枚"]) assert.ok(message.includes(text));
  assert.doesNotMatch(message, /0枚|フリーダム|10%OFF|遊戯チケット/);
});

test("すべてのチケット確認で所持なしを表示する", async t => {
  t.mock.method(ItemService, "getQuantities", async () => new Map());
  for (const method of ["createTicketMessage", "createHotelTicketMessage", "createShopTicketMessage", "createGameTicketMessage"]) {
    const message = await View[method]("user");
    assert.match(message, /所持しているチケットはありません/);
    assert.doesNotMatch(message, /0枚/);
  }
});

test("全パネルの確認ボタンから共通の所持一覧を表示する", async t => {
  t.mock.method(ItemService, "getQuantities", async userId => {
    assert.equal(userId, "user");
    return new Map([[K.HAZAMA_FREE, 1], [K.SOLITARY_CELL_FREE, 3]]);
  });
  t.mock.method(AccountService, "hasAccount", async () => true);
  for (const customId of [C.SHOP_TICKET_VIEW, C.HOTEL_TICKET_VIEW, C.GAME_TICKET_VIEW, C.HAZAMA_TICKET_VIEW, C.SOLITARY_CELL_TICKET_VIEW]) {
    assert.equal(shouldDeferButtonUpdate(customId), false);
    let result;
    await handlePanelButton({customId, user: {id: "user"}, editReply: async payload => { result = payload; }});
    assert.match(result.content, /辺境の狭間（12時間）: 1枚/);
    assert.match(result.content, /独房（12時間）: 3枚/);
  }
});
