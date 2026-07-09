const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE_IDS } = require("../dist/constant/id.js");
const { CURRENCY_NAMES } = require("../dist/constant/currency.js");
const { createBankPanelActionRow } = require("../dist/service/panelService.js");
const { createAdminPanelActionRow } = require("../dist/service/adminPanelService.js");
const { createCasinoPanelActionRow } = require("../dist/service/casinoPanel.js");
const { createDiaryPanelActionRow } = require("../dist/service/diaryPanelService.js");
const { createGamePanelActionRows } = require("../dist/service/gamePanelService.js");
const { createHotelVcPanelActionRows } = require("../dist/service/hotelPanelService.js");
const { HotelVcService } = require("../dist/service/hotelVcService.js");
const { createRedeployPanelActionRow } = require("../dist/service/redeployPanelService.js");
const { createShopPanelActionRow } = require("../dist/service/shopPanelService.js");
const { VcPanelService } = require("../dist/service/vcPanelService.js");
const {
  GAME_PANEL_MESSAGES,
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

function assertButtonsHaveNoIcons(rows) {
  const buttons = rows.flatMap((row) => row.toJSON().components);

  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.emoji, undefined);
  }
}

test("shop panel buttons do not use icons", () => {
  const row = createShopPanelActionRow().toJSON();
  const buttons = row.components;

  assert.ok(buttons.length > 0);
  for (const button of buttons) {
    assert.equal(button.emoji, undefined);
  }
});

test("non-bank panel buttons do not use icons", async () => {
  assertButtonsHaveNoIcons([createAdminPanelActionRow()]);
  assertButtonsHaveNoIcons([createCasinoPanelActionRow()]);
  assertButtonsHaveNoIcons([createDiaryPanelActionRow()]);
  assertButtonsHaveNoIcons(createGamePanelActionRows());
  assertButtonsHaveNoIcons([createRedeployPanelActionRow()]);

  const vcPanel = await VcPanelService.createVcPanel(true, true);
  assertButtonsHaveNoIcons(vcPanel.components);
});

test("hotel panel buttons do not use icons", () => {
  assertButtonsHaveNoIcons(createHotelVcPanelActionRows());
});

test("game panel copy uses game instead of gikyou", () => {
  assert.equal(GAME_PANEL_MESSAGES.TITLE, "ゲームパネル");
  assert.equal(GAME_PANEL_MESSAGES.GAME_PASS, "ゲームパス");
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /ゲームパネルです。/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /【ゲーム案内】/);
  assert.match(GAME_PANEL_MESSAGES.DESCRIPTION, /ゲームパス/);
  assert.doesNotMatch(GAME_PANEL_MESSAGES.DESCRIPTION, /戯境/);
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
