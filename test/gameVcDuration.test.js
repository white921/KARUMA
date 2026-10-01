const test = require("node:test");
const assert = require("node:assert/strict");
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id.js");
const { PANEL_COMMAND_NAMES: C } = require("../dist/constant/shared/command.js");
const { GameFreeTicketService } = require("../dist/service/game/gameFreeTicketService.js");
const { GameVcService } = require("../dist/service/game/gameVcService.js");
const { DbService } = require("../dist/service/system/dbService.js");

function member(roleIds) {
  return {
    displayName: "tester",
    roles: { cache: { has: id => roleIds.includes(id) } },
  };
}

function buttonInteraction(roleIds = [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]) {
  const replies = [];
  return {
    channelId: TEXT_CHANNEL_IDS.GAME_PANEL,
    user: { id: "1001" },
    member: member(roleIds),
    editReply: async payload => replies.push(payload),
    replies,
  };
}

function selectInteraction(value, roleIds = [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]) {
  const interaction = buttonInteraction(roleIds);
  return {
    ...interaction,
    values: [String(value)],
    deferred: false,
    deferUpdate: async () => { interaction.deferred = true; },
  };
}

test("遊戯VC作成は3・6・24時間のselectを料金付きで表示する", async () => {
  const interaction = buttonInteraction();
  await GameVcService.showDurationSelection(interaction);
  const payload = interaction.replies[0];
  const select = payload.components[0].toJSON().components[0];
  assert.equal(select.custom_id, C.GAME_VC_DURATION_SELECT);
  assert.deepEqual(select.options.map(option => [option.label, option.value]), [
    ["3時間", "3"], ["6時間", "6"], ["24時間", "24"],
  ]);
  assert.match(select.options[0].description, /1,000LIA/);
  assert.match(select.options[1].description, /3,000LIA/);
  assert.match(select.options[2].description, /5,000LIA.*遊戯チケット利用可/);
});

test("歓楽師とゲームパス所有者には全時間無料と空室削除を案内する", async () => {
  for (const roles of [[ROLE_IDS.GAME_STAFF], [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN, ROLE_IDS.GAME_PASS]]) {
    const interaction = buttonInteraction(roles);
    await GameVcService.showDurationSelection(interaction);
    const payload = interaction.replies[0];
    assert.match(payload.embeds[0].toJSON().description, /どの時間も無料.*全員が退出すると自動で削除/);
    const options = payload.components[0].toJSON().components[0].options;
    assert.ok(options.every(option => option.description.includes("無料（全員退出後に自動削除）")));
  }
});

test("遊戯チケットは24時間の確認だけに表示される", async t => {
  t.mock.method(GameFreeTicketService, "hasTicket", async () => true);
  for (const duration of [3, 6, 24]) {
    const interaction = selectInteraction(duration);
    await GameVcService.showCreateConfirmation(interaction);
    const buttons = interaction.replies[0].components[0].toJSON().components;
    const ids = buttons.map(button => button.custom_id);
    assert.ok(ids.includes(`${C.GAME_VC_CREATE_MONEY}:${duration}`));
    assert.equal(ids.includes(`${C.GAME_VC_CREATE_TICKET}:${duration}`), duration === 24);
  }
});

test("無料作成だけを空室削除対象として保存し、選択時間と料金を履歴へ残す", async t => {
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

  async function record(payment, durationHours) {
    activeStatements = [];
    await GameVcService.recordVcCreation(
      "1001", `vc-${payment}`, { label: "旅人以上", price: 5000 }, payment,
      new Date("2026-10-01T12:00:00Z"), durationHours,
    );
    return activeStatements;
  }

  for (const [payment, bonus] of [["money", false], ["ticket", false], ["pass", true], ["staff", true]]) {
    const statements = await record(payment, payment === "money" ? 3 : 24);
    const vcInsert = statements.find(entry => entry.sql.includes("INSERT INTO vcs"));
    assert.equal(vcInsert.params[4], bonus, payment);
    const actionInsert = statements.find(entry => entry.sql.includes("INSERT INTO actions"));
    assert.equal(actionInsert.params[1], payment === "money" ? 1000 : 0);
    assert.match(actionInsert.params[6], payment === "money" ? /3時間/ : /24時間/);
  }
});

test("24時間以外では改変されたチケット作成要求を拒否する", async () => {
  await assert.rejects(
    GameVcService.resolvePayment(
      member([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]),
      "1001",
      { label: "旅人以上", price: 5000 },
      "ticket",
      6,
    ),
    /24時間VCにのみ使用/,
  );
});
