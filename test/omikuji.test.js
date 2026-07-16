const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OMIKUJI_PRIZES,
  selectOmikujiPrize,
} = require("../dist/constant/omikuji.js");
const { getJapanDate } = require("../dist/service/omikujiService.js");
const {
  canBypassOmikujiDailyLimit,
  calculateOmikujiWalletAfter,
  createOmikujiSpecialLogEmbed,
  formatOmikujiDrawReply,
} = require("../dist/service/omikujiService.js");
const { TEXT_CHANNEL_IDS } = require("../dist/constant/id.js");
const { ROLE_IDS } = require("../dist/constant/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { createOmikujiPanelActionRow } = require("../dist/service/omikujiPanelService.js");

function memberWithRoles(roleIds) {
  return {
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

test("omikuji probabilities total 100 percent", () => {
  assert.equal(OMIKUJI_PRIZES.reduce((sum, prize) => sum + prize.probability, 0), 100);
});

test("omikuji selects fortunes at probability boundaries", () => {
  assert.equal(selectOmikujiPrize(0).fortune, "小吉");
  assert.equal(selectOmikujiPrize(0.344999).fortune, "小吉");
  assert.equal(selectOmikujiPrize(0.345).fortune, "中吉");
  assert.equal(selectOmikujiPrize(0.934999).fortune, "中吉");
  assert.equal(selectOmikujiPrize(0.935).fortune, "大吉");
  assert.equal(selectOmikujiPrize(0.984999).fortune, "大吉");
  assert.equal(selectOmikujiPrize(0.985).fortune, "凶");
  assert.equal(selectOmikujiPrize(0.994999).fortune, "凶");
  assert.equal(selectOmikujiPrize(0.995).fortune, "超大吉");
});

test("omikuji never makes a wallet balance negative", () => {
  assert.equal(calculateOmikujiWalletAfter(5_000, -3_000), 2_000);
  assert.equal(calculateOmikujiWalletAfter(1_000, -3_000), 0);
  assert.equal(calculateOmikujiWalletAfter(0, -3_000), 0);
});

test("technical director and server owner bypass the omikuji daily limit", () => {
  assert.equal(
    canBypassOmikujiDailyLimit(memberWithRoles([ROLE_IDS.GIJUTU_LEADER])),
    true,
  );
  assert.equal(
    canBypassOmikujiDailyLimit(memberWithRoles([ROLE_IDS.SABANUSI])),
    true,
  );
  assert.equal(
    canBypassOmikujiDailyLimit(memberWithRoles([ROLE_IDS.KANRISYA])),
    false,
  );
});

test("omikuji excuses an insufficient balance on a bad fortune", () => {
  const badFortune = OMIKUJI_PRIZES.find((prize) => prize.fortune === "凶");
  assert.ok(badFortune);
  assert.match(formatOmikujiDrawReply(badFortune, 0, true), /教祖のお告げ/);
  assert.match(formatOmikujiDrawReply(badFortune, 0, true), /0krm/);
  assert.match(formatOmikujiDrawReply(badFortune, 0, true), /許してあげよう/);
});

test("every omikuji result is delivered as the founder's guidance", () => {
  for (const prize of OMIKUJI_PRIZES) {
    const reply = formatOmikujiDrawReply(prize, 10_000, false);
    assert.match(reply, /教祖のお告げ/);
    assert.match(reply, new RegExp(prize.fortune));
  }
});

test("special omikuji log includes the member display name and icon", () => {
  const superFortune = OMIKUJI_PRIZES.find((prize) => prize.fortune === "超大吉");
  assert.ok(superFortune);
  const embed = createOmikujiSpecialLogEmbed(
    "表示名テスト",
    "https://cdn.example.test/avatar.png",
    superFortune,
    50_000,
  ).toJSON();

  assert.equal(TEXT_CHANNEL_IDS.OMIKUJI_SPECIAL_LOG, "1527279894013153381");
  assert.equal(embed.author.name, "表示名テスト");
  assert.equal(embed.author.icon_url, "https://cdn.example.test/avatar.png");
  assert.equal(embed.thumbnail.url, "https://cdn.example.test/avatar.png");
  assert.equal(embed.fields.some((field) => field.name === "残高"), false);
});

test("omikuji rejects invalid random values", () => {
  for (const value of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => selectOmikujiPrize(value));
  }
});

test("omikuji date uses Japan time", () => {
  assert.equal(getJapanDate(new Date("2026-07-15T14:59:59.000Z")), "2026-07-15");
  assert.equal(getJapanDate(new Date("2026-07-15T15:00:00.000Z")), "2026-07-16");
});

test("omikuji panel uses the configured channel and draw button", () => {
  assert.equal(TEXT_CHANNEL_IDS.OMIKUJI_PANEL, "1526626039844049037");
  const row = createOmikujiPanelActionRow().toJSON();
  assert.equal(row.components[0].custom_id, PANEL_COMMAND_NAMES.OMIKUJI_DRAW);
  assert.equal(row.components[0].label, "おみくじを引く");
});
