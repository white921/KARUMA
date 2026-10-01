const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");
const { PermissionsBitField } = require("discord.js");

const { ROLE_IDS, TEXT_CHANNEL_IDS, THREAD_IDS } = require("../dist/constant/shared/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { GAME_VC } = require("../dist/constant/game/game.js");
const { ACTION_TYPES } = require("../dist/constant/currency/action.js");
const {
  GAME_CRIMINAL_PANEL_MESSAGES,
  GAME_PANEL_MESSAGES,
} = require("../dist/constant/panel/panel.js");
const {
  createGameCriminalPanelActionRows,
} = require("../dist/panel/game/gamePanelService.js");
const { PANEL_INSTALL_TARGETS } = require("../dist/constant/panel/panelInstall.js");
const { resolvePanelInstallTarget } = require("../dist/panel/panelInstallService.js");
const {
  getGameVcTier,
  canPurchaseGamePass,
  calculateGamePassExpireAt,
  calculateGameCriminalAccessExpireAt,
  getGameVcCreateActionType,
  getGameVcPrice,
  getGameVcTicketCost,
  buildGameVcCreateConfirmationDescription,
  createGameVcPermissionOverwrites,
} = require("../dist/service/game/gameVcService.js");

function memberWithRoles(roleIds) {
  return { roles: { cache: { has: (roleId) => roleIds.includes(roleId) } } };
}

test("game VC prices follow traveler, vacant, criminal, and game-staff rules", () => {
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN])),
    { label: "旅人以上", kind: "regular" },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN])),
    { label: "空位者", kind: "vacant" },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI])),
    { label: "罪人", kind: "criminal" },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.GAME_STAFF])),
    { label: "歓楽師", kind: "staff" },
  );
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.HOTEL_LEADER])),
    { label: "支配人", kind: "regular" },
  );
  const tiers = {
    regular: { label: "旅人以上", kind: "regular" },
    vacant: { label: "空位者", kind: "vacant" },
    criminal: { label: "罪人", kind: "criminal" },
  };
  assert.deepEqual([getGameVcPrice(tiers.regular, "limited"), getGameVcPrice(tiers.regular, "unlimited")], [3000, 5000]);
  assert.deepEqual([getGameVcPrice(tiers.vacant, "limited"), getGameVcPrice(tiers.vacant, "unlimited")], [4000, 6000]);
  assert.deepEqual([getGameVcPrice(tiers.criminal, "limited"), getGameVcPrice(tiers.criminal, "unlimited")], [6000, 10000]);
  assert.deepEqual([getGameVcTicketCost(tiers.regular, "limited"), getGameVcTicketCost(tiers.regular, "unlimited")], [1, 2]);
  assert.deepEqual([getGameVcTicketCost(tiers.vacant, "limited"), getGameVcTicketCost(tiers.vacant, "unlimited")], [1, 2]);
  assert.deepEqual([getGameVcTicketCost(tiers.criminal, "limited"), getGameVcTicketCost(tiers.criminal, "unlimited")], [2, 4]);
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

test("new game VCs are unlimited while the legacy duration remains identifiable", () => {
  assert.equal(GAME_VC.LEGACY_DURATION_HOURS, 24);
  assert.equal(GAME_VC.OWNER_ABSENCE_DELETE_MINUTES, 10);
});

test("criminal game panel provides VC creation, access purchase, and balance view", () => {
  assert.equal(TEXT_CHANNEL_IDS.GAME_CRIMINAL_PANEL, "1545379810593873990");
  assert.equal(THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD, "1545386593844600872");
  assert.equal(THREAD_IDS.GAME_CRIMINAL_ACCESS_LOG_THREAD, "1545386598273912842");
  assert.notEqual(
    THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD,
    THREAD_IDS.GAME_CRIMINAL_ACCESS_LOG_THREAD,
  );
  assert.match(GAME_CRIMINAL_PANEL_MESSAGES.DESCRIPTION, /10,000LIA/);
  assert.match(GAME_CRIMINAL_PANEL_MESSAGES.DESCRIPTION, /5,000LIA/);
  assert.match(GAME_CRIMINAL_PANEL_MESSAGES.DESCRIPTION, /24時間/);
  assert.doesNotMatch(GAME_PANEL_MESSAGES.DESCRIPTION, /罪人/);
  assert.equal(
    resolvePanelInstallTarget(TEXT_CHANNEL_IDS.GAME_CRIMINAL_PANEL),
    PANEL_INSTALL_TARGETS.GAME_CRIMINAL,
  );

  const [row1, row2] = createGameCriminalPanelActionRows();
  assert.deepEqual(
    row1.toJSON().components.map((component) => component.custom_id),
    [
      PANEL_COMMAND_NAMES.GAME_VC_CREATE,
      PANEL_COMMAND_NAMES.GAME_CRIMINAL_ACCESS_PURCHASE,
    ],
  );
  assert.deepEqual(
    row2.toJSON().components.map((component) => component.custom_id),
    [PANEL_COMMAND_NAMES.VIEW],
  );
});

test("game VC confirmation omits the creator's role", () => {
  const description = buildGameVcCreateConfirmationDescription(
    { label: "支配人", kind: "regular" },
    "unlimited",
    false,
  );

  assert.doesNotMatch(description, /対象ロール|支配人/);
  assert.match(description, /利用時間：\*\*無制限\*\*/);
  assert.match(description, /料金：\*\*5,000LIA\*\*/);
  assert.match(description, /遊戯チケット2枚/);
  assert.match(description, /退出して10分間/);
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

test("criminal access lasts for 24 hours", () => {
  const now = dayjs("2026-09-01T12:00:00+09:00");
  assert.equal(
    calculateGameCriminalAccessExpireAt(now).toISOString(),
    "2026-09-02T03:00:00.000Z",
  );
});

test("criminal VC creation uses a separate action type for monthly sales", () => {
  assert.equal(
    getGameVcCreateActionType({ label: "罪人", kind: "criminal" }),
    ACTION_TYPES.GAME_CRIMINAL_VC_CREATE,
  );
  assert.equal(
    getGameVcCreateActionType({ label: "旅人以上", kind: "regular" }),
    ACTION_TYPES.GAME_VC_CREATE,
  );
});

test("vacant role has the same VC connection permissions as traveler or above", () => {
  const overwrites = createGameVcPermissionOverwrites("guild-id", "creator-id");
  const vacant = overwrites.find((overwrite) => overwrite.id === ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN);
  const criminal = overwrites.find((overwrite) => overwrite.id === ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI);
  const criminalAccess = overwrites.find((overwrite) => overwrite.id === ROLE_IDS.GAME_CRIMINAL_ACCESS);
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
  assert.ok(vacant.allow.includes(PermissionsBitField.Flags.Connect));
  assert.equal(vacant.deny, undefined);
  assert.ok(criminal.deny.includes(PermissionsBitField.Flags.Connect));
  assert.ok(criminalAccess.allow.includes(PermissionsBitField.Flags.Connect));
  assert.ok(creator.allow.includes(PermissionsBitField.Flags.Connect));
});

const { GameVcService } = require("../dist/service/game/gameVcService.js");

test("遊戯の全ログで残高を表示せず、利用内容を残す", async () => {
  const sent = [];
  const interaction = {
    user: { id: "buyer" },
    client: { channels: { fetch: async id => ({
      isThread: () => true, isTextBased: () => true,
      send: async content => sent.push({ id, content }),
    }) } },
  };
  const expiry = "09/26 12:00";
  for (const [label, kind] of [["旅人以上", "regular"], ["罪人", "criminal"]]) {
    for (const payment of ["money", "ticket", "pass", "staff"]) {
      await GameVcService.sendVcLog(interaction, { label, kind }, payment, "unlimited", "vc");
      const message = sent.at(-1);
      assert.equal(message.id, label === "罪人" ? THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD : THREAD_IDS.GAME_VC_CREATE_LOG_THREAD);
      assert.match(message.content, /作成VC: <#vc>/);
      assert.match(message.content, /料金：/);
      assert.match(message.content, /利用時間: 無制限/);
    }
  }
  await GameVcService.sendCriminalAccessLog(interaction, expiry);
  assert.equal(sent.at(-1).id, THREAD_IDS.GAME_CRIMINAL_ACCESS_LOG_THREAD);
  assert.match(sent.at(-1).content, /料金: 5,000LIA/);
  for (const [label, price] of [["2週間", 50000], ["1か月", 100000]]) {
    await GameVcService.sendPassLog(interaction, label, price, expiry);
    assert.equal(sent.at(-1).id, THREAD_IDS.GAME_PASS_LOG_THREAD);
    assert.ok(sent.at(-1).content.includes(`プラン: ${label}\n料金: ${price.toLocaleString()}LIA`));
  }
  assert.equal(sent.length, 11);
  for (const { content } of sent) {
    assert.doesNotMatch(content, /残高|wallet|balance|undefined/);
    assert.match(content, /<@buyer>/);
  }
  for (const { content } of sent.slice(-3)) assert.ok(content.includes(`有効期限: ${expiry}`));
});
