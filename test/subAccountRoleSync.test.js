const test = require("node:test");
const assert = require("node:assert/strict");

const {
  copyRoleFromMainToSub,
  removeRolesExcept,
} = require("../dist/util/role.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

const GUILD_ID = "guild-id";

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
