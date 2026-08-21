const test = require("node:test");
const assert = require("node:assert/strict");

const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const {
  FORUM_IDS,
  ROLE_IDS,
  SUPERCHAT_STREAMER_THREAD_IDS,
  TEXT_CHANNEL_IDS,
} = require("../dist/constant/id.js");
const {
  canReceiveSuperchat,
  hasSuperchatThread,
  getSuperchatEmbedColor,
  SuperchatService,
} = require("../dist/service/superchatService.js");
const { COLOR } = require("../dist/constant/color.js");
const {
  createSuperchatPanelActionRow,
} = require("../dist/service/superchatPanelService.js");

function member(id, roleIds = []) {
  return {
    id,
    roles: { cache: { has: (roleId) => roleIds.includes(roleId) } },
  };
}

test("superchat uses the configured panel, forum, and stage channels", () => {
  assert.equal(TEXT_CHANNEL_IDS.SUPERCHAT_PANEL, "1540357998239551508");
  assert.equal(TEXT_CHANNEL_IDS.SINGER_CROWN_STAGE, "1535322840826519552");
  assert.equal(TEXT_CHANNEL_IDS.VOICE_CROWN_STAGE, "1535322798174511206");
  assert.equal(FORUM_IDS.SUPERCHAT, "1540358555452833823");
});

test("superchat streamer threads are mapped by streamer user ID", () => {
  assert.deepEqual(SUPERCHAT_STREAMER_THREAD_IDS, {
    "1086598017345388685": "1540362283417600121",
    "820632259312091168": "1540362348370468894",
    "1290939535160639510": "1540362472719122482",
    "649438093996195851": "1540358709677531187",
  });
  assert.equal(hasSuperchatThread("1086598017345388685"), true);
  assert.equal(hasSuperchatThread("000000000000000000"), false);
});

test("superchat recipient eligibility includes the three streamer roles and test Shiro", () => {
  assert.equal(canReceiveSuperchat(member("1", [ROLE_IDS.STREAMER_MANAGER])), true);
  assert.equal(canReceiveSuperchat(member("2", [ROLE_IDS.SINGER_CROWN])), true);
  assert.equal(canReceiveSuperchat(member("3", [ROLE_IDS.VOICE_CROWN])), true);
  assert.equal(canReceiveSuperchat(member("649438093996195851")), true);
  assert.equal(canReceiveSuperchat(member("4")), false);
});

test("superchat panel has send and balance buttons without emoji icons", () => {
  const buttons = createSuperchatPanelActionRow().toJSON().components;
  assert.deepEqual(buttons.map((button) => button.custom_id), [
    PANEL_COMMAND_NAMES.SUPERCHAT_SEND,
    PANEL_COMMAND_NAMES.VIEW,
  ]);
  assert.ok(buttons.every((button) => !button.emoji));
});

test("superchat embed contains sender identity, body thumbnail, amount, and comment", () => {
  const sender = {
    id: "111",
    displayName: "送金者",
    displayAvatarURL: () => "https://example.invalid/avatar.png",
  };
  const embed = SuperchatService.createEmbed(
    sender,
    12345,
    "楽しい配信をありがとう",
    "222",
  ).toJSON();

  assert.equal(embed.author.name, "送金者");
  assert.equal(embed.thumbnail.url, "https://example.invalid/avatar.png");
  assert.equal(embed.title, undefined);
  assert.equal(embed.description, "楽しい配信をありがとう");
  assert.ok(embed.fields.some((field) => field.value === "12,345LIA"));
  assert.ok(!embed.fields.some((field) => field.name === "ステージ"));
});

test("superchat embed color changes at the configured amount thresholds", () => {
  assert.equal(getSuperchatEmbedColor(1999), COLOR.YELLOW);
  assert.equal(getSuperchatEmbedColor(2000), COLOR.ORANGE);
  assert.equal(getSuperchatEmbedColor(4999), COLOR.ORANGE);
  assert.equal(getSuperchatEmbedColor(5000), COLOR.PINK);
  assert.equal(getSuperchatEmbedColor(9999), COLOR.PINK);
  assert.equal(getSuperchatEmbedColor(10000), COLOR.RED);
});
