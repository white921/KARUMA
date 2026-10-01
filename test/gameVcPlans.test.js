const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { GameVcService } = require("../dist/service/game/gameVcService.js");
const { GameFreeTicketService } = require("../dist/service/game/gameFreeTicketService.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck.js");

function member(roleIds) {
  return { displayName: "利用者", roles: { cache: new Set(roleIds) } };
}

function interactionFor(memberValue, criminal = false) {
  const replies = [];
  return {
    source: {
      id: "confirmation-id",
      user: { id: "1001" },
      member: memberValue,
      channelId: criminal ? TEXT_CHANNEL_IDS.GAME_CRIMINAL_PANEL : TEXT_CHANNEL_IDS.GAME_PANEL,
      async editReply(payload) { replies.push(payload); },
    },
    replies,
  };
}

test("通常利用者には6人・人数フリーのselectを料金とチケット枚数付きで表示する", async () => {
  const fixture = interactionFor(member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]));
  await GameVcService.showPlanSelection(fixture.source);
  const menu = fixture.replies[0].components[0].components[0].toJSON();
  assert.equal(menu.custom_id, PANEL_COMMAND_NAMES.GAME_VC_PLAN_SELECT);
  assert.deepEqual(menu.options.map(option => option.label), ["6人コース", "人数フリーコース"]);
  assert.deepEqual(menu.options.map(option => option.description), [
    "3,000LIA / 遊戯チケット1枚",
    "5,000LIA / 遊戯チケット2枚",
  ]);
});

test("ゲームパスと歓楽師はselectを省略し、人数フリーを無料で確認する", async () => {
  for (const roles of [
    [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN, ROLE_IDS.GAME_PASS],
    [ROLE_IDS.GAME_STAFF],
  ]) {
    const fixture = interactionFor(member(roles));
    await GameVcService.showPlanSelection(fixture.source);
    const payload = fixture.replies[0];
    assert.match(payload.embeds[0].data.description, /人数フリーコース/);
    assert.match(payload.embeds[0].data.description, /料金：\*\*無料\*\*/);
    assert.equal(payload.components[0].components[0].data.custom_id.split(":")[0], PANEL_COMMAND_NAMES.GAME_VC_CREATE_BENEFIT);
  }
});

test("ロール別の確認ボタンは確定済み料金と必要チケット枚数を保持する", async t => {
  t.mock.method(GameFreeTicketService, "hasTicket", async () => true);
  const cases = [
    [member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]), false, "limited", "regular", 3000, 1],
    [member([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN]), false, "unlimited", "vacant", 6000, 2],
    [member([ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI]), true, "limited", "criminal", 6000, 2],
    [member([ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI]), true, "unlimited", "criminal", 10000, 4],
  ];
  for (const [memberValue, criminal, plan, kind, price, tickets] of cases) {
    const fixture = interactionFor(memberValue, criminal);
    await GameVcService.showCreateConfirmation(fixture.source, plan);
    const ids = fixture.replies[0].components[0].components.map(button => button.data.custom_id);
    assert.deepEqual(ids, [
      `${PANEL_COMMAND_NAMES.GAME_VC_CREATE_TICKET}:confirmation-id:${plan}:${kind}:${tickets}`,
      `${PANEL_COMMAND_NAMES.GAME_VC_CREATE_MONEY}:confirmation-id:${plan}:${kind}:${price}`,
      `${PANEL_COMMAND_NAMES.GAME_VC_CREATE_CANCEL}:confirmation-id`,
    ]);
    assert.equal(shouldDeferButtonUpdate(ids[0]), true);
    assert.equal(shouldDeferButtonUpdate(ids[1]), true);
    assert.equal(shouldDeferButtonUpdate(ids[2]), true);
  }
});

test("確定時にロール・料金・特典を再検証し、表示条件から変わった決済は拒否する", async t => {
  t.mock.method(GameFreeTicketService, "hasTicket", async () => true);
  const regular = member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]);
  const tier = { label: "旅人以上", kind: "regular" };
  assert.equal(await GameVcService.resolvePayment(regular, "1001", tier, "money", "limited", "regular", "3000"), "money");
  assert.equal(await GameVcService.resolvePayment(regular, "1001", tier, "ticket", "unlimited", "regular", "2"), "ticket");
  await assert.rejects(
    GameVcService.resolvePayment(regular, "1001", tier, "money", "limited", "regular", "5000"),
    /選び直して/,
  );
  await assert.rejects(
    GameVcService.resolvePayment(member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN, ROLE_IDS.GAME_PASS]), "1001", tier, "money", "limited", "regular", "3000"),
    /選び直して/,
  );
});

test("同じ作成確認は一度だけ使用でき、表示していない支払方法へ改変できない", async t => {
  t.mock.method(GameFreeTicketService, "hasTicket", async () => false);
  const fixture = interactionFor(member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]));
  await GameVcService.showCreateConfirmation(fixture.source, "limited");
  assert.throws(
    () => GameVcService.consumeCreateConfirmation(
      "confirmation-id", fixture.source, "ticket", "limited", "regular", "1",
    ),
    /内容が不正/,
  );

  await GameVcService.showCreateConfirmation(fixture.source, "limited");
  assert.doesNotThrow(() => GameVcService.consumeCreateConfirmation(
    "confirmation-id", fixture.source, "money", "limited", "regular", "3000",
  ));
  assert.throws(
    () => GameVcService.consumeCreateConfirmation(
      "confirmation-id", fixture.source, "money", "limited", "regular", "3000",
    ),
    /期限切れ|処理済み/,
  );
});

test("罪人人数フリーのチケット決済は4枚を同一トランザクションで消費する", async t => {
  const statements = [];
  t.mock.method(DbService, "getConnection", async () => ({
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, params) {
      statements.push({ sql, params });
      if (sql.includes("FROM item_users")) return [[{ item_id: 9, item_key: "GAME_SHORT_FREE", quantity: 4 }]];
      if (sql.includes("SELECT wallet") && sql.includes("FOR UPDATE")) return [[{ wallet: 20000 }]];
      if (sql.includes("SELECT wallet")) return [[{ wallet: 0 }]];
      return [{ insertId: 1, affectedRows: 1 }];
    },
  }));

  await GameVcService.recordVcCreation(
    "1001", "vc", { label: "罪人", kind: "criminal" }, "ticket", "unlimited",
  );
  const consume = statements.find(entry => entry.sql.includes("SET quantity = quantity - ?"));
  assert.deepEqual(consume.params, [4, "1001", 9]);
  const insert = statements.find(entry => entry.sql.includes("INSERT INTO vcs"));
  assert.equal(insert.params[5], "unlimited");
  assert.match(insert.sql, /NULL, \?, FALSE, NULL/);
});
