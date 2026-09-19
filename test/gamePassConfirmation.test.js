const test = require("node:test");
const assert = require("node:assert/strict");
const { PANEL_COMMAND_NAMES: COMMANDS } = require("../dist/constant/shared/command");
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id");
const { GameVcService } = require("../dist/service/game/gameVcService");
const { AccountService } = require("../dist/service/account/accountService");
const { DbService } = require("../dist/service/system/dbService");
const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck");

function interaction(customId, roles = [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]) {
  const replies = [];
  return {
    customId,
    channelId: TEXT_CHANNEL_IDS.GAME_PANEL,
    user: { id: "buyer" },
    member: { roles: { cache: { has: (id) => roles.includes(id) } } },
    editReply: async (payload) => replies.push(payload),
    replies,
  };
}

for (const [entryId, confirmId, plan, label, price] of [
  [COMMANDS.GAME_PASS_TWO_WEEKS, COMMANDS.GAME_PASS_TWO_WEEKS_CONFIRM, "twoWeeks", "2週間", "50,000LIA"],
  [COMMANDS.GAME_PASS_ONE_MONTH, COMMANDS.GAME_PASS_ONE_MONTH_CONFIRM, "oneMonth", "1か月", "100,000LIA"],
]) {
  test(`${label}: purchase starts only after confirmation`, async (t) => {
    t.mock.method(AccountService, "hasAccount", async () => true);
    t.mock.method(DbService, "getConnection", async () => assert.fail("confirmation must not write to DB"));
    const purchase = t.mock.method(GameVcService, "purchasePass", async () => {});
    const entry = interaction(entryId);
    await handlePanelButton(entry);
    assert.equal(purchase.mock.callCount(), 0);
    const confirmation = entry.replies[0];
    const embed = confirmation.embeds[0].toJSON();
    assert.ok(embed.title.includes(label));
    assert.ok(embed.description.includes(price));
    assert.doesNotMatch(embed.description, /延長/);
    const buttons = confirmation.components[0].toJSON().components;
    assert.deepEqual(buttons.map((button) => button.custom_id), [confirmId, COMMANDS.GAME_PASS_CANCEL]);
    assert.equal(shouldDeferButtonUpdate(entryId), false);
    assert.equal(shouldDeferButtonUpdate(confirmId), true);

    const confirm = interaction(buttons[0].custom_id);
    await handlePanelButton(confirm);
    assert.equal(purchase.mock.callCount(), 1);
    assert.deepEqual(purchase.mock.calls[0].arguments, [confirm, plan]);
  });

  test(`${label}: pass holders return before showing confirmation or charging`, async (t) => {
    t.mock.method(AccountService, "hasAccount", async () => true);
    t.mock.method(DbService, "getConnection", async () => assert.fail("pass holder must not reach purchase DB"));
    for (const customId of [entryId, confirmId]) {
      const owned = interaction(customId, [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN, ROLE_IDS.GAME_PASS]);
      await handlePanelButton(owned);
      assert.equal(owned.replies.length, 1);
      assert.match(owned.replies[0].content, /すでに所持しているため、購入できません/);
      assert.deepEqual(owned.replies[0].embeds, []);
      assert.deepEqual(owned.replies[0].components, []);
    }
  });

  test(`${label}: acquiring a pass after opening confirmation prevents purchase`, async (t) => {
    t.mock.method(AccountService, "hasAccount", async () => true);
    t.mock.method(DbService, "getConnection", async () => assert.fail("must not charge again"));
    const roles = [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN];
    const entry = interaction(entryId, roles);
    await handlePanelButton(entry);
    roles.push(ROLE_IDS.GAME_PASS);
    await handlePanelButton({ ...entry, customId: confirmId });
    assert.match(entry.replies[1].content, /購入できません/);
    assert.deepEqual(entry.replies[1].components, []);
  });
}

for (const plan of ["twoWeeks", "oneMonth"]) {
  for (const state of ["active", "expired", "deleted", "missing"]) {
    test(`${plan}: transaction rejects active passes and allows ${state} state as appropriate`, async (t) => {
      const writes = [];
      let rolledBack = false;
      let committed = false;
      let released = false;
      const previousPass = {
        is_deleted: state === "deleted",
        expire_at: new Date(Date.now() + (state === "expired" ? -86400000 : 86400000)),
      };
      t.mock.method(DbService, "getConnection", async () => ({
        beginTransaction: async () => {},
        commit: async () => { committed = true; },
        rollback: async () => { rolledBack = true; },
        release: () => { released = true; },
        execute: async (sql, params) => {
          if (sql.startsWith("SELECT expire_at")) return [state === "missing" ? [] : [previousPass]];
          if (sql.startsWith("SELECT wallet")) return [[{ wallet: 200000 }]];
          writes.push({ sql, params });
          return [{ insertId: 1 }];
        },
      }));
      if (state === "active") {
        await assert.rejects(GameVcService.recordPassPurchase("buyer", plan), /すでに所持/);
        assert.deepEqual(writes, []);
        assert.equal(rolledBack, true);
        assert.equal(committed, false);
      } else {
        const result = await GameVcService.recordPassPurchase("buyer", plan);
        assert.equal(result.afterWallet, plan === "twoWeeks" ? 150000 : 100000);
        assert.equal(writes.length, 3);
        assert.equal(committed, true);
        assert.equal(rolledBack, false);
      }
      assert.equal(released, true);
    });
  }
}

test("cancel clears the confirmation without purchasing", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  const purchase = t.mock.method(GameVcService, "purchasePass", async () => assert.fail("cancel must not purchase"));
  const cancel = interaction(COMMANDS.GAME_PASS_CANCEL);
  await handlePanelButton(cancel);
  assert.equal(purchase.mock.callCount(), 0);
  assert.match(cancel.replies[0].content, /購入をキャンセル/);
  assert.deepEqual(cancel.replies[0].embeds, []);
  assert.deepEqual(cancel.replies[0].components, []);
  assert.equal(shouldDeferButtonUpdate(COMMANDS.GAME_PASS_CANCEL), true);
});

test("eligibility and panel location are checked at both confirmation and purchase", async (t) => {
  t.mock.method(DbService, "getConnection", async () => assert.fail("rejected purchase must not write to DB"));
  for (const method of ["showPassConfirmation", "purchasePass"]) {
    await assert.rejects(
      GameVcService[method](interaction("", [ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN]), "twoWeeks"),
      /ゲームパスを購入できるロールではありません/,
    );
    await assert.rejects(
      GameVcService[method]({ ...interaction(""), channelId: "wrong" }, "oneMonth"),
      /遊戯パネルで操作してください/,
    );
    await assert.rejects(
      GameVcService[method](interaction("", [ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI]), "twoWeeks"),
      /罪人用の遊戯パネル/,
    );
  }
});
