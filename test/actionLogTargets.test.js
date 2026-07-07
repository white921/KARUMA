const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveActionLogThreadId,
} = require("../dist/service/actionService.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");

test("admin mint and burn logs use the shared grant and revoke log thread", () => {
  const grantAndRevokeLogThreadId = "1521752901448630453";

  assert.equal(
    resolveActionLogThreadId(PANEL_COMMAND_NAMES.ADMIN_MINT),
    grantAndRevokeLogThreadId,
  );
  assert.equal(
    resolveActionLogThreadId(PANEL_COMMAND_NAMES.ADMIN_BURN),
    grantAndRevokeLogThreadId,
  );
});
