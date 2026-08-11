const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ActionService,
  resolveActionLogThreadId,
} = require("../dist/service/actionService.js");
const {
  COMMAND_NAMES,
  PANEL_COMMAND_NAMES,
} = require("../dist/constant/command.js");
const { THREAD_IDS } = require("../dist/constant/id.js");

test("admin mint and burn logs use the shared grant and revoke log thread", () => {
  const grantAndRevokeLogThreadId = THREAD_IDS.MINT_LOG_THREAD;

  assert.equal(
    resolveActionLogThreadId(PANEL_COMMAND_NAMES.ADMIN_MINT),
    grantAndRevokeLogThreadId,
  );
  assert.equal(
    resolveActionLogThreadId(PANEL_COMMAND_NAMES.ADMIN_BURN),
    grantAndRevokeLogThreadId,
  );
});

test("salary logs use the salary log thread", () => {
  assert.equal(
    resolveActionLogThreadId(COMMAND_NAMES.PAY_SALARY),
    THREAD_IDS.SHOP_SALARY_LOG_THREAD,
  );
});

test("server boost reward logs use the salary log thread", () => {
  assert.equal(
    resolveActionLogThreadId(COMMAND_NAMES.SERVER_BOOST),
    THREAD_IDS.SHOP_SALARY_LOG_THREAD,
  );
});

test("creator emblem payments use the dedicated creator log thread", () => {
  assert.equal(
    resolveActionLogThreadId(PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY),
    THREAD_IDS.CREATOR_EMBLEM_LOG_THREAD,
  );
});

test("salary action log messages are sent to the salary log thread", async () => {
  const sentMessages = [];
  const fetchedThreadIds = [];
  const thread = {
    isThread: () => true,
    isTextBased: () => true,
    send: async (message) => {
      sentMessages.push(message);
    },
  };
  const context = {
    client: {
      channels: {
        fetch: async (threadId) => {
          fetchedThreadIds.push(threadId);
          return thread;
        },
      },
    },
  };

  await ActionService.createActionLogMessage(
    context,
    COMMAND_NAMES.PAY_SALARY,
    5000,
    "1521705594912772227",
    "123456789012345678",
    "2026/7 銀行スタッフの給与振込",
  );

  assert.deepEqual(fetchedThreadIds, [THREAD_IDS.SHOP_SALARY_LOG_THREAD]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /^\*\*給与支払い\*\*/);
  assert.match(sentMessages[0], /<@1521705594912772227>から<@123456789012345678>に5,000/);
  assert.match(sentMessages[0], /備考: 2026\/7 銀行スタッフの給与振込/);
});

test("server boost reward messages identify the reward", async () => {
  const sentMessages = [];
  const thread = {
    isThread: () => true,
    isTextBased: () => true,
    send: async (message) => sentMessages.push(message),
  };
  const context = {
    client: { channels: { fetch: async () => thread } },
  };

  await ActionService.createActionLogMessage(
    context,
    COMMAND_NAMES.SERVER_BOOST,
    30000,
    "1521705594912772227",
    "123456789012345678",
    "サーバーブースト2回目の報酬",
  );

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /^\*\*サーバーブースト報酬\*\*/);
  assert.match(sentMessages[0], /<@123456789012345678>に30,000/);
});

test("change name logs use the change name log thread", () => {
  assert.equal(
    resolveActionLogThreadId(COMMAND_NAMES.CHANGE_NAME),
    THREAD_IDS.CHANGE_NAME_LOG_THREAD,
  );
});

test("change name action log messages are sent to the change name log thread", async () => {
  const sentMessages = [];
  const fetchedThreadIds = [];
  const thread = {
    isThread: () => true,
    isTextBased: () => true,
    send: async (message) => {
      sentMessages.push(message);
    },
  };
  const context = {
    client: {
      channels: {
        fetch: async (threadId) => {
          fetchedThreadIds.push(threadId);
          return thread;
        },
      },
    },
  };

  await ActionService.createActionLogMessage(
    context,
    COMMAND_NAMES.CHANGE_NAME,
    0,
    "987654321098765432",
    "123456789012345678",
    JSON.stringify({ oldName: "旧名", newName: "新名" }),
  );

  assert.deepEqual(fetchedThreadIds, [THREAD_IDS.CHANGE_NAME_LOG_THREAD]);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /^\*\*表示名変更\*\*/);
  assert.match(sentMessages[0], /実行者: <@987654321098765432>/);
  assert.match(sentMessages[0], /対象者: <@123456789012345678>/);
  assert.match(sentMessages[0], /旧名 → 新名/);
});
