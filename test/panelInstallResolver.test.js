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
  assert.equal(THREAD_IDS.ADMIN_PANEL_THREAD, "1536708811899932704");

  const target = resolvePanelInstallTarget(THREAD_IDS.ADMIN_PANEL_THREAD);
  assert.equal(target, PANEL_INSTALL_TARGETS.ADMIN_BANK);
});

test("resolves shop panel channel to the shop panel target", () => {
  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.SHOP_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.SHOP);
});

test("resolves dark market panel channel to the dark market panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.DARK_SHOP_PANEL, "1534638089258143894");
  assert.equal(
    resolvePanelInstallTarget(TEXT_CHANNEL_IDS.DARK_SHOP_PANEL),
    PANEL_INSTALL_TARGETS.DARK_SHOP,
  );
});

test("resolves creator emblem panel channel to the creator emblem panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.CREATOR_EMBLEM_PANEL, "1534650688594771998");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.CREATOR_EMBLEM_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.CREATOR_EMBLEM);
});

test("resolves omikuji panel channel to the omikuji panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.OMIKUJI_PANEL, "1534637681181724682");

  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.OMIKUJI_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.OMIKUJI);
});

test("game panel stays disabled until its target is confirmed", () => {
  assert.equal(TEXT_CHANNEL_IDS.GAME_PANEL, "");
  assert.equal(resolvePanelInstallTarget(TEXT_CHANNEL_IDS.GAME_PANEL), null);
});

test("resolves the hazama payment channel to the hazama panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.HAZAMA_PANEL, "1536053027851739289");
  assert.equal(
    resolvePanelInstallTarget(TEXT_CHANNEL_IDS.HAZAMA_PANEL),
    PANEL_INSTALL_TARGETS.HAZAMA,
  );
});

test("casino panel stays disabled until its target is confirmed", () => {
  assert.equal(TEXT_CHANNEL_IDS.CASINO_PANEL, "");
  assert.equal(resolvePanelInstallTarget(TEXT_CHANNEL_IDS.CASINO_PANEL), null);
});

test("roulette panel stays disabled until its target is confirmed", () => {
  assert.equal(TEXT_CHANNEL_IDS.ROULETTE_1ST_PANEL, "");
  assert.equal(resolvePanelInstallTarget(TEXT_CHANNEL_IDS.ROULETTE_1ST_PANEL), null);
});

test("resolves unified hotel panel channel to the hotel panel target", () => {
  assert.equal(TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL, "1534649600760086658");
  assert.equal(TEXT_CHANNEL_IDS.SPECIAL_HOTEL_VC_PANEL, "1534649600760086658");

  const target = resolvePanelInstallTarget("1534649600760086658");
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
