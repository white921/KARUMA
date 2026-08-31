const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE_IDS, TEXT_CHANNEL_IDS, CATEGORY_IDS } = require("../dist/constant/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { ACTION_TYPES, toActionType } = require("../dist/constant/action.js");
const { SOLITARY_CELL } = require("../dist/constant/solitaryCell.js");
const { SolitaryCellService } = require("../dist/service/solitaryCellService.js");
const { createSolitaryCellPanelActionRow } = require("../dist/service/solitaryCellPanelService.js");
const { resolvePanelInstallTarget, PANEL_INSTALL_TARGETS } = require("../dist/service/panelInstallService.js");
const { HistoryService } = require("../dist/service/historyService.js");

function memberWithRoles(roleIds) {
  return { roles: { cache: { has: (roleId) => roleIds.includes(roleId) } } };
}

test("solitary-cell production IDs point to the configured panel, log, and category", () => {
  assert.equal(TEXT_CHANNEL_IDS.SOLITARY_CELL_PANEL, "1538628582652379216");
  assert.equal(TEXT_CHANNEL_IDS.SOLITARY_CELL_LOG, "1538628611140096061");
  assert.equal(CATEGORY_IDS.DETENTION, "1535323718832623707");
  assert.equal(CATEGORY_IDS.SOLITARY, "1538626959167197275");
});

test("solitary-cell prices follow the detention role tier", () => {
  assert.deepEqual(
    SolitaryCellService.getTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN])),
    { label: "空位者", price: 0 },
  );
  assert.equal(
    SolitaryCellService.getTier(memberWithRoles([ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME])).price,
    10000,
  );
  assert.equal(
    SolitaryCellService.getTier(memberWithRoles([ROLE_IDS.DETENTION_ROLES.MILITARY_CRIME])).price,
    20000,
  );
  assert.equal(
    SolitaryCellService.getTier(memberWithRoles([ROLE_IDS.DETENTION_ROLES.CONSCRIPTION_CRIME])).price,
    30000,
  );
  assert.equal(SOLITARY_CELL.DURATION_HOURS, 12);
  assert.equal(SOLITARY_CELL.USER_LIMIT, 1);
});

test("higher detention tier wins if a member temporarily has multiple tiers", () => {
  assert.equal(
    SolitaryCellService.getTier(
      memberWithRoles([
        ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME,
        ROLE_IDS.DETENTION_ROLES.CONSCRIPTION_CRIME,
      ]),
    ).price,
    30000,
  );
});

test("solitary-cell panel and action history use dedicated identifiers", () => {
  const buttons = createSolitaryCellPanelActionRow().toJSON().components;
  assert.equal(buttons[0].custom_id, PANEL_COMMAND_NAMES.SOLITARY_CELL_CREATE);
  assert.equal(buttons[0].emoji, undefined);
  assert.equal(buttons[1].custom_id, PANEL_COMMAND_NAMES.VIEW);
  assert.equal(buttons[1].emoji, undefined);
  const { SOLITARY_CELL_MESSAGES } = require("../dist/constant/solitaryCell.js");
  assert.match(SOLITARY_CELL_MESSAGES.DESCRIPTION, /召役罪：10,000LIA/);
  assert.match(SOLITARY_CELL_MESSAGES.DESCRIPTION, /従軍罪：20,000LIA/);
  assert.match(SOLITARY_CELL_MESSAGES.DESCRIPTION, /徴兵罪：30,000LIA/);
  assert.doesNotMatch(SOLITARY_CELL_MESSAGES.DESCRIPTION, /（下級|中級|上級）/);
  assert.equal(
    resolvePanelInstallTarget(TEXT_CHANNEL_IDS.SOLITARY_CELL_PANEL),
    PANEL_INSTALL_TARGETS.SOLITARY_CELL,
  );
  assert.equal(
    toActionType(PANEL_COMMAND_NAMES.SOLITARY_CELL_CREATE),
    ACTION_TYPES.SOLITARY_CELL,
  );
});

test("solitary-cell purchases render in account history", () => {
  const history = HistoryService.createHistoryString(
    {
      id: 1,
      command_name: ACTION_TYPES.SOLITARY_CELL,
      amount: 10000,
      from_user_id: "123456789012345678",
      to_user_id: "1521705594912772227",
      from_after_wallet: 90000,
      to_after_wallet: 0,
      comment: "独房作成: 12時間",
      created_at: new Date("2026-08-31T00:00:00.000Z"),
    },
    "123456789012345678",
  );

  assert.match(history, /【独房】独房作成/);
  assert.match(history, /-10,000LIA/);
  assert.match(history, /備考: 独房作成: 12時間/);
});
