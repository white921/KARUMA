const test = require("node:test");
const assert = require("node:assert/strict");
const { DiscordAPIError, RESTJSONErrorCodes } = require("discord.js");

const { AccountService } = require("../dist/service/account/accountService.js");
const { CheckNameService } = require("../dist/service/evaluation/checkNameService.js");
const { OpenAccountService } = require("../dist/service/account/openAccountService.js");
const { ACCOUNT_MESSAGES } = require("../dist/constant/account/account.js");

function discordError(code, status = 404) {
  return new DiscordAPIError({ message: "Discord error", code }, code, status,
    "GET", "https://discord.com/api/v10/guilds/guild/members/user", {});
}

test("同名口座の持ち主は退出中だけ対象外となり、再参加すると重複になる", async (t) => {
  let present = true;
  t.mock.method(AccountService, "getAccountByName", async () => [
    { user_id: "existing-user", user_name: "山田太郎" },
  ]);
  const guild = { members: {
    // 古いキャッシュが残っていてもAPIの在籍結果で判定する。
    cache: new Map([["existing-user", {}]]),
    fetch: async (options) => {
      assert.deepEqual(options, { user: "existing-user", force: true });
      if (!present) throw discordError(RESTJSONErrorCodes.UnknownMember);
      return { id: "existing-user" };
    },
  } };

  await assert.rejects(AccountService.validateName("山田太郎", guild),
    { message: ACCOUNT_MESSAGES.ACCOUNT_NAME_SAME });
  present = false;
  await assert.doesNotReject(AccountService.validateName("山田太郎", guild));
  present = true;
  await assert.rejects(AccountService.validateName("山田太郎", guild),
    { message: ACCOUNT_MESSAGES.ACCOUNT_NAME_SAME });
});

test("同名の退出者がいても、別の同名在籍者を見落とさない", async (t) => {
  t.mock.method(AccountService, "getAccountByName", async () => [
    { user_id: "left-user" }, { user_id: "present-user" },
  ]);
  const guild = { members: { fetch: async ({ user }) => {
    if (user === "left-user") throw discordError(RESTJSONErrorCodes.UnknownMember);
    return { id: user };
  } } };
  await assert.rejects(AccountService.validateName("山田太郎", guild),
    { message: ACCOUNT_MESSAGES.ACCOUNT_NAME_SAME });
});

test("在籍確認の通信・権限エラーを退出とみなさない", async (t) => {
  t.mock.method(AccountService, "getAccountByName", async () => [{ user_id: "user" }]);
  for (const error of [new Error("network failure"), discordError(50013, 403), discordError(10004)]) {
    const guild = { members: { fetch: async () => { throw error; } } };
    await assert.rejects(AccountService.validateName("山田太郎", guild),
      (actual) => actual === error);
  }
});

test("名前変更では自分の口座を除き、他の同名口座の在籍を確認する", async (t) => {
  t.mock.method(AccountService, "getAccountByName", async () => assert.fail("自身を除外する検索が必要"));
  t.mock.method(AccountService, "getAccountsByNameExceptUserId", async (name, userId) => {
    assert.equal(name, "山田太郎");
    assert.equal(userId, "self");
    return [{ user_id: "left-user" }];
  });
  const guild = { members: { fetch: async ({ user }) => {
    assert.equal(user, "left-user");
    throw discordError(RESTJSONErrorCodes.UnknownMember);
  } } };
  await assert.doesNotReject(AccountService.validateName("山田太郎", guild, "self"));
});

test("同名口座がなければDiscordへの在籍確認は不要", async (t) => {
  t.mock.method(AccountService, "getAccountByName", async () => []);
  const guild = { members: { fetch: async () => assert.fail("不要な在籍確認") } };
  await assert.doesNotReject(AccountService.validateName("山田太郎", guild));
});

test("名前には文字・数字と許可された記号だけを使用できる", () => {
  assert.doesNotThrow(() => AccountService.validateNameFormat("山田太郎123"));
  assert.doesNotThrow(() => AccountService.validateNameFormat("山田！？、ー"));
  assert.throws(() => AccountService.validateNameFormat("！！"));
  assert.throws(() => AccountService.validateNameFormat("、ー"));
  assert.throws(() => AccountService.validateNameFormat("山田 太郎"));
  assert.throws(() => AccountService.validateNameFormat("山田-太郎"));
  assert.throws(() => AccountService.validateNameFormat("山田😀"));
});

test("同名の人間ユーザーだけを検知する", () => {
  const target = { id: "target", displayName: "山田太郎", user: { bot: false } };
  const duplicateBot = { id: "bot", displayName: "山田太郎", user: { bot: true } };
  const duplicatePerson = { id: "person", displayName: "山田太郎", user: { bot: false } };

  assert.equal(
    CheckNameService.findDuplicateDisplayName(target, [target, duplicateBot]),
    undefined,
  );
  assert.equal(
    CheckNameService.findDuplicateDisplayName(target, [target, duplicatePerson]),
    duplicatePerson,
  );
});

test("口座開設の事前検証はサーバー表示名を使う", async () => {
  const originalHasAccount = AccountService.hasAccount;
  const originalValidateName = AccountService.validateName;
  const validatedNames = [];
  const guild = { id: "guild" };

  AccountService.hasAccount = async (userId) => {
    assert.equal(userId, "user-id");
    return false;
  };
  AccountService.validateName = async (name, actualGuild) => {
    assert.equal(actualGuild, guild);
    validatedNames.push(name);
  };

  try {
    await OpenAccountService.openAccountValidate({
      id: "user-id",
      displayName: "萌えなの、",
      guild,
    });
  } finally {
    AccountService.hasAccount = originalHasAccount;
    AccountService.validateName = originalValidateName;
  }

  assert.deepEqual(validatedNames, ["萌えなの、"]);
});
