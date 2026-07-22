const assert = require("node:assert/strict");
const test = require("node:test");

const { AccountService } = require("../dist/service/accountService.js");
const { DbService } = require("../dist/service/dbService.js");

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
