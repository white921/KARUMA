const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldSkipReturnMemberRoleChange,
} = require("../dist/handler/roleHandler.js");

test("指定ユーザーは出戻り時のロール付け替え対象外", () => {
  assert.equal(shouldSkipReturnMemberRoleChange("1370974678281097327"), true);
  assert.equal(shouldSkipReturnMemberRoleChange("649438093996195851"), true);
  assert.equal(shouldSkipReturnMemberRoleChange("000000000000000000"), false);
});
