const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTeleportCategory,
  isTeleportTriggerVc,
  resolveTeleportVcConfig,
} = require("../dist/service/teleportVcService.js");
const { CATEGORY_IDS, VC_IDS } = require("../dist/constant/id.js");

test("resolves game teleport VC to the entertainment category", () => {
  assert.equal(VC_IDS.GAME_TELEPORT, "1524377204807438508");

  const config = resolveTeleportVcConfig(VC_IDS.GAME_TELEPORT);

  assert.deepEqual(config, {
    triggerVcId: VC_IDS.GAME_TELEPORT,
    categoryId: CATEGORY_IDS.GAME,
  });
  assert.equal(isTeleportTriggerVc(VC_IDS.GAME_TELEPORT), true);
});

test("resolves casino teleport VC to the casino category", () => {
  assert.equal(VC_IDS.CASINO_TELEPORT, "1524377237497843732");
  assert.equal(CATEGORY_IDS.CASINO, "1524430081416495234");

  const config = resolveTeleportVcConfig(VC_IDS.CASINO_TELEPORT);

  assert.deepEqual(config, {
    triggerVcId: VC_IDS.CASINO_TELEPORT,
    categoryId: CATEGORY_IDS.CASINO,
  });
  assert.equal(isTeleportTriggerVc(VC_IDS.CASINO_TELEPORT), true);
});

test("does not treat unrelated voice channels as teleport triggers", () => {
  assert.equal(resolveTeleportVcConfig("999999999999999999"), null);
  assert.equal(isTeleportTriggerVc("999999999999999999"), false);
});

test("treats game and casino categories as teleport-managed categories", () => {
  assert.equal(isTeleportCategory(CATEGORY_IDS.GAME), true);
  assert.equal(isTeleportCategory(CATEGORY_IDS.CASINO), true);
  assert.equal(isTeleportCategory("999999999999999999"), false);
  assert.equal(isTeleportCategory(null), false);
});
