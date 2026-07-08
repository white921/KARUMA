const test = require("node:test");
const assert = require("node:assert/strict");

const { HotelVcService } = require("../dist/service/hotelVcService.js");
const { DbService } = require("../dist/service/dbService.js");

const originals = {
  getConnection: DbService.getConnection,
};

function createConnection(rows, statements) {
  return {
    execute: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes("SELECT is_bonus FROM vcs")) {
        return [rows];
      }
      return [{}];
    },
    release: () => {},
  };
}

function createVoiceChannel(id) {
  return {
    id,
    deleted: false,
    async delete() {
      this.deleted = true;
    },
  };
}

test.afterEach(() => {
  DbService.getConnection = originals.getConnection;
});

test("deletes an empty bonus hotel VC immediately and marks it inactive", async () => {
  const statements = [];
  const channel = createVoiceChannel("1234567890");
  DbService.getConnection = async () =>
    createConnection([{ is_bonus: true }], statements);

  const deleted = await HotelVcService.deleteEmptyBonusVcNow(channel);

  assert.equal(deleted, true);
  assert.equal(channel.deleted, true);
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /SELECT is_bonus FROM vcs/);
  assert.deepEqual(statements[0].params, [channel.id]);
  assert.match(statements[1].sql, /UPDATE vcs SET is_active = \?/);
  assert.deepEqual(statements[1].params, [false, channel.id]);
});

test("does not delete a paid hotel VC when it becomes empty", async () => {
  const statements = [];
  const channel = createVoiceChannel("0987654321");
  DbService.getConnection = async () =>
    createConnection([{ is_bonus: false }], statements);

  const deleted = await HotelVcService.deleteEmptyBonusVcNow(channel);

  assert.equal(deleted, false);
  assert.equal(channel.deleted, false);
  assert.equal(statements.length, 1);
});
