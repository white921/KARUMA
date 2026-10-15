const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE_IDS } = require("../dist/constant/shared/id.js");
const { CHANGE_NAME_MESSAGES } = require("../dist/constant/account/changeName.js");
const { AccountService } = require("../dist/service/account/accountService.js");
const { ActionService } = require("../dist/service/currency/actionService.js");
const { ChangeNameService } = require("../dist/service/account/changeNameService.js");
const { EvaluationSheetArchiveService } = require("../dist/service/evaluation/evaluationSheetArchiveService.js");
const { DbService } = require("../dist/service/system/dbService.js");

function memberWithRoles(roleIds, overrides = {}) {
  return {
    id: "member",
    user: { id: "member" },
    displayName: "旧名",
    roles: { cache: new Set(roleIds) },
    guild: {},
    ...overrides,
  };
}

test("見習い案内官・案内官・案内官統括は旅人の名前を変更できる", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(AccountService, "isSubAccount", async () => false);
  t.mock.method(AccountService, "validateName", async () => undefined);

  const target = memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN]);
  for (const roleId of [
    ROLE_IDS.MENSTU_BUIGINNER,
    ROLE_IDS.MENSTUKAN,
    ROLE_IDS.MENSETU_LEADER,
  ]) {
    await assert.doesNotReject(
      ChangeNameService.validateChangeName(
        target,
        "新名",
        memberWithRoles([roleId], { id: "operator", user: { id: "operator" } }),
      ),
    );
  }
});

test("案内官系でも旅人以上でない対象の名前は変更できない", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(AccountService, "isSubAccount", async () => false);

  await assert.rejects(
    ChangeNameService.validateChangeName(
      memberWithRoles([]),
      "新名",
      memberWithRoles([ROLE_IDS.MENSTUKAN], { id: "operator", user: { id: "operator" } }),
    ),
    new RegExp(CHANGE_NAME_MESSAGES.REQUIRED_ROLE_NOT_FOUND),
  );
});

test("評価シート名は期限を保って表示名だけを置き換える", () => {
  assert.equal(
    EvaluationSheetArchiveService.createRenamedSheetTitle("旧名〜10/29", "新名"),
    "新名〜10/29",
  );
  assert.equal(
    EvaluationSheetArchiveService.createRenamedSheetTitle("旧名～ 10/29", "新名"),
    "新名～ 10/29",
  );
  assert.equal(
    EvaluationSheetArchiveService.createRenamedSheetTitle("日付なし", "新名"),
    null,
  );
});

test("ユーザーIDで紐づく有効な評価シートを改名し、アーカイブ状態を戻す", async (t) => {
  let sql = "";
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (query, params) => {
      sql = query;
      assert.deepEqual(params, ["target"]);
      return [[
        { forum_id: "forum-1", thread_id: "thread-1" },
        { forum_id: "forum-2", thread_id: "thread-2" },
      ]];
    },
    release() {},
  }));

  const calls = [];
  const threads = new Map([
    ["thread-1", {
      name: "旧名〜10/29",
      archived: false,
      isThread: () => true,
      async setName(name) { calls.push(["name", "thread-1", name]); this.name = name; },
      async setArchived(value) { calls.push(["archive", "thread-1", value]); this.archived = value; },
    }],
    ["thread-2", {
      name: "旧名〜10/29",
      archived: true,
      isThread: () => true,
      async setName(name) { calls.push(["name", "thread-2", name]); this.name = name; },
      async setArchived(value) { calls.push(["archive", "thread-2", value]); this.archived = value; },
    }],
  ]);
  const client = { channels: { fetch: async (id) => threads.get(id) } };

  const count = await EvaluationSheetArchiveService.renameActiveSheetTitles(
    client,
    "target",
    "新名",
  );

  assert.equal(count, 2);
  assert.equal(threads.get("thread-1").name, "新名〜10/29");
  assert.equal(threads.get("thread-1").archived, false);
  assert.equal(threads.get("thread-2").name, "新名〜10/29");
  assert.equal(threads.get("thread-2").archived, true);
  assert.deepEqual(calls, [
    ["name", "thread-1", "新名〜10/29"],
    ["archive", "thread-2", false],
    ["name", "thread-2", "新名〜10/29"],
    ["archive", "thread-2", true],
  ]);
  assert.match(sql, /c\.user_id = \?/);
  assert.match(sql, /c\.status = 'active'/);
  assert.match(sql, /s\.status = 'active'/);
});

test("旅人の名前変更時に評価シート名も同期する", async (t) => {
  const client = {};
  const target = memberWithRoles(
    [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN],
    {
      id: "target",
      user: { id: "target" },
      client,
      async setNickname(name) { this.displayName = name; },
    },
  );
  const interaction = {
    guild: { members: { cache: new Map([["target", target]]) } },
    user: { id: "operator" },
  };
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (sql) => sql.startsWith("SELECT")
      ? [[{ user_name: "旧口座名" }]]
      : [{ affectedRows: 1 }],
    release() {},
  }));
  const rename = t.mock.method(
    EvaluationSheetArchiveService,
    "renameActiveSheetTitles",
    async () => 4,
  );
  t.mock.method(ActionService, "createActionLogMessage", async () => undefined);

  const result = await ChangeNameService.changeName(interaction, "target", "新名");

  assert.deepEqual(result, { evaluationSheetRenamedCount: 4 });
  assert.equal(rename.mock.callCount(), 1);
  assert.deepEqual(rename.mock.calls[0].arguments, [client, "target", "新名"]);
});

test("評価シートの同期に失敗したらDiscord表示名と口座名を復元する", async (t) => {
  const nicknameChanges = [];
  const accountNameChanges = [];
  const target = memberWithRoles(
    [ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN],
    {
      id: "target",
      user: { id: "target" },
      nickname: "旧ニックネーム",
      client: {},
      async setNickname(name) {
        nicknameChanges.push(name);
        this.nickname = name;
        this.displayName = name ?? "username";
      },
    },
  );
  const interaction = {
    guild: { members: { cache: new Map([["target", target]]) } },
    user: { id: "operator" },
  };
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (sql, params) => {
      if (sql.startsWith("SELECT")) return [[{ user_name: "旧口座名" }]];
      accountNameChanges.push(params[0]);
      return [{ affectedRows: 1 }];
    },
    release() {},
  }));
  t.mock.method(
    EvaluationSheetArchiveService,
    "renameActiveSheetTitles",
    async () => { throw new Error("同期失敗"); },
  );
  const actionLog = t.mock.method(ActionService, "createActionLogMessage", async () => undefined);

  await assert.rejects(
    ChangeNameService.changeName(interaction, "target", "新名"),
    /同期失敗/,
  );

  assert.deepEqual(nicknameChanges, ["新名", "旧ニックネーム"]);
  assert.deepEqual(accountNameChanges, ["新名", "旧口座名"]);
  assert.equal(actionLog.mock.callCount(), 0);
});
