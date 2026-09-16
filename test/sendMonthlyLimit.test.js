const test = require("node:test");
const assert = require("node:assert/strict");
const { SendService } = require("../dist/service/sendService.js");
const { AccountService } = require("../dist/service/accountService.js");
const { ActionService } = require("../dist/service/actionService.js");
const { DbService } = require("../dist/service/dbService.js");
const { ROLE_IDS, BOT_ID } = require("../dist/constant/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");

function fixture(t, senderRoles = [], monthlySent = 500000, wallet = 2000000) {
  t.mock.method(AccountService, "getAccountByUserId", async (id) => [{ user_id: id, wallet }]);
  t.mock.method(AccountService, "isLinkedMainAndSubAccount", async () => false);
  t.mock.method(SendService, "getMonthlySentAmount", async () => monthlySent);
  const writes = [];
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (sql, params) => { writes.push(params); return [{}]; },
    release() {},
  }));
  const log = t.mock.method(ActionService, "executeActionLog", async () => {});
  const fetched = [];
  const interaction = {
    user: { id: "sender" },
    // 受取人や操作した別人の権限では免除しない。
    member: { roles: { cache: new Set([ROLE_IDS.SABANUSI]) } },
    guild: { members: { fetch: async (options) => {
      fetched.push(options);
      assert.deepEqual(options, { user: "sender", force: true });
      return { roles: { cache: new Set(senderRoles) } };
    } } },
    reply: async () => {},
    editReply: async () => {},
  };
  return { interaction, writes, fetched, log };
}

for (const role of [ROLE_IDS.SABANUSI, ROLE_IDS.KANRISYA, ROLE_IDS.HOTEL_LEADER]) {
  for (const entry of ["command", "panel"]) {
    test(`${role}の${entry}送金は月50万LIA超過後も実行して履歴を残す`, async (t) => {
      const { interaction, writes, fetched, log } = fixture(t, [role]);
      if (entry === "command") {
        await SendService.sendByCommand(interaction, "sender", "recipient", 600000, "報酬");
      } else {
        await SendService.send(interaction, "sender", "recipient", 600000, "報酬", PANEL_COMMAND_NAMES.SEND);
      }
      assert.deepEqual(writes, [[1400000, "sender"], [2600000, "recipient"]]);
      assert.equal(fetched.length, 1);
      assert.equal(log.mock.callCount(), 1);
    });
  }
}

test("対象外ロールは50万LIAちょうどまで許可し、1LIA超過から拒否する", async (t) => {
  const { interaction, writes } = fixture(t, [ROLE_IDS.SHOP_LEADER, ROLE_IDS.GIJUTU_LEADER], 499999);
  await SendService.validateMonthlySendLimit("sender", "recipient", 1, interaction.guild);
  await assert.rejects(
    SendService.sendByCommand(interaction, "sender", "recipient", 2, ""),
    /月間送金上限/,
  );
  assert.deepEqual(writes, []);
});

test("送金元に免除ロールがなければ、操作メンバーの免除ロールでは上限を回避できない", async (t) => {
  const { interaction, writes } = fixture(t);
  interaction.user.id = "operator";
  await assert.rejects(SendService.sendByCommand(interaction, "sender", "recipient", 1, ""), /月間送金上限/);
  assert.deepEqual(writes, []);
});

test("免除対象でも残高不足・不正額は送金しない", async (t) => {
  const { interaction, writes, fetched } = fixture(t, [ROLE_IDS.SABANUSI], 500000, 100);
  for (const amount of [101, 0, -1, 1.5, NaN]) {
    await assert.rejects(SendService.sendByCommand(interaction, "sender", "recipient", amount, ""));
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(fetched, []);
});

test("ロール確認失敗やギルド情報なしでは上限を免除しない", async (t) => {
  const { interaction, writes } = fixture(t);
  interaction.guild.members.fetch = async () => { throw new Error("role lookup failed"); };
  await assert.rejects(SendService.sendByCommand(interaction, "sender", "recipient", 1, ""), /role lookup failed/);
  interaction.guild = null;
  await assert.rejects(SendService.sendByCommand(interaction, "sender", "recipient", 1, ""), /月間送金上限/);
  assert.deepEqual(writes, []);
});

test("Bot・紐付いた本垢とサブ垢の既存免除はロール取得なしで維持する", async (t) => {
  const { interaction, fetched } = fixture(t);
  await SendService.validateMonthlySendLimit(BOT_ID, "recipient", 600000, interaction.guild);
  await SendService.validateMonthlySendLimit("sender", BOT_ID, 600000, interaction.guild);
  t.mock.method(AccountService, "isLinkedMainAndSubAccount", async () => true);
  await SendService.validateMonthlySendLimit("sender", "recipient", 600000, interaction.guild);
  assert.deepEqual(fetched, []);
});
