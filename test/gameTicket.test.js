const test = require("node:test");
const assert = require("node:assert/strict");

const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { GAME_FREE_TICKET_TYPE } = require("../dist/constant/gameTicket.js");
const { GameFreeTicketService } = require("../dist/service/gameFreeTicketService.js");
const { createGamePanelActionRows } = require("../dist/service/gamePanelService.js");
const { GAME_PANEL_MESSAGES } = require("../dist/constant/panel.js");

test("game ticket is available for creating an individual VC", () => {
  assert.equal(
    GameFreeTicketService.getTicketType(PANEL_COMMAND_NAMES.GAME_VC_CREATE),
    GAME_FREE_TICKET_TYPE.VC_CREATE,
  );
  assert.equal(
    GameFreeTicketService.getTicketType(PANEL_COMMAND_NAMES.GAME_LONG),
    undefined,
  );
});

test("game panel provides VC creation, game passes, and ticket confirmation", () => {
  const buttonIds = createGamePanelActionRows()
    .flatMap((row) => row.toJSON().components)
    .map((button) => button.custom_id);

  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.GAME_TICKET_VIEW));
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.GAME_VC_CREATE));
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS));
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH));
  assert.equal(GAME_PANEL_MESSAGES.TICKET_VIEW, "チケット確認");
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /所持している全種類のチケット/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /遊戯チケットを所持している場合/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /24時間/);
});
