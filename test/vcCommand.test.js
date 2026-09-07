const test = require("node:test");
const assert = require("node:assert/strict");

const { data } = require("../dist/command/vc.js");
const { COMMAND_NAMES } = require("../dist/constant/command.js");
const { GAME_VC } = require("../dist/constant/game.js");
const { HOTEL_TYPE } = require("../dist/constant/hotel.js");
const { ChannelType } = require("discord.js");
const { DbService } = require("../dist/service/dbService.js");
const {
  VcService,
  isUserEditableGameOrHotelVcType,
} = require("../dist/service/vcService.js");

const originalGetConnection = DbService.getConnection;

function createInteraction({ userId = "owner", channel }) {
  return {
    user: { id: userId },
    guild: {
      members: {
        fetch: async () => ({ voice: { channel } }),
      },
    },
  };
}

function createVoiceChannel() {
  return {
    id: "vc-id",
    type: ChannelType.GuildVoice,
    name: "before",
    userLimit: 2,
    async setName(name) {
      this.name = name;
    },
    async setUserLimit(limit) {
      this.userLimit = limit;
    },
  };
}

function mockActiveVc(row) {
  DbService.getConnection = async () => ({
    execute: async () => [[row]],
    release: () => {},
  });
}

test.afterEach(() => {
  DbService.getConnection = originalGetConnection;
});

test("vc command exposes name and member-limit changes", () => {
  const command = data.toJSON();

  assert.equal(command.name, COMMAND_NAMES.VC);
  assert.deepEqual(
    command.options.map((option) => option.name),
    ["name", "limit"],
  );
  assert.equal(command.options[0].options[0].name, "new_name");
  assert.equal(command.options[1].options[0].name, "members");
  assert.equal(command.options[1].options[0].min_value, 1);
  assert.equal(command.options[1].options[0].max_value, 99);
});

test("only bot-created game and hotel VC types are user-editable", () => {
  assert.equal(isUserEditableGameOrHotelVcType(GAME_VC.TYPE), true);
  for (const type of Object.values(HOTEL_TYPE)) {
    assert.equal(isUserEditableGameOrHotelVcType(type), true);
  }
  assert.equal(isUserEditableGameOrHotelVcType("TELEPORT"), false);
  assert.equal(isUserEditableGameOrHotelVcType("SOLITARY_CELL"), false);
});

test("VC owner can rename an active game VC from inside the channel", async () => {
  const channel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: GAME_VC.TYPE });

  const name = await VcService.changeOwnedGameOrHotelVcName(
    createInteraction({ channel }),
    "  まったりゲーム  ",
  );

  assert.equal(name, "まったりゲーム");
  assert.equal(channel.name, "まったりゲーム");
});

test("non-owner cannot change a bot-created game or hotel VC", async () => {
  const channel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: GAME_VC.TYPE });

  await assert.rejects(
    VcService.changeOwnedGameOrHotelVcLimit(
      createInteraction({ userId: "guest", channel }),
      5,
    ),
    /作成者のみ/,
  );
  assert.equal(channel.userLimit, 2);
});

test("owner can change a hotel VC limit, but teleport VC is excluded", async () => {
  const hotelChannel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: HOTEL_TYPE.FREEDOM });
  await VcService.changeOwnedGameOrHotelVcLimit(
    createInteraction({ channel: hotelChannel }),
    12,
  );
  assert.equal(hotelChannel.userLimit, 12);

  const teleportChannel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: "TELEPORT" });
  await assert.rejects(
    VcService.changeOwnedGameOrHotelVcName(
      createInteraction({ channel: teleportChannel }),
      "対象外",
    ),
    /ゲームVCまたはホテルVC/,
  );
  assert.equal(teleportChannel.name, "before");
});
