const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.join(__dirname, "../src/sql/20261001_game_vc_unlimited_plans.sql"),
  "utf8",
);
const createTable = fs.readFileSync(path.join(__dirname, "../src/sql/createTable.sql"), "utf8");

test("新規VCだけを識別し、既存24時間VCを更新しないスキーマを用意する", () => {
  for (const column of ["game_plan", "owner_has_joined", "owner_left_at"]) {
    assert.match(migration, new RegExp(`column_name = '${column}'`));
    assert.match(createTable, new RegExp(column));
  }
  assert.doesNotMatch(migration, /UPDATE\s+vcs\s+SET\s+game_plan/is);
  assert.match(migration, /game_plan=NULL のまま旧24時間仕様/);
});

test("既存遊戯チケットの2倍移行は履歴キーで一度だけ実行する", () => {
  assert.match(createTable, /CREATE TABLE IF NOT EXISTS game_ticket_rollouts/);
  assert.match(migration, /INSERT IGNORE INTO game_ticket_rollouts/);
  assert.match(migration, /20261001_double_inventory/);
  assert.match(migration, /SET item_users\.quantity = item_users\.quantity \* 2/);
  assert.match(migration, /@apply_game_ticket_double = 1/);
  assert.match(migration, /START TRANSACTION;[\s\S]*COMMIT;/);
});
