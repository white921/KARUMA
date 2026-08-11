const test = require("node:test");
const assert = require("node:assert/strict");

const {
  copyRoleFromMainToSub,
  removeRolesExcept,
} = require("../dist/util/role.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

const GUILD_ID = "guild-id";

test("LEVELIAでは寝落ち△とエロイプ△を廃止する", () => {
  assert.equal("NEOTISANKAKU" in ROLE_IDS.BASIC_ROLE_IDS, false);
  assert.equal("R18SANKAKU" in ROLE_IDS.BASIC_ROLE_IDS, false);
});

test("罪人ロールをLEVELIAの基本ロールとして設定する", () => {
  assert.equal(
    ROLE_IDS.CORE_MEMBER_ROLES.SINNIN,
    "1534645004457476288",
  );
});

function createMember(roleDefinitions) {
  const roles = new Map(
    roleDefinitions.map(({ id, managed = false }) => [id, { id, managed }]),
  );

  return {
    guild: { id: GUILD_ID },
    roles: {
      cache: {
        has: (roleId) => roles.has(roleId),
        values: () => roles.values(),
      },
      add: async (roleId) => roles.set(roleId, { id: roleId, managed: false }),
      remove: async (roleId) => roles.delete(roleId),
    },
    roleIds: () => [...roles.keys()],
  };
}

test("サブ垢の基本ロールは整理時に保持する", async () => {
  const basicRoleId = ROLE_IDS.BASIC_ROLE_IDS.OSU;
  const member = createMember([
    { id: GUILD_ID },
    { id: basicRoleId },
    { id: "legacy-role" },
  ]);

  await removeRolesExcept(member);

  assert.deepEqual(member.roleIds().sort(), [GUILD_ID, basicRoleId].sort());
});

test("本垢の同期対象ロールのみサブ垢へコピーする", async () => {
  const mainMember = createMember([
    { id: GUILD_ID },
    { id: ROLE_IDS.BASIC_ROLE_IDS.OSU },
    { id: "member-role" },
    { id: ROLE_IDS.KANRISYA },
    { id: ROLE_IDS.GAME_PASS },
  ]);
  const subMember = createMember([{ id: GUILD_ID }]);

  await copyRoleFromMainToSub(mainMember, subMember);

  assert.deepEqual(subMember.roleIds().sort(), [GUILD_ID, "member-role"].sort());
});
