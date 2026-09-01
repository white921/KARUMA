const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");

const { ROLE_IDS } = require("../dist/constant/id.js");
const { GAME_VC } = require("../dist/constant/game.js");
const {
  getGameVcTier,
  canPurchaseGamePass,
  calculateGamePassExpireAt,
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
});

test("only traveler or above can purchase a game pass", () => {
  assert.equal(
    canPurchaseGamePass(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN])),
    true,
  );
  assert.equal(
    canPurchaseGamePass(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN])),
    false,
  );
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
