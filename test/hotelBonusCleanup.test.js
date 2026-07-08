const test = require("node:test");
const assert = require("node:assert/strict");

const { HOTEL_TYPE } = require("../dist/constant/hotel.js");
const { HotelVcService } = require("../dist/service/hotelVcService.js");
const { DbService } = require("../dist/service/dbService.js");

const originals = {
  getConnection: DbService.getConnection,
  dateNow: Date.now,
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

function createMember({ isBot, id }) {
  return {
    id,
    user: {
      bot: isBot,
    },
    disconnected: false,
    voice: {
      async disconnect() {
        this.member.disconnected = true;
      },
    },
  };
}

function createMembersCollection(members) {
  return {
    filter(predicate) {
      return createMembersCollection(members.filter(predicate));
    },
    get size() {
      return members.length;
    },
    values() {
      return members.values();
    },
  };
}

function createVoiceChannel(id, members = []) {
  for (const member of members) {
    member.voice.member = member;
  }

  return {
    id,
    members: createMembersCollection(members),
    deleted: false,
    async delete() {
      this.deleted = true;
    },
  };
}

test.afterEach(() => {
  DbService.getConnection = originals.getConnection;
  Date.now = originals.dateNow;
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

test("disconnects bots from an empty paid hotel VC", async () => {
  const statements = [];
  const botMember = createMember({ id: "music-bot", isBot: true });
  const channel = createVoiceChannel("1122334455", [botMember]);
  DbService.getConnection = async () =>
    createConnection([{ is_bonus: false }], statements);

  const disconnectedCount =
    await HotelVcService.disconnectBotsFromEmptyPaidHotelVc(channel);

  assert.equal(disconnectedCount, 1);
  assert.equal(botMember.disconnected, true);
  assert.equal(channel.deleted, false);
});

test("does not disconnect bots from a paid hotel VC while a human remains", async () => {
  const statements = [];
  const botMember = createMember({ id: "music-bot", isBot: true });
  const humanMember = createMember({ id: "human", isBot: false });
  const channel = createVoiceChannel("2233445566", [botMember, humanMember]);
  DbService.getConnection = async () =>
    createConnection([{ is_bonus: false }], statements);

  const disconnectedCount =
    await HotelVcService.disconnectBotsFromEmptyPaidHotelVc(channel);

  assert.equal(disconnectedCount, 0);
  assert.equal(botMember.disconnected, false);
  assert.equal(statements.length, 0);
});

test("does not disconnect bots from a bonus hotel VC because the channel is deleted instead", async () => {
  const statements = [];
  const botMember = createMember({ id: "music-bot", isBot: true });
  const channel = createVoiceChannel("3344556677", [botMember]);
  DbService.getConnection = async () =>
    createConnection([{ is_bonus: true }], statements);

  const disconnectedCount =
    await HotelVcService.disconnectBotsFromEmptyPaidHotelVc(channel);

  assert.equal(disconnectedCount, 0);
  assert.equal(botMember.disconnected, false);
});

test("VIP and freedom hotel short durations expire after one minute", () => {
  assert.equal(HotelVcService.getHotelVcDurationMinutes(HOTEL_TYPE.SECRET), 1);
  assert.equal(HotelVcService.getHotelVcDurationMinutes(HOTEL_TYPE.FREEDOM), 1);
});

test("VIP and freedom hotel long durations expire after two minutes", () => {
  assert.equal(HotelVcService.getHotelVcDurationMinutes(HOTEL_TYPE.SECRETLONG), 2);
  assert.equal(HotelVcService.getHotelVcDurationMinutes(HOTEL_TYPE.FREEDOMLONG), 2);
});

test("short paid VIP and freedom hotel records expire one minute after creation", async () => {
  const now = new Date("2026-01-01T00:00:00.000Z").getTime();
  Date.now = () => now;
  const statements = [];
  DbService.getConnection = async () => createConnection([], statements);

  await HotelVcService.insertIntoVcs("short-vip", "111", HOTEL_TYPE.SECRET, false, false);
  await HotelVcService.insertIntoVcs("short-freedom", "111", HOTEL_TYPE.FREEDOM, false, false);

  const insertParams = statements
    .filter(({ sql }) => sql.includes("INSERT INTO vcs"))
    .map(({ params }) => params);

  assert.equal(insertParams.length, 2);
  for (const params of insertParams) {
    assert.equal(params[6].getTime(), now + 60 * 1000);
  }
});

test("long paid VIP and freedom hotel records expire two minutes after creation", async () => {
  const now = new Date("2026-01-01T00:00:00.000Z").getTime();
  Date.now = () => now;
  const statements = [];
  DbService.getConnection = async () => createConnection([], statements);

  await HotelVcService.insertIntoVcs(
    "long-vip",
    "111",
    HOTEL_TYPE.SECRETLONG,
    false,
    false,
  );
  await HotelVcService.insertIntoVcs(
    "long-freedom",
    "111",
    HOTEL_TYPE.FREEDOMLONG,
    false,
    false,
  );

  const insertParams = statements
    .filter(({ sql }) => sql.includes("INSERT INTO vcs"))
    .map(({ params }) => params);

  assert.equal(insertParams.length, 2);
  for (const params of insertParams) {
    assert.equal(params[6].getTime(), now + 2 * 60 * 1000);
  }
});

test("expired hotel VC checker deletes expired channels and marks them inactive", async () => {
  const statements = [];
  const channel = createVoiceChannel("4455667788");
  DbService.getConnection = async () => ({
    execute: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes("expire_at <= NOW()")) {
        return [[{ channel_id: channel.id }]];
      }
      return [{}];
    },
    release: () => {},
  });
  const client = {
    channels: {
      fetch: async (channelId) => {
        assert.equal(channelId, channel.id);
        return channel;
      },
    },
  };

  await HotelVcService.deleteExpiredVcs(client);

  assert.equal(channel.deleted, true);
  assert.match(statements[0].sql, /expire_at <= NOW\(\)/);
  assert.match(statements[1].sql, /UPDATE vcs SET is_active = \?/);
  assert.deepEqual(statements[1].params, [false, channel.id]);
});
