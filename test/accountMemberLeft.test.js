const assert = require("node:assert/strict");
const test = require("node:test");

const { AccountService } = require("../dist/service/account/accountService.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { ROLE_IDS } = require("../dist/constant/shared/id.js");
const {
  ReturnMemberService,
} = require("../dist/service/account/returnMemberService.js");

function connectionFixture({
  subAccountRows = 0,
  stateIsPresent = null,
  stateDisplayName = null,
  stateCoreMemberRoleId = null,
} = {}) {
  const executed = [];
  const transactions = [];
  const connection = {
    beginTransaction: async () => transactions.push("begin"),
    commit: async () => transactions.push("commit"),
    rollback: async () => transactions.push("rollback"),
    execute: async (sql, values) => {
      executed.push({ sql, values });
      if (/FROM accounts a\s+LEFT JOIN account_membership_states/.test(sql)) {
        return [[{
          user_id: "regular-user-id",
          user_name: "account name",
          wallet: 12345,
          left_core_member_roles: null,
          state_is_present: stateIsPresent,
          state_joined_at: new Date("2026-09-27T00:00:00.000Z"),
          state_display_name: stateDisplayName,
          state_core_member_role_id: stateCoreMemberRoleId,
        }]];
      }
      if (/DELETE FROM sub_accounts/.test(sql)) {
        return [{ affectedRows: subAccountRows }];
      }
      return [{ affectedRows: 1 }];
    },
    release: () => {},
  };
  return { connection, executed, transactions };
}

test("サブ垢が脱退したら紐づけだけを削除する", async () => {
  const originalGetConnection = DbService.getConnection;
  const { connection, executed, transactions } = connectionFixture({
    subAccountRows: 1,
  });
  DbService.getConnection = async () => connection;

  try {
    const result = await AccountService.handleMemberLeft({
      id: "sub-user-id",
      displayName: "sub user",
      roles: { cache: new Map() },
    });

    assert.equal(result, "sub_account_unlinked");
    assert.deepEqual(transactions, ["begin", "commit"]);
    assert.equal(executed.some(({ sql }) => /UPDATE accounts/.test(sql)), false);
    assert.equal(executed.some(({ sql }) => /DELETE FROM sub_accounts/.test(sql)), true);
    assert.equal(executed.some(({ sql }) => /INSERT INTO account_membership_states/.test(sql)), true);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("通常メンバーが脱退したら残高を履歴へ保存してから0にする", async () => {
  const originalGetConnection = DbService.getConnection;
  const { connection, executed, transactions } = connectionFixture();
  DbService.getConnection = async () => connection;

  try {
    const result = await AccountService.handleMemberLeft({
      id: "regular-user-id",
      displayName: "regular user",
      roles: {
        cache: new Map([[ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, {}]]),
      },
    });

    const accountUpdate = executed.find(({ sql }) => /UPDATE accounts/.test(sql));
    assert.equal(result, "recorded");
    assert.deepEqual(transactions, ["begin", "commit"]);
    assert.match(accountUpdate.sql, /SET left_wallet = wallet,\s+wallet = 0,/);
    assert.deepEqual(accountUpdate.values, [
      "regular user",
      ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
      "regular-user-id",
    ]);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("対象基本ロールがなくても退出回数・残高・日時を記録する", async () => {
  const originalGetConnection = DbService.getConnection;
  const { connection, executed } = connectionFixture();
  DbService.getConnection = async () => connection;
  try {
    const result = await AccountService.handleMemberLeft({
      id: "regular-user-id",
      displayName: "roleless user",
      roles: { cache: new Map() },
    });
    const accountUpdate = executed.find(({ sql }) => /UPDATE accounts/.test(sql));
    assert.equal(result, "recorded");
    assert.deepEqual(accountUpdate.values, ["roleless user", null, "regular-user-id"]);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("partial退出では在籍中に保存した表示名と基本ロールを使う", async () => {
  const originalGetConnection = DbService.getConnection;
  const { connection, executed } = connectionFixture({
    stateIsPresent: 1,
    stateDisplayName: "saved display name",
    stateCoreMemberRoleId: ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
  });
  DbService.getConnection = async () => connection;
  try {
    const result = await AccountService.handleMemberLeft({
      id: "regular-user-id",
      displayName: "uncached username",
      partial: true,
      roles: { cache: new Map() },
    });
    const accountUpdate = executed.find(({ sql }) => /UPDATE accounts/.test(sql));
    assert.equal(result, "recorded");
    assert.deepEqual(accountUpdate.values, [
      "saved display name",
      ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
      "regular-user-id",
    ]);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("同じ退出通知の再送では残高と退出回数を重複更新しない", async () => {
  const originalGetConnection = DbService.getConnection;
  const { connection, executed } = connectionFixture({ stateIsPresent: 0 });
  DbService.getConnection = async () => connection;
  try {
    const result = await AccountService.handleMemberLeft({
      id: "regular-user-id",
      displayName: "regular user",
      roles: { cache: new Map() },
    });
    assert.equal(result, "duplicate");
    assert.equal(executed.length, 1);
    assert.match(executed[0].sql, /FROM accounts a/);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("起動時照合は状態行のない過去の退出口座を自動補正しない", async () => {
  const originalGetConnection = DbService.getConnection;
  const executed = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    execute: async (sql, values) => {
      executed.push({ sql, values });
      if (/FROM account_membership_states\s+WHERE is_present = TRUE/.test(sql)) {
        return [[]];
      }
      return [{ affectedRows: 0 }];
    },
    release: () => {},
  };
  DbService.getConnection = async () => connection;
  try {
    const result = await AccountService.reconcileMembership([]);
    assert.deepEqual(result, { synced: 0, departures: 0 });
    assert.equal(executed.some(({ sql }) => /UPDATE accounts/.test(sql)), false);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("起動時照合は前回在籍中だった不在口座だけを退出処理する", async () => {
  const originalGetConnection = DbService.getConnection;
  const executed = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    execute: async (sql, values) => {
      executed.push({ sql, values });
      if (/FROM account_membership_states\s+WHERE is_present = TRUE/.test(sql)) {
        return [[{ user_id: "regular-user-id" }]];
      }
      if (/FROM accounts a\s+LEFT JOIN account_membership_states/.test(sql)) {
        return [[{
          user_id: "regular-user-id",
          user_name: "account name",
          wallet: 12345,
          left_core_member_roles: null,
          state_is_present: 1,
          state_joined_at: new Date("2026-09-27T00:00:00.000Z"),
          state_display_name: "saved display name",
          state_core_member_role_id: ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
        }]];
      }
      if (/DELETE FROM sub_accounts/.test(sql)) {
        return [{ affectedRows: 0 }];
      }
      return [{ affectedRows: 1 }];
    },
    release: () => {},
  };
  DbService.getConnection = async () => connection;
  try {
    const result = await AccountService.reconcileMembership([]);
    assert.deepEqual(result, { synced: 0, departures: 1 });
    assert.equal(executed.some(({ sql }) => /UPDATE accounts/.test(sql)), true);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("出戻り情報に鯖抜け時の残高を表示する", async () => {
  const originalGetAccountByUserId = AccountService.getAccountByUserId;
  AccountService.getAccountByUserId = async () => [
    {
      user_name: "regular user",
      left_count: 1,
      left_at: new Date("2026-09-09T00:00:00.000Z"),
      left_wallet: 12345,
      left_core_member_roles: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
    },
  ];

  try {
    const embed = await ReturnMemberService.createReturnMemberEmbed({
      id: "regular-user-id",
    });
    const leftWalletField = embed
      .toJSON()
      .fields.find((field) => field.name === "抜けた時の残高");

    assert.equal(leftWalletField.value, "12,345LIA");
  } finally {
    AccountService.getAccountByUserId = originalGetAccountByUserId;
  }
});
