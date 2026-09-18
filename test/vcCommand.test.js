const test = require("node:test");
const assert = require("node:assert/strict");

const { data } = require("../dist/command/vc/vc.js");
const { COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { GAME_VC } = require("../dist/constant/game/game.js");
const { HOTEL_TYPE } = require("../dist/constant/hotel/hotel.js");
const { SOLITARY_CELL } = require("../dist/constant/vc/solitaryCell.js");
const { TELEPORT_TYPE } = require("../dist/constant/vc/vc.js");
const { CATEGORY_IDS } = require("../dist/constant/shared/id.js");
const { ChannelType } = require("discord.js");
const { DbService } = require("../dist/service/system/dbService.js");
const {
  VcService,
  isUserEditableManagedVc,
} = require("../dist/service/vc/vcService.js");

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

test("room-name command exposes only a new name option", () => {
  const command = data.toJSON();

  assert.equal(command.name, COMMAND_NAMES.ROOM_NAME_CHANGE);
  assert.deepEqual(command.options.map((option) => option.name), ["new_name"]);
  assert.equal(command.options[0].required, true);
});

test("only requested bot-created VC types are user-editable", () => {
  assert.equal(isUserEditableManagedVc(GAME_VC.TYPE, CATEGORY_IDS.GAME), true);
  for (const type of Object.values(HOTEL_TYPE)) {
    assert.equal(isUserEditableManagedVc(type, CATEGORY_IDS.HOTEL), true);
  }
  assert.equal(
    isUserEditableManagedVc(SOLITARY_CELL.TYPE, CATEGORY_IDS.SOLITARY),
    true,
  );
  assert.equal(
    isUserEditableManagedVc(TELEPORT_TYPE.TELEPORT, CATEGORY_IDS.HAZAMA),
    true,
  );
  assert.equal(
    isUserEditableManagedVc(TELEPORT_TYPE.TELEPORT, CATEGORY_IDS.CASINO),
    false,
  );
});

test("VC owner can rename an active game VC from inside the channel", async () => {
  const channel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: GAME_VC.TYPE });

  const name = await VcService.changeOwnedManagedVcName(
    createInteraction({ channel }),
    "  まったりゲーム  ",
  );

  assert.equal(name, "まったりゲーム");
  assert.equal(channel.name, "まったりゲーム");
});

test("non-owner cannot change a bot-created managed VC", async () => {
  const channel = createVoiceChannel();
  mockActiveVc({ owner_id: "owner", type: GAME_VC.TYPE });

  await assert.rejects(
    VcService.changeOwnedManagedVcName(
      createInteraction({ userId: "guest", channel }),
      "変更不可",
    ),
    /作成者のみ/,
  );
  assert.equal(channel.name, "before");
});

test("teleport VC outside the requested categories is excluded", async () => {
  const teleportChannel = createVoiceChannel();
  teleportChannel.parentId = CATEGORY_IDS.CASINO;
  mockActiveVc({ owner_id: "owner", type: TELEPORT_TYPE.TELEPORT });
  await assert.rejects(
    VcService.changeOwnedManagedVcName(
      createInteraction({ channel: teleportChannel }),
      "対象外",
    ),
    /ゲーム・ホテル・独房・狭間/,
  );
  assert.equal(teleportChannel.name, "before");
});
