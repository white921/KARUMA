const assert = require("node:assert/strict");
const test = require("node:test");

const { AccountService } = require("../dist/service/accountService.js");
const { DbService } = require("../dist/service/dbService.js");
const { ROLE_IDS } = require("../dist/constant/id.js");
const {
  ReturnMemberService,
} = require("../dist/service/returnMemberService.js");

test("サブ垢が脱退したら紐づけだけを削除する", async () => {
  const originalGetConnection = DbService.getConnection;
  const executed = [];
  const connection = {
    execute: async (sql, values) => {
      executed.push({ sql, values });
      return [{ affectedRows: 1 }];
    },
    release: () => {},
  };
  DbService.getConnection = async () => connection;

  try {
    await AccountService.handleMemberLeft({
      id: "sub-user-id",
      displayName: "sub user",
      roles: { cache: new Map() },
    });

    assert.deepEqual(executed, [
      {
        sql: "DELETE FROM sub_accounts WHERE sub_user_id = ?",
        values: ["sub-user-id"],
      },
    ]);
  } finally {
    DbService.getConnection = originalGetConnection;
  }
});

test("通常メンバーが脱退したら残高を履歴へ保存してから0にする", async () => {
  const originalGetConnection = DbService.getConnection;
  const executed = [];
  const connection = {
    execute: async (sql, values) => {
      executed.push({ sql, values });
      return [{ affectedRows: 0 }];
    },
    release: () => {},
  };
  DbService.getConnection = async () => connection;

  try {
    await AccountService.handleMemberLeft({
      id: "regular-user-id",
      displayName: "regular user",
      roles: {
        cache: new Map([[ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, {}]]),
      },
    });

    assert.equal(executed.length, 2);
    assert.match(executed[1].sql, /SET left_wallet = wallet,\s+wallet = 0,/);
    assert.deepEqual(executed[1].values, [
      "regular user",
      ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
      "regular-user-id",
    ]);
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
