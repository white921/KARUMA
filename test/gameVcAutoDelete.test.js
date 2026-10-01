const test = require("node:test");
const assert = require("node:assert/strict");

const { GameVcService } = require("../dist/service/game/gameVcService.js");
const { DbService } = require("../dist/service/system/dbService.js");

test("歓楽師・ゲームパスの無料作成だけを空室削除対象として保存する", async t => {
  let activeStatements = [];
  t.mock.method(DbService, "getConnection", async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    execute: async (sql, params) => {
      activeStatements.push({ sql, params });
      if (sql.includes("FOR UPDATE")) return [[{ wallet: 20000 }]];
      if (sql.startsWith("SELECT wallet")) return [[{ wallet: 0 }]];
      return [{}];
    },
  }));

  async function record(payment) {
    activeStatements = [];
    await GameVcService.recordVcCreation(
      "1001",
      `vc-${payment}`,
      { label: "旅人以上", price: 5000 },
      payment,
      new Date("2026-10-01T12:00:00Z"),
    );
    return activeStatements;
  }

  for (const [payment, bonus] of [["money", false], ["ticket", false], ["pass", true], ["staff", true]]) {
    const statements = await record(payment);
    const vcInsert = statements.find(entry => entry.sql.includes("INSERT INTO vcs"));
    assert.equal(vcInsert.params[4], bonus, payment);
  }
});
