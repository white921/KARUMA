const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE_IDS } = require("../dist/constant/id.js");
const { CURRENCY_NAMES } = require("../dist/constant/currency.js");
const { createBankPanelActionRow } = require("../dist/service/panelService.js");
const { createHotelVcPanelActionRows } = require("../dist/service/hotelPanelService.js");
const { HotelVcService } = require("../dist/service/hotelVcService.js");
const { createShopPanelActionRow } = require("../dist/service/shopPanelService.js");
const {
  HOTEL_VC_PANEL_MESSAGES,
  PANEL_MESSAGES,
} = require("../dist/constant/panel.js");

function memberWithRoles(roleIds) {
  return {
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

test("bank panel title uses the cult bank label", () => {
  assert.equal(PANEL_MESSAGES.TITLE, "教団銀行窓口");
});

test("bank panel send button uses a Unicode emoji instead of a custom emoji id", () => {
  const row = createBankPanelActionRow().toJSON();
  const sendButton = row.components[1];

  assert.equal(sendButton.label, `${CURRENCY_NAMES}送金`);
  assert.equal(sendButton.emoji.name, "🪙");
  assert.equal(sendButton.emoji.id, undefined);
});

test("shop panel payment button uses a Unicode emoji instead of a custom emoji id", () => {
  const row = createShopPanelActionRow().toJSON();
  const paymentButton = row.components[0];

  assert.equal(paymentButton.label, `${CURRENCY_NAMES}支払い`);
  assert.equal(paymentButton.emoji.name, "🪙");
  assert.equal(paymentButton.emoji.id, undefined);
});

test("hotel panel buttons do not use icons", () => {
  const rows = createHotelVcPanelActionRows().map((row) => row.toJSON());
  const buttons = rows.flatMap((row) => row.components);

  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.emoji, undefined);
  }
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
  assert.match(description, /使徒・教団員ロール所持者/);
  assert.doesNotMatch(description, /刻印/);
});

test("hotel panel duration labels match minute-based expiration", () => {
  const description = HOTEL_VC_PANEL_MESSAGES.DESCRIPTION;

  assert.match(description, /30000krm\/1分/);
  assert.match(description, /50000krm\/2分/);
  assert.match(description, /50000krm\/1分/);
  assert.match(description, /90000krm\/2分/);
  assert.doesNotMatch(description, /12h|24h|12時間|24時間/);
});

test("normal hotel is free for apostle and cult member roles", async () => {
  assert.equal(
    await HotelVcService.isNormalHotelBonusMember(
      memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.HONMEN]),
    ),
    true,
  );
  assert.equal(
    await HotelVcService.isNormalHotelBonusMember(
      memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN]),
    ),
    true,
  );
  assert.equal(await HotelVcService.isNormalHotelBonusMember(memberWithRoles([])), false);
});
