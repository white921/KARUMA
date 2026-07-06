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

test("resolves shop panel channel to the shop panel target", () => {
  const target = resolvePanelInstallTarget(TEXT_CHANNEL_IDS.SHOP_PANEL);
  assert.equal(target, PANEL_INSTALL_TARGETS.SHOP);
});

test("resolves diary panel thread to the diary panel target", () => {
  const target = resolvePanelInstallTarget(THREAD_IDS.DIARY_PANEL_THREAD);
  assert.equal(target, PANEL_INSTALL_TARGETS.DIARY);
});

test("returns null for channels that do not have any panel assigned", () => {
  const target = resolvePanelInstallTarget("999999999999999999");
  assert.equal(target, null);
});
