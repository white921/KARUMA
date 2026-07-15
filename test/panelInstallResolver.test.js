const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolvePanelInstallTarget,
  PANEL_INSTALL_TARGETS,
} = require("../dist/service/panelInstallService.js");
const { TEXT_CHANNEL_IDS, THREAD_IDS } = require("../dist/constant/id.js");

test("resolves bank panel channel to the bank panel target", () => {
  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.GINKOU_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.BANK);
});

test("resolves admin bank panel thread to the admin bank panel target", () => {
  assert.equal(THREAD_IDS.ADMIN_PANEL_THREAD, "1521949472865779916");

  const target = resolvePanelInstallTarget(THREAD_IDS.ADMIN_PANEL_THREAD);
  assert.equal(target, PANEL_INSTALL_TARGETS.ADMIN_BANK);
});

test("resolves shop panel channel to the shop panel target", () => {
  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.SHOP_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.SHOP);
});

test("resolves omikuji panel channel to the omikuji panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.OMIKUJI_PANEL, "1526626039844049037");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.OMIKUJI_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.OMIKUJI);
});

test("resolves game panel channel to the game panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.GAME_PANEL, "1524750761110540348");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.GAME_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.GAME);
});

test("resolves casino panel channel to the casino panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.CASINO_PANEL, "1524750874830831708");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.CASINO_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.CASINO);
});

test("resolves the first roulette panel channel to its stage-specific target", () => {
  assert.equal(TEXT_CHANNEL_IDS.ROULETTE_1ST_PANEL, "1525487297125155047");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.ROULETTE_1ST_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.ROULETTE_1ST);
});

test("resolves unified hotel panel channel to the hotel panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL, "1524065230475362454");
  assert.equal(TEXT_CHANNEL_IDS.SPECIAL_HOTEL_VC_PANEL, "1524065230475362454");

  const target = resolvePanelInstallTarget("1524065230475362454");
  assert.equal(target, PANEL_INSTALL_TARGETS.HOTEL);
});

test("resolves diary panel thread to the diary panel target", () => {
  const target = resolvePanelInstallTarget(THREAD_IDS.DIARY_PANEL_THREAD);
  assert.equal(target, PANEL_INSTALL_TARGETS.DIARY);
});

test("returns null for channels that do not have any panel assigned", () => {
  const target = resolvePanelInstallTarget("999999999999999999");
  assert.equal(target, null);
});
