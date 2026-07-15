const test = require("node:test");
const assert = require("node:assert/strict");

const {
  OMIKUJI_PRIZES,
  selectOmikujiPrize,
} = require("../dist/constant/omikuji.js");
const { getJapanDate } = require("../dist/service/omikujiService.js");
const { TEXT_CHANNEL_IDS } = require("../dist/constant/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { createOmikujiPanelActionRow } = require("../dist/service/omikujiPanelService.js");

test("omikuji probabilities total 100 percent", () => {
  assert.equal(OMIKUJI_PRIZES.reduce((sum, prize) => sum + prize.probability, 0), 100);
});

test("omikuji selects fortunes at probability boundaries", () => {
  assert.equal(selectOmikujiPrize(0).fortune, "小吉");
  assert.equal(selectOmikujiPrize(0.349999).fortune, "小吉");
  assert.equal(selectOmikujiPrize(0.35).fortune, "中吉");
  assert.equal(selectOmikujiPrize(0.949999).fortune, "中吉");
  assert.equal(selectOmikujiPrize(0.95).fortune, "大吉");
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
