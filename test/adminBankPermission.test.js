const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasAdminBankPanelPermission,
} = require("../dist/util/adminPermission.js");
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

test("admin bank panel permission allows technical director role", async () => {
  const member = memberWithRoles([ROLE_IDS.GIJUTU_LEADER]);

  assert.equal(await hasAdminBankPanelPermission(member), true);
});

test("admin bank panel permission allows existing admin bank roles", async () => {
  assert.equal(
    await hasAdminBankPanelPermission(memberWithRoles([ROLE_IDS.GINKOU_LEADER])),
    true,
  );
  assert.equal(
    await hasAdminBankPanelPermission(memberWithRoles([ROLE_IDS.KANRISYA])),
    true,
  );
  assert.equal(
    await hasAdminBankPanelPermission(memberWithRoles([ROLE_IDS.SABANUSI])),
    true,
  );
});

test("admin bank panel permission denies unrelated roles", async () => {
  const member = memberWithRoles([ROLE_IDS.SHOP_LEADER]);

  assert.equal(await hasAdminBankPanelPermission(member), false);
});
