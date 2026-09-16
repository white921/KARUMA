const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { data } = require("../dist/command/balanceAdjustment.js");
const { exeCommand } = require("../dist/util/exeCommand.js");
const { AdminMintService } = require("../dist/service/adminMintService.js");
const { AdminBurnService } = require("../dist/service/adminBurnService.js");
const { AccountService } = require("../dist/service/accountService.js");
const { ActionService } = require("../dist/service/actionService.js");
const { DbService } = require("../dist/service/dbService.js");
const { COMMAND_NAMES, PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { toActionType } = require("../dist/constant/action.js");
const { ROLE_IDS, BOT_ID, THREAD_IDS } = require("../dist/constant/id.js");

function fixture(t, {
  roles = [ROLE_IDS.GINKOU_STAFF], amount = 1000, wallet = 5000,
  exists = true, subAccount = false, comment = "報酬調整", sendLogMessage = false,
} = {}) {
  const calls = [];
  const reads = t.mock.method(AccountService, "getAccountByUserId", async (id) =>
    id === BOT_ID ? [{ user_id: id, wallet: 0 }] : exists ? [{ user_id: id, wallet }] : [],
  );
  t.mock.method(AccountService, "isSubAccount", async () => subAccount);
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (sql, params) => { calls.push([sql.trim().startsWith("UPDATE") ? "update" : "history", params]); return [{}]; },
    release() {},
  }));
  if (!sendLogMessage) {
    t.mock.method(ActionService, "createActionLogMessage", async (...args) => calls.push(["log", args.slice(1)]));
  }
  const interaction = {
    user: { id: "operator" },
    deferred: true,
    replied: false,
    guild: { members: { fetch: async (input) => {
      assert.equal(typeof input === "string" ? input : input.user, "operator");
      if (typeof input !== "string") assert.equal(input.force, true);
      return { roles: { cache: new Set(roles) } };
    } } },
    options: {
      getUser: (name) => { assert.equal(name, "ユーザー"); return { id: "target" }; },
      getInteger: (name) => { assert.equal(name, "増減額"); return amount; },
      getString: (name) => { assert.equal(name, "備考"); return comment; },
    },
    reply: async (payload) => calls.push(["reply", payload]),
    editReply: async (payload) => calls.push(["editReply", payload]),
  };
  return { interaction, calls, reads };
}

test("残高増減はユーザー・符号付き整数・任意の備考を受け取りDMでは使えない", () => {
  const command = data.toJSON();
  assert.equal(command.name, "残高増減");
  assert.equal(command.dm_permission, false);
  assert.deepEqual(command.options.map(({ name, type, required }) => [name, type, required]), [
    ["ユーザー", 6, true], ["増減額", 4, true], ["備考", 3, false],
  ]);
  assert.ok(command.options[1].min_value === undefined || command.options[1].min_value < 0);
});

for (const role of [ROLE_IDS.SABANUSI, ROLE_IDS.KANRISYA, ROLE_IDS.GINKOU_STAFF, ROLE_IDS.GIJUTU_LEADER]) {
  for (const amount of [600000, -1000]) {
    test(`${role}の増減額${amount}は対象者だけを変更し既存形式で履歴・ログを残す`, async (t) => {
      const { interaction, calls } = fixture(t, { roles: [role], amount });
      await exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT);
      const after = 5000 + amount;
      const command = amount > 0 ? PANEL_COMMAND_NAMES.ADMIN_MINT : PANEL_COMMAND_NAMES.ADMIN_BURN;
      const from = amount > 0 ? "operator" : "target";
      const to = amount > 0 ? "target" : "operator";
      assert.deepEqual(calls.filter(([op]) => op === "update"), [["update", [after, "target"]]]);
      assert.deepEqual(calls.find(([op]) => op === "history")[1], [
        toActionType(command), Math.abs(amount), from, to,
        amount > 0 ? 0 : after, amount > 0 ? after : 0, "報酬調整",
      ]);
      assert.deepEqual(calls.find(([op]) => op === "log")[1], [command, Math.abs(amount), from, to, "報酬調整"]);
      assert.equal(calls.filter(([op]) => op === "reply").length, 0);
      assert.equal(calls.filter(([op]) => op === "editReply").length, 1);
      assert.match(calls.find(([op]) => op === "editReply")[1].content, amount > 0 ? /600,000LIA付与/ : /1,000LIA減額/);
    });
  }
}

for (const roles of [[], [ROLE_IDS.HOTEL_LEADER], [ROLE_IDS.GINKOU_LEADER]]) {
  test(`許可ロール以外は口座・残高にアクセスする前に拒否する: ${roles}`, async (t) => {
    const { interaction, calls, reads } = fixture(t, { roles });
    await assert.rejects(exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT), /皇帝・英傑・財務員・システム支配人のみ/);
    assert.equal(reads.mock.callCount(), 0);
    assert.deepEqual(calls, []);
  });
}

test("ギルド情報なし・ロール取得失敗では残高を操作しない", async (t) => {
  const { interaction, calls, reads } = fixture(t);
  interaction.guild.members.fetch = async () => { throw new Error("fetch failed"); };
  await assert.rejects(exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT), /fetch failed/);
  interaction.guild = null;
  await assert.rejects(exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT), /サーバー内/);
  assert.equal(reads.mock.callCount(), 0);
  assert.deepEqual(calls, []);
});

for (const amount of [0, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`不正な増減額${amount}では残高を操作しない`, async (t) => {
    const { interaction, calls, reads } = fixture(t, { amount });
    await assert.rejects(exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT), /0以外の整数/);
    assert.equal(reads.mock.callCount(), 0);
    assert.deepEqual(calls, []);
  });
}

for (const [name, options, error] of [
  ["口座未開設への付与", { exists: false }, /口座が見つかりません/],
  ["口座未開設からの剥奪", { exists: false, amount: -1 }, /口座が見つかりません/],
  ["残高を超える剥奪", { amount: -5001 }, /残高が不足/],
  ["サブアカウントへの付与", { subAccount: true }, /サブアカウントには付与できません/],
]) {
  test(`${name}はパネルと同じ条件で拒否する`, async (t) => {
    const { interaction, calls } = fixture(t, options);
    await assert.rejects(exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT), error);
    assert.deepEqual(calls, []);
  });
}

test("備考省略と残高ちょうどの剥奪を受け付ける", async (t) => {
  const { interaction, calls } = fixture(t, { amount: -5000, comment: null });
  await exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT);
  assert.deepEqual(calls.find(([op]) => op === "update")[1], [0, "target"]);
  assert.equal(calls.find(([op]) => op === "history")[1].at(-1), "");
});

for (const method of ["mint", "burn"]) {
  test(`既存パネルの${method}は未応答モーダルに一度だけephemeral返信する`, async (t) => {
    const { interaction, calls } = fixture(t);
    interaction.deferred = false;
    await (method === "mint" ? AdminMintService.mint(interaction, "target", 1000, "") : AdminBurnService.burn(interaction, "target", 1000, ""));
    assert.equal(calls.filter(([op]) => op === "reply").length, 1);
    assert.equal(calls.find(([op]) => op === "reply")[1].flags, MessageFlags.Ephemeral);
    assert.equal(calls.filter(([op]) => op === "editReply").length, 0);
  });
}

for (const [amount, label] of [[1000, "付与"], [-1000, "剥奪"]]) {
  test(`残高増減${amount}は増減ログへ${label}として実行者・対象者・備考を送る`, async (t) => {
    const { interaction } = fixture(t, { roles: [ROLE_IDS.GIJUTU_LEADER], amount, sendLogMessage: true });
    const messages = [];
    interaction.client = { channels: { fetch: async (id) => {
      assert.equal(id, amount > 0 ? THREAD_IDS.MINT_LOG_THREAD : THREAD_IDS.BURN_LOG_THREAD);
      return { isThread: () => true, isTextBased: () => true, send: async (message) => messages.push(message) };
    } } };
    await exeCommand(interaction, COMMAND_NAMES.BALANCE_ADJUSTMENT);
    assert.equal(messages.length, 1);
    assert.ok(messages[0].startsWith(`**${label}**\n`));
    assert.match(messages[0], /<@operator>が<@target>/);
    assert.match(messages[0], /1,000LIA/);
    assert.match(messages[0], /備考: 報酬調整/);
  });
}
