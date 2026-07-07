const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertTemporaryTechnicalDirectorOnly,
  canUseTemporaryTechnicalDirectorOnly,
  TEMPORARY_TECHNICAL_DIRECTOR_ONLY_MESSAGE,
} = require("../dist/util/exeCommand.js");
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

test("temporary slash command lock allows technical director role", async () => {
  const member = memberWithRoles([ROLE_IDS.GIJUTU_LEADER]);

  assert.equal(canUseTemporaryTechnicalDirectorOnly(member), true);
  await assert.doesNotReject(() =>
    assertTemporaryTechnicalDirectorOnly({ member }),
  );
});

test("temporary slash command lock denies other roles", async () => {
  const member = memberWithRoles([ROLE_IDS.KANRISYA]);

  assert.equal(canUseTemporaryTechnicalDirectorOnly(member), false);
  await assert.rejects(
    () => assertTemporaryTechnicalDirectorOnly({ member }),
    {
      message: TEMPORARY_TECHNICAL_DIRECTOR_ONLY_MESSAGE,
    },
  );
});
