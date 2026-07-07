const test = require("node:test");
const assert = require("node:assert/strict");

const { AccountService } = require("../dist/service/accountService.js");
const { ActionService } = require("../dist/service/actionService.js");
const { AdminBurnService } = require("../dist/service/adminBurnService.js");
const { AdminMintService } = require("../dist/service/adminMintService.js");
const { DbService } = require("../dist/service/dbService.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { BOT_ID } = require("../dist/constant/id.js");
const role = require("../dist/util/role.js");

function createInteraction() {
  const replies = [];

  return {
    user: { id: "111111111111111111" },
    guild: {
      members: {
        fetch: async () => ({
          roles: {
            cache: {
              has: () => true,
            },
          },
        }),
      },
    },
    reply: async (payload) => {
      replies.push(payload);
    },
    editReply: async (payload) => {
      replies.push(payload);
    },
    replies,
  };
}

function stubAdminGrantDependencies() {
  const originals = {
    getAccountByUserId: AccountService.getAccountByUserId,
    isSubAccount: AccountService.isSubAccount,
    executeActionLog: ActionService.executeActionLog,
    getConnection: DbService.getConnection,
    isTechnician: role.isTechnician,
  };

  const executedSql = [];
  const actionLogs = [];
  AccountService.getAccountByUserId = async (userId) => {
    if (userId === BOT_ID) {
      return [];
    }
    return [{ user_id: userId, wallet: 1000 }];
  };
  AccountService.isSubAccount = async () => false;
  ActionService.executeActionLog = async (...args) => {
    actionLogs.push(args);
  };
  DbService.getConnection = async () => ({
    execute: async (...args) => {
      executedSql.push(args);
    },
    release: () => {},
  });
  role.isTechnician = async () => false;

  return {
    actionLogs,
    executedSql,
    restore: () => {
      AccountService.getAccountByUserId = originals.getAccountByUserId;
      AccountService.isSubAccount = originals.isSubAccount;
      ActionService.executeActionLog = originals.executeActionLog;
      DbService.getConnection = originals.getConnection;
      role.isTechnician = originals.isTechnician;
    },
  };
}

test("admin mint writes the action log even when the bot account is missing", async () => {
  const stubs = stubAdminGrantDependencies();
  try {
    const interaction = createInteraction();

    await AdminMintService.mint(
      interaction,
      "222222222222222222",
      500,
      "manual grant",
    );

    assert.equal(stubs.actionLogs.length, 1);
    assert.equal(stubs.actionLogs[0][1], PANEL_COMMAND_NAMES.ADMIN_MINT);
    assert.equal(stubs.actionLogs[0][5], 0);
    assert.equal(stubs.actionLogs[0][6], 1500);
  } finally {
    stubs.restore();
  }
});

test("admin burn writes the action log even when the bot account is missing", async () => {
  const stubs = stubAdminGrantDependencies();
  try {
    const interaction = createInteraction();

    await AdminBurnService.burn(
      interaction,
      "222222222222222222",
      500,
      "manual burn",
    );

    assert.equal(stubs.actionLogs.length, 1);
    assert.equal(stubs.actionLogs[0][1], PANEL_COMMAND_NAMES.ADMIN_BURN);
    assert.equal(stubs.actionLogs[0][5], 500);
    assert.equal(stubs.actionLogs[0][6], 0);
  } finally {
    stubs.restore();
  }
});
