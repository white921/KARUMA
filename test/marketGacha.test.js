const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MARKET_GACHA_DAILY_LIMIT,
  MARKET_GACHA_PRICE,
  MARKET_GACHA_PRIZES,
  selectMarketGachaPrize,
} = require("../dist/constant/marketGacha.js");
const {
  canBypassMarketGachaDailyLimit,
  createMarketGachaConfirmationRow,
  createMarketGachaPaymentSelectionRow,
} = require("../dist/service/marketGachaService.js");
const { ROLE_IDS } = require("../dist/constant/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");

function memberWithRoles(roleIds) {
  return {
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

test("market gacha prize probabilities total 100 percent", () => {
  const total = MARKET_GACHA_PRIZES.reduce((sum, prize) => sum + prize.probability, 0);
  assert.equal(total, 100);
});

test("market gacha selects prizes at probability boundaries", () => {
  assert.equal(selectMarketGachaPrize(0).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.099999).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.1).key, "secret_free_3");
  assert.equal(selectMarketGachaPrize(0.999999).key, "remote_control");
});

test("market gacha rejects invalid random values", () => {
  for (const value of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => selectMarketGachaPrize(value));
  }
});

test("market gacha charge and daily limit follow the market specification", () => {
  assert.equal(MARKET_GACHA_PRICE, 5000);
  assert.equal(MARKET_GACHA_DAILY_LIMIT, 5);
});

test("technical director bypasses only the market gacha daily limit", () => {
  assert.equal(
    canBypassMarketGachaDailyLimit(memberWithRoles([ROLE_IDS.GIJUTU_LEADER])),
    true,
  );
  assert.equal(
    canBypassMarketGachaDailyLimit(memberWithRoles([ROLE_IDS.KANRISYA])),
    false,
  );
});

test("market gacha payment selector offers krm and invite points", () => {
  const buttonIds = createMarketGachaPaymentSelectionRow()
    .toJSON()
    .components
    .map((button) => button.custom_id);

  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_CURRENCY));
  assert.ok(buttonIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_INVITE_POINT));
});

test("market gacha confirmation button keeps the selected payment source", () => {
  const currencyIds = createMarketGachaConfirmationRow("currency")
    .toJSON()
    .components
    .map((button) => button.custom_id);
  const invitePointIds = createMarketGachaConfirmationRow("invite_point")
    .toJSON()
    .components
    .map((button) => button.custom_id);

  assert.ok(currencyIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_CURRENCY));
  assert.ok(invitePointIds.includes(PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_INVITE_POINT));
});

test("audio prizes select their files from the matching database category", () => {
  const superchat = MARKET_GACHA_PRIZES.find((prize) => prize.key === "superchat");
  const songCover = MARKET_GACHA_PRIZES.find((prize) => prize.key === "song_cover");

  assert.equal(superchat.audioCategory, "superchat");
  assert.equal(songCover.audioCategory, "song_cover");
});

test("ticket-based prizes guide users to the general inquiry market ticket", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const prize = MARKET_GACHA_PRIZES.find((item) => item.key === "remote_control");
  const instructions = MarketGachaService.getTicketInstructions(prize);

  assert.match(instructions, /総合お問い合わせ/);
  assert.match(instructions, /教団市場チケット/);
  assert.match(
    instructions,
    /https:\/\/discord\.com\/channels\/1520329128883126392\/1520368587255189545/,
  );
});
