const test = require("node:test");
const assert = require("node:assert/strict");

const { AccountService } = require("../dist/service/accountService.js");
const { CheckNameService } = require("../dist/service/checkNameService.js");
const { OpenAccountService } = require("../dist/service/openAccountService.js");

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

  AccountService.hasAccount = async (userId) => {
    assert.equal(userId, "user-id");
    return false;
  };
  AccountService.validateName = async (name) => {
    validatedNames.push(name);
  };

  try {
    await OpenAccountService.openAccountValidate({
      id: "user-id",
      displayName: "萌えなの、",
    });
  } finally {
    AccountService.hasAccount = originalHasAccount;
    AccountService.validateName = originalValidateName;
  }

  assert.deepEqual(validatedNames, ["萌えなの、"]);
});
