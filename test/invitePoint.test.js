const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canManageInvitePoints,
} = require("../dist/service/invitePointService.js");
const { INVITE_POINT_GACHA_COST } = require("../dist/constant/invitePoint.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

function memberWithRoles(roleIds) {
  return {
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

test("招待ポイント追加は指定されたショップ運営ロールに許可される", () => {
  const allowedRoles = [
    ROLE_IDS.GIJUTU_LEADER,
    ROLE_IDS.SABANUSI,
    ROLE_IDS.KANRISYA,
    ROLE_IDS.SHOP_LEADER,
    ROLE_IDS.SHOP_STAFF,
  ];

  for (const roleId of allowedRoles) {
    assert.equal(canManageInvitePoints(memberWithRoles([roleId])), true);
  }
});

test("招待ポイント追加は無関係なロールに許可しない", () => {
  assert.equal(
    canManageInvitePoints(memberWithRoles([ROLE_IDS.GAME_STAFF])),
    false,
  );
});

test("招待ポイントガチャは1pt消費する", () => {
  assert.equal(INVITE_POINT_GACHA_COST, 1);
});
