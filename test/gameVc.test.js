const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");
const { PermissionsBitField } = require("discord.js");

const { ROLE_IDS, TEXT_CHANNEL_IDS, THREAD_IDS } = require("../dist/constant/shared/id.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const { GAME_VC } = require("../dist/constant/game/game.js");
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
  buildGameVcCreateConfirmationDescription,
  createGameVcPermissionOverwrites,
} = require("../dist/service/game/gameVcService.js");

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
  assert.deepEqual(
    getGameVcTier(memberWithRoles([ROLE_IDS.HOTEL_LEADER])),
    { label: "支配人", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE },
  );
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

test("game VC and its ticket use a 24-hour duration", () => {
  assert.equal(GAME_VC.DURATION_HOURS, 24);
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
    { label: "支配人", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE },
    false,
  );

  assert.doesNotMatch(description, /対象ロール|支配人/);
  assert.match(description, /利用時間：24時間/);
  assert.match(description, /料金：\*\*5,000LIA\*\*/);
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

test("遊戯の全ログで残高を表示せず、利用内容と期限を残す", async () => {
  const sent = [];
  const interaction = {
    user: { id: "buyer" },
    client: { channels: { fetch: async id => ({
      isThread: () => true, isTextBased: () => true,
      send: async content => sent.push({ id, content }),
    }) } },
  };
  const expiry = "09/26 12:00";
  for (const label of ["旅人以上", "罪人"]) {
    for (const payment of ["money", "ticket", "pass", "staff"]) {
      await GameVcService.sendVcLog(interaction, { label, price: 5000 }, payment, "vc", expiry);
      const message = sent.at(-1);
      assert.equal(message.id, label === "罪人" ? THREAD_IDS.GAME_CRIMINAL_VC_CREATE_LOG_THREAD : THREAD_IDS.GAME_VC_CREATE_LOG_THREAD);
      assert.match(message.content, /作成VC: <#vc>/);
      assert.match(message.content, /料金：/);
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
    assert.ok(content.includes(`有効期限: ${expiry}`));
    assert.match(content, /<@buyer>/);
  }
});
