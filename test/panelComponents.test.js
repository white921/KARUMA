const test = require("node:test");
const assert = require("node:assert/strict");

const { createBankPanelActionRow } = require("../dist/service/panelService.js");
const { createShopPanelActionRow } = require("../dist/service/shopPanelService.js");

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
