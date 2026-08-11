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
  formatMarketGachaDrawLog,
} = require("../dist/service/marketGachaService.js");
const { ROLE_IDS, THREAD_IDS } = require("../dist/constant/id.js");
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

test("market gacha uses the configured prize probabilities", () => {
  assert.deepEqual(
    Object.fromEntries(
      MARKET_GACHA_PRIZES.map((prize) => [prize.key, prize.probability]),
    ),
    {
      secret_free_1: 5,
      secret_free_3: 3,
      freedom_free_1: 3,
      cult_chat_free: 9.5,
      custom_role_week: 0.5,
      discount_5: 8,
      discount_10: 3,
      superchat: 20,
      song_cover: 20,
      remote_control: 3,
      game_free_1: 15,
      game_free_3: 5,
      heretic: 5,
    },
  );
});

test("heretic prize label specifies its three-day duration", () => {
  const heretic = MARKET_GACHA_PRIZES.find((prize) => prize.key === "heretic");

  assert.equal(heretic.label, "闇市場通行券3日分");
});

test("market gacha selects prizes at probability boundaries", () => {
  assert.equal(selectMarketGachaPrize(0).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.049999).key, "secret_free_1");
  assert.equal(selectMarketGachaPrize(0.05).key, "secret_free_3");
  assert.equal(selectMarketGachaPrize(0.109999).key, "freedom_free_1");
  assert.equal(selectMarketGachaPrize(0.11).key, "cult_chat_free");
  assert.equal(selectMarketGachaPrize(0.999999).key, "heretic");
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

test("technical director and server owner bypass the market gacha daily limit", () => {
  assert.equal(
    canBypassMarketGachaDailyLimit(memberWithRoles([ROLE_IDS.GIJUTU_LEADER])),
    true,
  );
  assert.equal(
    canBypassMarketGachaDailyLimit(memberWithRoles([ROLE_IDS.SABANUSI])),
    true,
  );
  assert.equal(
    canBypassMarketGachaDailyLimit(memberWithRoles([ROLE_IDS.KANRISYA])),
    false,
  );
});

test("market gacha payment selector offers LIA and invite points", () => {
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

test("remote control prize guides users to mention the founder in the general inquiry ticket", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const prize = MARKET_GACHA_PRIZES.find((item) => item.key === "remote_control");
  const instructions = MarketGachaService.getTicketInstructions(prize);

  assert.match(instructions, /総合お問い合わせ/);
  assert.match(instructions, /市場チケット/);
  assert.match(instructions, /皇帝をメンション/);
  assert.match(instructions, /スクショしてチケット内に送信/);
});

test("heretic prize does not ask users to mention the founder", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const prize = MARKET_GACHA_PRIZES.find((item) => item.key === "heretic");
  const instructions = MarketGachaService.getTicketInstructions(prize);

  assert.match(instructions, /総合お問い合わせ/);
  assert.match(instructions, /市場チケット/);
  assert.doesNotMatch(instructions, /皇帝をメンション/);
  assert.match(instructions, /スクショしてチケット内に送信/);
});

test("game ticket prizes explain the same priority behavior as hotel tickets", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const gameTicket = MARKET_GACHA_PRIZES.find((item) => item.key === "game_free_1");
  const gameTicketThree = MARKET_GACHA_PRIZES.find(
    (item) => item.key === "game_free_3",
  );

  assert.equal(gameTicket.label, "遊戯チケット 1枚");
  assert.equal(gameTicketThree.label, "遊戯チケット 3枚");
  assert.match(
    MarketGachaService.getTicketInstructions(gameTicket),
    /次回遊戯の6時間プランを使用時に、優先的にチケットが消費/,
  );
});

test("hotel ticket prizes use ticket labels and explain priority consumption", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const secretTicket = MARKET_GACHA_PRIZES.find((item) => item.key === "secret_free_1");
  const freedomTicket = MARKET_GACHA_PRIZES.find((item) => item.key === "freedom_free_1");

  assert.equal(secretTicket.label, "シークレット無料チケット 1枚");
  assert.equal(freedomTicket.label, "フリーダム無料チケット 1枚");
  assert.match(
    MarketGachaService.getTicketInstructions(secretTicket),
    /次回シークレットを使用時に、優先的にチケットが消費/,
  );
  assert.match(
    MarketGachaService.getTicketInstructions(freedomTicket),
    /次回フリーダムを使用時に、優先的にチケットが消費/,
  );
});

test("shop discount prize directs users to the market ticket guidance", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const discountTicket = MARKET_GACHA_PRIZES.find((item) => item.key === "discount_5");
  const instructions = MarketGachaService.getTicketInstructions(discountTicket);

  assert.match(instructions, /市場チケットを切り/);
  assert.match(instructions, /割引後の支払額を確認/);
  assert.match(instructions, /市場パネルからその金額を送金/);
  assert.match(instructions, /100万LIA以上の商品には利用できません/);
});

test("audio prize result confirms DM delivery and uses the audio type", () => {
  const { MarketGachaService } = require("../dist/service/marketGachaService.js");
  const superchat = MARKET_GACHA_PRIZES.find((item) => item.key === "superchat");
  const instructions = MarketGachaService.getTicketInstructions(superchat, {
    performerName: "強がり",
    publicUrl: "https://example.com/file",
  });

  assert.match(instructions, /強がり.*サプボです！/);
  assert.match(instructions, /ファイルのURLをDMにて送信/);
  assert.match(instructions, /転載・転送・保存・画面録画等は禁止/);
});

test("market gacha log records the drawer, prize, and payment", () => {
  const prize = MARKET_GACHA_PRIZES.find((item) => item.key === "remote_control");
  const log = formatMarketGachaDrawLog("123", prize, "invite_point");

  assert.equal(THREAD_IDS.MARKET_GACHA_LOG_THREAD, "1536708822725427301");
  assert.match(log, /<@123>/);
  assert.match(log, /皇帝遠隔/);
  assert.match(log, /招待ポイント1pt/);
});
