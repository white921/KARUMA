const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

test("hazama teleport creates channels in the hazama category", () => {
  assert.equal(VC_IDS.HAZAMA_TELEPORT, "1537468023185743973");
  assert.equal(CATEGORY_IDS.HAZAMA, "1535330490976833627");
  assert.deepEqual(resolveTeleportVcConfig(VC_IDS.HAZAMA_TELEPORT), {
    triggerVcId: VC_IDS.HAZAMA_TELEPORT,
    categoryId: CATEGORY_IDS.HAZAMA,
  });
  assert.equal(isTeleportTriggerVc(VC_IDS.HAZAMA_TELEPORT), true);
  assert.equal(isTeleportCategory(CATEGORY_IDS.HAZAMA), true);
});

test("does not treat unrelated voice channels as teleport triggers", () => {
  assert.equal(resolveTeleportVcConfig("999999999999999999"), null);
  assert.equal(isTeleportTriggerVc("999999999999999999"), false);
});

test("does not manage unconfigured teleport categories", () => {
  assert.equal(isTeleportCategory(CATEGORY_IDS.GAME), false);
  assert.equal(isTeleportCategory(CATEGORY_IDS.CASINO), false);
  assert.equal(isTeleportCategory("999999999999999999"), false);
  assert.equal(isTeleportCategory(null), false);
});

test("VC owners are not required to have an account", () => {
  const createTableSql = fs.readFileSync(
    path.join(__dirname, "../src/sql/createTable.sql"),
    "utf8",
  );
  const migrationSql = fs.readFileSync(
    path.join(__dirname, "../src/sql/20260818_vcs_owner_without_account.sql"),
    "utf8",
  );

  const vcsTableSql = createTableSql.slice(
    createTableSql.indexOf("CREATE TABLE IF NOT EXISTS vcs"),
    createTableSql.indexOf("COMMENT='VC情報';") + "COMMENT='VC情報';".length,
  );

  assert.doesNotMatch(vcsTableSql, /FOREIGN KEY \(owner_id\) REFERENCES accounts\(user_id\)/);
  assert.match(migrationSql, /referenced_table_name = 'accounts'/);
  assert.match(migrationSql, /ALTER TABLE vcs DROP FOREIGN KEY/);
});
