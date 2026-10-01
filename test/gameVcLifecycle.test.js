const test = require("node:test");
const assert = require("node:assert/strict");
const { ChannelType, Collection } = require("discord.js");

const { GameVcLifecycleService } = require("../dist/service/game/gameVcLifecycleService.js");
const { DbService } = require("../dist/service/system/dbService.js");

function connection(execute) {
  return { execute, release() {} };
}

test("作成時には始動せず、部屋主の初回入室後の退出だけを記録する", async t => {
  const statements = [];
  t.mock.method(DbService, "getConnection", async () => connection(async (sql, params) => {
    statements.push({ sql, params });
    return [{ affectedRows: 1 }];
  }));
  const member = { id: "owner", user: { bot: false } };

  await GameVcLifecycleService.handleVoiceStateUpdate(
    { member, channelId: null },
    { member, channelId: "vc" },
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /owner_has_joined = TRUE, owner_left_at = NULL/);

  statements.length = 0;
  await GameVcLifecycleService.handleVoiceStateUpdate(
    { member, channelId: "vc" },
    { member, channelId: null },
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /owner_has_joined = TRUE AND owner_left_at IS NULL/);
  assert.match(statements[0].sql, /owner_left_at = UTC_TIMESTAMP/);
});

function lifecycleFixture(t, row, ownerPresent = false) {
  const statements = [];
  t.mock.method(DbService, "getConnection", async () => connection(async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes("SELECT channel_id, owner_id")) return [[row]];
    return [{ affectedRows: 1 }];
  }));
  t.mock.method(GameVcLifecycleService, "adjustLimitedVcLimit", async () => false);
  const deleted = [];
  const members = new Map(ownerPresent ? [["owner", { id: "owner" }]] : []);
  const channel = {
    id: "vc",
    type: ChannelType.GuildVoice,
    members,
    async delete(reason) { deleted.push(reason); },
  };
  const client = { channels: { fetch: async () => channel } };
  return { statements, deleted, client };
}

test("部屋主が一度も入っていない新規VCでは定期確認でもタイマーを開始しない", async t => {
  const f = lifecycleFixture(t, {
    channel_id: "vc", owner_id: "owner", game_plan: "limited",
    owner_has_joined: 0, owner_left_at: null, delete_due: 0,
  });
  await GameVcLifecycleService.reconcileAndDelete(f.client);
  assert.equal(f.deleted.length, 0);
  assert.equal(f.statements.some(entry => entry.sql.includes("SET owner_left_at = UTC_TIMESTAMP")), false);
});

test("初回入室済みで退出イベントを取りこぼした場合は確認時から10分計測する", async t => {
  const f = lifecycleFixture(t, {
    channel_id: "vc", owner_id: "owner", game_plan: "limited",
    owner_has_joined: 1, owner_left_at: null, delete_due: 0,
  });
  await GameVcLifecycleService.reconcileAndDelete(f.client);
  assert.equal(f.deleted.length, 0);
  assert.equal(f.statements.some(entry => entry.sql.includes("SET owner_left_at = UTC_TIMESTAMP")), true);
});

test("部屋主が10分不在なら他の利用者がいても削除し、戻っていればタイマーを解除する", async t => {
  await t.test("不在", async t => {
    const f = lifecycleFixture(t, {
      channel_id: "vc", owner_id: "owner", game_plan: "unlimited",
      owner_has_joined: 1, owner_left_at: new Date(), delete_due: 1,
    });
    await GameVcLifecycleService.reconcileAndDelete(f.client);
    assert.deepEqual(f.deleted, ["部屋主が10分間不在"]);
    assert.equal(f.statements.some(entry => entry.sql.includes("SET is_active = ?")), true);
  });
  await t.test("帰還", async t => {
    const f = lifecycleFixture(t, {
      channel_id: "vc", owner_id: "owner", game_plan: "unlimited",
      owner_has_joined: 1, owner_left_at: new Date(), delete_due: 1,
    }, true);
    await GameVcLifecycleService.reconcileAndDelete(f.client);
    assert.equal(f.deleted.length, 0);
    assert.equal(f.statements.some(entry => entry.sql.includes("owner_left_at = NULL")), true);
  });
});

test("6人コースはBot数を上限に加算し、人間6人を維持する", async t => {
  t.mock.method(DbService, "getConnection", async () => connection(async sql => {
    if (sql.includes("SELECT game_plan")) return [[{ game_plan: "limited" }]];
    return [{}];
  }));
  const members = new Collection([
    ["human", { user: { bot: false } }],
    ["bot1", { user: { bot: true } }],
    ["bot2", { user: { bot: true } }],
  ]);
  const limits = [];
  const channel = {
    id: "vc", members, userLimit: 6,
    async setUserLimit(limit, reason) { limits.push([limit, reason]); },
  };
  assert.equal(await GameVcLifecycleService.adjustLimitedVcLimit(channel), true);
  assert.deepEqual(limits, [[8, "遊戯VCの人間6人上限を維持"]]);
});
