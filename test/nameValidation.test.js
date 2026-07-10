const test = require("node:test");
const assert = require("node:assert/strict");

const { AccountService } = require("../dist/service/accountService.js");
const { CheckNameService } = require("../dist/service/checkNameService.js");

test("名前には文字と数字だけを使用できる", () => {
  assert.doesNotThrow(() => AccountService.validateNameFormat("山田太郎123"));
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
