const test = require("node:test");
const assert = require("node:assert/strict");
const { ButtonInteraction, ChannelType } = require("discord.js");
const { ROLE_IDS } = require("../dist/constant/shared/id");
const { PANEL_COMMAND_NAMES: C } = require("../dist/constant/shared/command");
const { SOLITARY_CELL } = require("../dist/constant/vc/solitaryCell");
const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck");
const { AccountService } = require("../dist/service/account/accountService");
const { DbService } = require("../dist/service/system/dbService");

const PAID = ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME;
const FREE = ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN;
const member = (roles) => ({ displayName: "利用者", roles: { cache: new Set(roles) } });

function fixture(t, roles = [PAID]) {
  const state = { wallet: 100000, vcs: [], actions: [], created: [], deleted: [], replies: [], commits: 0, rollbacks: 0, roles };
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(DbService, "getConnection", async () => {
    const snapshot = { wallet: state.wallet, vcs: [...state.vcs], actions: [...state.actions] };
    return {
      beginTransaction: async () => {},
      execute: async (sql, params) => {
        if (sql.includes("SELECT wallet")) return [[{ wallet: sql.includes("FOR UPDATE") ? state.wallet : 0 }]];
        if (sql.includes("UPDATE accounts")) state.wallet = params[0];
        if (sql.includes("INSERT INTO vcs")) state.vcs.push(params);
        if (sql.includes("INSERT INTO actions")) {
          if (state.failDb) throw new Error("database write failed");
          state.actions.push(params);
        }
        return [{}];
      },
      commit: async () => { state.commits++; },
      rollback: async () => { Object.assign(state, snapshot); state.rollbacks++; },
      release() {},
    };
  });
  const source = {
    customId: C.SOLITARY_CELL_CREATE, user: { id: "buyer" }, guildId: "guild", channelId: "panel",
    member: member(roles), deferred: true, replied: false,
    // Use the real guards: a second acknowledgement throws InteractionAlreadyReplied.
    reply: ButtonInteraction.prototype.reply,
    update: ButtonInteraction.prototype.update,
    deferUpdate: ButtonInteraction.prototype.deferUpdate,
    deferReply: ButtonInteraction.prototype.deferReply,
    editReply: async (payload) => {
      if (state.failReply && payload.content?.startsWith("✅")) throw new Error("reply failed");
      state.replies.push(payload);
    },
    guild: {
      members: { fetch: async (options) => {
        assert.deepEqual(options, { user: "buyer", force: true });
        return member(state.roles);
      } },
      channels: {
        fetch: async () => ({ id: "category", type: ChannelType.GuildCategory, permissionOverwrites: { cache: { map: () => [] } } }),
        create: async (options) => {
          if (state.failCreate) throw new Error("channel create failed");
          const id = `vc-${state.created.length}`;
          state.created.push(options);
          return { id, send: async () => {}, delete: async () => state.deleted.push(id) };
        },
      },
    },
    client: { channels: { fetch: async () => ({ isTextBased: () => true, send: async () => {} }) } },
  };
  return { state, source, button(action = "confirm", payload = state.replies[0], overrides = {}) {
    const buttons = payload.components[0].toJSON().components;
    return { ...source, customId: buttons[action === "confirm" ? 1 : 0].custom_id, ...overrides };
  } };
}

test("入口と確定は二重応答せず、課金・期限・履歴を記録する", async (t) => {
  const f = fixture(t);
  const before = Date.now();
  assert.equal(shouldDeferButtonUpdate(f.source.customId), false);
  await handlePanelButton(f.source);
  const confirm = f.button();
  assert.equal(shouldDeferButtonUpdate(confirm.customId), true);
  await handlePanelButton(confirm);
  assert.equal(f.state.wallet, 90000);
  assert.equal(f.state.commits, 1);
  assert.equal(f.state.actions.length, 1);
  assert.equal(f.state.actions[0][1], 10000);
  assert.equal(f.state.created[0].userLimit, 1);
  assert.equal(f.state.vcs[0][2], SOLITARY_CELL.TYPE);
  assert.ok(f.state.vcs[0][3].getTime() >= before + 12 * 60 * 60 * 1000);
  assert.deepEqual(f.state.replies.at(-1).components, []);
  assert.match(f.state.replies.at(-1).content, /作成しました/);
});

test("同じ確認の同時確定・完了後の再確定は一度だけ課金する", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  const confirm = f.button();
  const results = await Promise.allSettled([handlePanelButton(confirm), handlePanelButton(confirm)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(handlePanelButton(confirm), /処理済み/);
  assert.equal(f.state.created.length, 1);
  assert.equal(f.state.wallet, 90000);
  assert.equal(f.state.actions.length, 1);
});

test("キャンセル後の確定は拒否し、キャンセルでも二重応答しない", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  const cancel = f.button("cancel");
  assert.equal(shouldDeferButtonUpdate(cancel.customId), true);
  await handlePanelButton(cancel);
  await assert.rejects(handlePanelButton(f.button()), /処理済み/);
  assert.equal(f.state.created.length, 0);
  assert.equal(f.state.wallet, 100000);
});

test("確定とキャンセルが競合しても消費した確認は復活しない", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  const results = await Promise.allSettled([handlePanelButton(f.button()), handlePanelButton(f.button("cancel"))]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.state.created.length, 1);
  assert.equal(f.state.actions.length, 1);
});

for (const [from, to, expectedPrice] of [[FREE, PAID, 10000], [PAID, FREE, 0]]) {
  test(`料金変更時は課金せず再確認し、新しい料金 ${expectedPrice} で一度だけ作成する`, async (t) => {
    const f = fixture(t, [from]);
    await handlePanelButton(f.source);
    const original = f.button();
    f.state.roles = [to];
    await handlePanelButton(original);
    assert.equal(f.state.created.length, 0);
    assert.equal(f.state.actions.length, 0);
    assert.match(f.state.replies.at(-1).content, /料金が変更/);
    const renewed = f.button("confirm", f.state.replies.at(-1));
    assert.notEqual(renewed.customId, original.customId);
    await assert.rejects(handlePanelButton(original), /処理済み/);
    await handlePanelButton(renewed);
    assert.equal(f.state.wallet, 100000 - expectedPrice);
    assert.equal(f.state.actions[0][1], expectedPrice);
    assert.equal(f.state.created.length, 1);
  });
}

test("最新ロールで利用資格を失っていれば作成しない", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  f.state.roles = [];
  await assert.rejects(handlePanelButton(f.button()), /ロールではありません/);
  assert.equal(f.state.created.length, 0);
});

test("別人・別サーバー・別チャンネルでは確認を消費できない", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  for (const overrides of [{ user: { id: "other" } }, { guildId: "other" }, { channelId: "other" }]) {
    await assert.rejects(handlePanelButton(f.button("confirm", undefined, overrides)), /操作できません/);
  }
  await handlePanelButton(f.button());
  assert.equal(f.state.actions.length, 1);
});

test("期限切れ・旧形式・再起動で消失した確認情報は購入しない", async (t) => {
  const f = fixture(t);
  await handlePanelButton(f.source);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + SOLITARY_CELL.CONFIRMATION_TTL_MS + 1);
  for (const customId of [f.button().customId, C.SOLITARY_CELL_CONFIRM, `${C.SOLITARY_CELL_CONFIRM}:missing`, C.SOLITARY_CELL_CANCEL]) {
    assert.equal(shouldDeferButtonUpdate(customId), true);
    await assert.rejects(handlePanelButton({ ...f.source, customId }), /期限切れ/);
  }
  assert.equal(f.state.created.length, 0);
});

for (const failure of ["failCreate", "failDb", "failReply", "insufficientWallet"]) {
  test(`${failure}: 失敗後に同じ画面から再実行しない`, async (t) => {
    const f = fixture(t);
    await handlePanelButton(f.source);
    if (failure === "insufficientWallet") f.state.wallet = 100;
    else f.state[failure] = true;
    await assert.rejects(handlePanelButton(f.button()));
    await assert.rejects(handlePanelButton(f.button()), /処理済み/);
    if (failure === "failReply") {
      assert.equal(f.state.wallet, 90000);
      assert.equal(f.state.actions.length, 1);
      assert.equal(f.state.deleted.length, 0);
    } else {
      assert.equal(f.state.wallet, failure === "insufficientWallet" ? 100 : 100000);
      assert.equal(f.state.actions.length, 0);
      assert.equal(f.state.vcs.length, 0);
      assert.equal(f.state.deleted.length, failure === "failCreate" ? 0 : 1);
    }
  });
}
