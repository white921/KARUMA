const test = require("node:test");
const assert = require("node:assert/strict");

const { RankingService } = require("../dist/service/ranking.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

function guildWithRoles(roleIds) {
  return {
    members: {
      fetch: async () => ({
        roles: {
          cache: {
            has: (roleId) => roleIds.includes(roleId),
          },
        },
      }),
    },
  };
}

test("ランキングは技術統括ロールに許可される", async () => {
  await assert.doesNotReject(() =>
    RankingService.validateRanking(
      guildWithRoles([ROLE_IDS.GIJUTU_LEADER]),
      "technical-director",
    ),
  );
});

test("ランキングは許可ロールがないユーザーに拒否される", async () => {
  await assert.rejects(
    () => RankingService.validateRanking(guildWithRoles([]), "member"),
    /ランキング表示権限がありません。/,
  );
});
