const test = require("node:test");
const assert = require("node:assert/strict");
const { ChannelType, REST } = require("discord.js");
const { VcService } = require("../dist/service/vc/vcService.js");
const { GAME_VC } = require("../dist/constant/game/game.js");
const { HOTEL_TYPE } = require("../dist/constant/hotel/hotel.js");

function fixture(name = "遊戯 - テスト", inside = true) {
  const calls = [];
  const channel = {
    id: "vc", type: ChannelType.GuildVoice, name,
    async fetch(force) { assert.equal(force, true); return this; },
    async setName(value) { calls.push(["name", value]); this.name = value; },
  };
  const interaction = {
    user: { id: "user" }, channel,
    guild: { members: { async fetch() {
      return { roles: [], voice: { channel: inside ? channel : null } };
    } } },
    async deferReply() { calls.push(["defer"]); },
    async editReply() { calls.push(["reply"]); },
  };
  return { interaction, channel, calls };
}

test("lock mark toggles only the name, with acknowledgement before API work", async t => {
  t.mock.method(VcService, "getVcTypeFromDb", async () => GAME_VC.TYPE);
  const { interaction, channel, calls } = fixture();
  await VcService.toggleVcLockMark(interaction);
  assert.equal(channel.name, "🔒 遊戯 - テスト");
  await VcService.toggleVcLockMark(interaction);
  assert.equal(channel.name, "遊戯 - テスト");
  assert.deepEqual(calls, [["defer"], ["name", "🔒 遊戯 - テスト"], ["reply"],
    ["defer"], ["name", "遊戯 - テスト"], ["reply"]]);
});

test("lock mark supports every hotel type without changing permissions", async t => {
  for (const type of Object.values(HOTEL_TYPE)) {
    await t.test(type, async t => {
      t.mock.method(VcService, "getVcTypeFromDb", async () => type);
      const f = fixture("ホテル - テスト");
      f.channel.permissionOverwrites = { async set() { assert.fail("permissions must stay unchanged"); } };
      await VcService.toggleVcLockMark(f.interaction);
      assert.equal(f.channel.name, "🔒 ホテル - テスト");
      await VcService.toggleVcLockMark(f.interaction);
      assert.equal(f.channel.name, "ホテル - テスト");
      await assert.rejects(VcService.toggleVcLockMark(fixture("ホテル", false).interaction), /VCにいる方/);
    });
  }
});

test("lock mark rejects outsiders and unmanaged or unsupported VCs", async t => {
  t.mock.method(VcService, "getVcTypeFromDb", async () => "TELEPORT");
  await assert.rejects(VcService.toggleVcLockMark(fixture("遊戯", false).interaction), /VCにいる方/);
  await assert.rejects(VcService.toggleVcLockMark(fixture().interaction), /遊戯・ホテルVCの操作パネル/);
  VcService.getVcTypeFromDb.mock.restore();
  t.mock.method(VcService, "getVcTypeFromDb", async () => null);
  await assert.rejects(VcService.toggleVcLockMark(fixture().interaction), /遊戯・ホテルVCの操作パネル/);
});

test("lock button handler accepts the acknowledgement already sent by the entrypoint", async t => {
  const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler.js");
  const { AccountService } = require("../dist/service/account/accountService.js");
  const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
  t.mock.method(VcService, "getVcTypeFromDb", async () => GAME_VC.TYPE);
  t.mock.method(AccountService, "hasAccount", async () => true);
  const f = fixture();
  f.interaction.deferred = true;
  f.interaction.customId = PANEL_COMMAND_NAMES.TOGGLE_VC_LOCK_MARK;
  await handlePanelButton(f.interaction);
  assert.deepEqual(f.calls, [["name", "🔒 遊戯 - テスト"], ["reply"]]);
});

test("lock mark does not truncate long names or rename a lock-only VC to empty", async t => {
  t.mock.method(VcService, "getVcTypeFromDb", async () => GAME_VC.TYPE);
  for (const name of ["あ".repeat(100), "🔒"]) {
    const f = fixture(name);
    await assert.rejects(VcService.toggleVcLockMark(f.interaction), /1〜100文字/);
    assert.equal(f.channel.name, name);
  }
  const f = fixture("🔒遊戯");
  await VcService.toggleVcLockMark(f.interaction);
  assert.equal(f.channel.name, "遊戯");
  const emoji = fixture("🔒️ ホテル");
  await VcService.toggleVcLockMark(emoji.interaction);
  assert.equal(emoji.channel.name, "ホテル");
});

test("name and status modals reject users who left the VC", async () => {
  const f = fixture("遊戯", false);
  await assert.rejects(VcService.changeVcName(f.interaction, "新しい名前"), /VCにいる方/);
  await assert.rejects(VcService.changeVcStatus(f.interaction, "募集中"), /VCにいる方/);
  assert.equal(f.channel.name, "遊戯");
});

test("status modal updates the channel after acknowledgement", async t => {
  const f = fixture();
  const previous = process.env.DISCORD_TOKEN;
  process.env.DISCORD_TOKEN = "test-token";
  t.after(() => {
    if (previous === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = previous;
  });
  t.mock.method(REST.prototype, "put", async (route, options) => {
    assert.deepEqual(f.calls, [["defer"]]);
    assert.equal(route, "/channels/vc/voice-status");
    assert.deepEqual(options.body, { status: "参加者募集中" });
  });
  await VcService.changeVcStatus(f.interaction, " 参加者募集中 ");
  assert.deepEqual(f.calls, [["defer"], ["reply"]]);
});

test("concurrent lock clicks are rejected and failed renames can be retried", async t => {
  t.mock.method(VcService, "getVcTypeFromDb", async () => GAME_VC.TYPE);
  const f = fixture();
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  t.mock.method(f.channel, "setName", async () => {
    started();
    await new Promise((resolve, reject) => { finish = reject; });
  });
  const first = VcService.toggleVcLockMark(f.interaction);
  await ready;
  await assert.rejects(VcService.toggleVcLockMark(f.interaction), /変更中/);
  finish(new Error("Discord unavailable"));
  await assert.rejects(first, /Discord unavailable/);
  f.channel.setName.mock.restore();
  await VcService.toggleVcLockMark(f.interaction);
  assert.equal(f.channel.name, "🔒 遊戯 - テスト");
});

test("VC creation sends the panel after settlement and still succeeds if send fails", async t => {
  const { GameVcService } = require("../dist/service/game/gameVcService.js");
  const { ROLE_IDS } = require("../dist/constant/shared/id.js");
  for (const failSend of [false, true]) {
    await t.test(`send failure: ${failSend}`, async t => {
      const steps = [];
      t.mock.method(GameVcService, "assertCreatePanelAccess", () => {});
      t.mock.method(GameVcService, "resolvePayment", async () => "money");
      t.mock.method(GameVcService, "recordVcCreation", async () => { steps.push("paid"); return 1000; });
      t.mock.method(GameVcService, "sendVcLog", async () => {});
      t.mock.method(console, "error", () => {});
      const interaction = {
        user: { id: "user" },
        member: { displayName: "テスト", roles: { cache: { has: id => id === ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN } } },
        guild: { id: "guild", channels: {
          async fetch() { return { id: "category", type: ChannelType.GuildCategory }; },
          async create() { return { id: "vc", async send(panel) {
            assert.deepEqual(steps, ["paid"]);
            assert.equal(panel.components[0].toJSON().components.length, 3);
            steps.push("panel");
            if (failSend) throw new Error("Discord unavailable");
          } }; },
        } },
        async editReply(body) { if (body.content.startsWith("✅")) steps.push("success"); },
      };
      await GameVcService.createVc(interaction, "money");
      assert.deepEqual(steps, ["paid", "panel", "success"]);
    });
  }
});
