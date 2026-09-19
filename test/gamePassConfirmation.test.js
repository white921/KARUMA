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
    assert.match(embed.description, /現在の有効期限から延長/);
    const buttons = confirmation.components[0].toJSON().components;
    assert.deepEqual(buttons.map((button) => button.custom_id), [confirmId, COMMANDS.GAME_PASS_CANCEL]);
    assert.equal(shouldDeferButtonUpdate(entryId), false);
    assert.equal(shouldDeferButtonUpdate(confirmId), true);

    const confirm = interaction(buttons[0].custom_id);
    await handlePanelButton(confirm);
    assert.equal(purchase.mock.callCount(), 1);
    assert.deepEqual(purchase.mock.calls[0].arguments, [confirm, plan]);
  });
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
