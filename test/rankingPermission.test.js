const test = require("node:test");
const assert = require("node:assert/strict");

const { RankingService } = require("../dist/service/currency/ranking.js");
const { ROLE_IDS } = require("../dist/constant/shared/id.js");

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

test("残高ランキングは英傑・皇帝・システム支配人の各ロール単独で許可される", async () => {
  for (const roleId of [ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI, ROLE_IDS.GIJUTU_LEADER]) {
    await assert.doesNotReject(() =>
      RankingService.validateRanking(guildWithRoles([roleId]), "operator"),
    );
  }
});

test("残高ランキングは許可ロールがないユーザーに拒否される", async () => {
  for (const roles of [[], [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN], [ROLE_IDS.GINKOU_STAFF]]) {
    await assert.rejects(
      () => RankingService.validateRanking(guildWithRoles(roles), "member"),
      /ランキング表示権限がありません。/,
    );
  }
});
