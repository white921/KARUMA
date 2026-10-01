const test = require("node:test");
const assert = require("node:assert/strict");
const { REST } = require("discord.js");
const { registerCommands } = require("../dist/registerCommands.js");
const { exeCommand } = require("../dist/util/interaction/exeCommand.js");

const pausedCommands = ["賭け開始", "賭け終了", "結果", "ボーナス付与"];

test("roulette commands are omitted from the guild registration request", async (t) => {
  for (const name of ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID"]) {
    const previous = process.env[name];
    process.env[name] = "test-disabled-commands";
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }

  const put = t.mock.method(REST.prototype, "put", async (_route, { body }) => {
    const names = body.map((command) => command.name);
    for (const name of pausedCommands) assert.ok(!names.includes(name), name);
    for (const name of ["残高確認", "チケット付与", "口座発行", "0名前チェック"]) {
      assert.ok(names.includes(name), name);
    }
    assert.equal(names.length, 27);
  });

  await registerCommands();
  assert.equal(put.mock.callCount(), 1);
});

test("cached roulette commands are rejected before any handler can run", async (t) => {
  const handlers = ["roulette", "rouletteClose", "result", "rouletteBonus"].map((name) =>
    t.mock.method(require(`../dist/command/casino/${name}.js`), "execute", async () => {
      throw new Error("A paused command reached its handler");
    }),
  );

  for (const command of pausedCommands) {
    await assert.rejects(exeCommand({}, command), {
      message: "このコマンドは現在停止中です。",
    });
  }
  for (const handler of handlers) assert.equal(handler.mock.callCount(), 0);
});
