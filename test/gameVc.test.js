const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");
const { PermissionsBitField } = require("discord.js");

const { ROLE_IDS } = require("../dist/constant/id.js");
const { GAME_VC } = require("../dist/constant/game.js");
const {
  getGameVcTier,
  canPurchaseGamePass,
  calculateGamePassExpireAt,
  buildGameVcCreateConfirmationDescription,
  createGameVcPermissionOverwrites,
} = require("../dist/service/gameVcService.js");

function memberWithRoles(roleIds) {
  return { roles: { cache: { has: (roleId) => roleIds.includes(roleId) } } };
}

test("game VC prices follow traveler, vacant, criminal, and game-staff rules", () => {
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN])),
    { label: "旅人以上", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN])),
    { label: "空位者", price: GAME_VC.PRICES.VACANT },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI])),
    { label: "罪人", price: GAME_VC.PRICES.CRIMINAL },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.GAME_STAFF])),
    { label: "歓楽師", price: 0 },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.HOTEL_LEADER])),
    { label: "支配人", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE },
  );
});

test("traveler or above and hotel manager can purchase a game pass", () => {
  assert.equal(
    canPurchaseGamePass(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN])),
    true,
  );
  assert.equal(
    canPurchaseGamePass(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN])),
    false,
  );
  assert.equal(canPurchaseGamePass(memberWithRoles([ROLE_IDS.HOTEL_LEADER])), true);
});

test("game VC and its ticket use a 24-hour duration", () => {
  assert.equal(GAME_VC.DURATION_HOURS, 24);
});

test("game VC confirmation omits the creator's role", () => {
  const description = buildGameVcCreateConfirmationDescription(
    { label: "支配人", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE },
    false,
  );

  assert.doesNotMatch(description, /対象ロール|支配人/);
  assert.match(description, /利用時間：24時間/);
  assert.match(description, /料金：\*\*5,000LIA\*\*/);
});

test("game pass periods are two weeks and one calendar month", () => {
  const now = dayjs("2026-09-01T12:00:00+09:00");
  assert.equal(
    calculateGamePassExpireAt("twoWeeks", now).toISOString(),
    "2026-09-15T03:00:00.000Z",
  );
  assert.equal(
    calculateGamePassExpireAt("oneMonth", now).toISOString(),
    "2026-10-01T03:00:00.000Z",
  );
});

test("vacant and criminal roles can use VC chat but cannot connect by role", () => {
  const overwrites = createGameVcPermissionOverwrites("guild-id", "creator-id");
  const vacant = overwrites.find((overwrite) => overwrite.id === ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN);
  const criminal = overwrites.find((overwrite) => overwrite.id === ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI);
  const creator = overwrites.find((overwrite) => overwrite.id === "creator-id");
  const requiredChatPermissions = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.SendVoiceMessages,
    PermissionsBitField.Flags.UseEmbeddedActivities,
  ];

  for (const overwrite of [vacant, criminal, creator]) {
    assert.ok(overwrite);
    for (const permission of requiredChatPermissions) {
      assert.ok(overwrite.allow.includes(permission));
    }
  }
  assert.ok(vacant.deny.includes(PermissionsBitField.Flags.Connect));
  assert.ok(criminal.deny.includes(PermissionsBitField.Flags.Connect));
  assert.ok(creator.allow.includes(PermissionsBitField.Flags.Connect));
});
