const test = require("node:test");
const assert = require("node:assert/strict");

const { createBankPanelActionRow } = require("../dist/service/panelService.js");
const { createShopPanelActionRow } = require("../dist/service/shopPanelService.js");
const {
  HOTEL_VC_PANEL_MESSAGES,
  PANEL_MESSAGES,
} = require("../dist/constant/panel.js");

test("bank panel title uses the cult bank label", () => {
  assert.equal(PANEL_MESSAGES.TITLE, "教団銀行窓口");
});

test("bank panel send button uses a Unicode emoji instead of a custom emoji id", () => {
  const row = createBankPanelActionRow().toJSON();
  const sendButton = row.components[1];

  assert.equal(sendButton.emoji.name, "🪙");
  assert.equal(sendButton.emoji.id, undefined);
});

test("shop panel payment button uses a Unicode emoji instead of a custom emoji id", () => {
  const row = createShopPanelActionRow().toJSON();
  const paymentButton = row.components[0];

  assert.equal(paymentButton.emoji.name, "🪙");
  assert.equal(paymentButton.emoji.id, undefined);
});

test("unified hotel panel description does not repeat shared guidance", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  assert.equal((description.match(/ボタンを押してホテルを選択してください。/g) ?? []).length, 1);
  assert.equal((description.match(/【ホテル案内】/g) ?? []).length, 1);
});

test("unified hotel panel description has no unintended leading spaces", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  const linesWithLeadingSpaces = description
    .split("\n")
    .filter((line) => line.startsWith(" "));

  assert.deepEqual(linesWithLeadingSpaces, []);
});

test("hotel panel free role wording uses apostle instead of engraving", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.equal(typeof description, "string");
  assert.match(description, /使徒ロール所持者/);
  assert.doesNotMatch(description, /刻印/);
});
