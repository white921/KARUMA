const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTeleportCategory,
  isTeleportTriggerVc,
  resolveTeleportVcConfig,
} = require("../dist/service/teleportVcService.js");
const { CATEGORY_IDS, VC_IDS } = require("../dist/constant/id.js");

test("game teleport stays disabled until its trigger VC is confirmed", () => {
  assert.equal(VC_IDS.GAME_TELEPORT, "");
  assert.equal(resolveTeleportVcConfig(VC_IDS.GAME_TELEPORT), null);
  assert.equal(isTeleportTriggerVc(VC_IDS.GAME_TELEPORT), false);
});

test("casino teleport stays disabled until its trigger VC is confirmed", () => {
  assert.equal(VC_IDS.CASINO_TELEPORT, "");
  assert.equal(CATEGORY_IDS.CASINO, "1534659438483607743");
  assert.equal(resolveTeleportVcConfig(VC_IDS.CASINO_TELEPORT), null);
  assert.equal(isTeleportTriggerVc(VC_IDS.CASINO_TELEPORT), false);
});

test("does not treat unrelated voice channels as teleport triggers", () => {
  assert.equal(resolveTeleportVcConfig("999999999999999999"), null);
  assert.equal(isTeleportTriggerVc("999999999999999999"), false);
});

test("does not manage game and casino categories before trigger VCs are confirmed", () => {
  assert.equal(isTeleportCategory(CATEGORY_IDS.GAME), false);
  assert.equal(isTeleportCategory(CATEGORY_IDS.CASINO), false);
  assert.equal(isTeleportCategory("999999999999999999"), false);
  assert.equal(isTeleportCategory(null), false);
});
