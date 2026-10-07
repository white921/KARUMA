const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");

const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const {
  FORUM_IDS,
  ROLE_IDS,
  SUPERCHAT_STREAMER_THREAD_IDS,
  TEXT_CHANNEL_IDS,
} = require("../dist/constant/shared/id.js");
const {
  canReceiveSuperchat,
  hasSuperchatThread,
  getSuperchatEmbedColor,
  SuperchatService,
} = require("../dist/service/market/superchatService.js");
const { COLOR } = require("../dist/constant/shared/color.js");
const { GuildMemberCacheService } = require("../dist/service/system/guildMemberCacheService.js");
const {
  createSuperchatPanelActionRow,
} = require("../dist/panel/market/superchatPanelService.js");

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
    "1161955292674801704": "1557027238254219344",
    "1509522380798693506": "1557382897676189757",
    "1448970281900048438": "1557382935114555432",
    "1007920454478082059": "1557382974260117554",
  });
  assert.equal(hasSuperchatThread("1086598017345388685"), true);
  assert.equal(hasSuperchatThread("1161955292674801704"), true);
  assert.equal(hasSuperchatThread("1509522380798693506"), true);
  assert.equal(hasSuperchatThread("1448970281900048438"), true);
  assert.equal(hasSuperchatThread("1007920454478082059"), true);
  assert.equal(hasSuperchatThread("649438093996195851"), false);
  assert.equal(hasSuperchatThread("000000000000000000"), false);
});

test("superchat recipient eligibility requires one of the three streamer roles", () => {
  assert.equal(canReceiveSuperchat(member("1", [ROLE_IDS.STREAMER_MANAGER])), true);
  assert.equal(canReceiveSuperchat(member("2", [ROLE_IDS.SINGER_CROWN])), true);
  assert.equal(canReceiveSuperchat(member("3", [ROLE_IDS.VOICE_CROWN])), true);
  assert.equal(canReceiveSuperchat(member("649438093996195851")), false);
  assert.equal(canReceiveSuperchat(member("4")), false);
});

test("superchat choices include configured singers, exclude Shiro, and omit repeated descriptions", async (t) => {
  const singer = (id, displayName) => ({
    id,
    displayName,
    user: { bot: false },
    roles: { cache: { has: (roleId) => roleId === ROLE_IDS.SINGER_CROWN } },
  });
  t.mock.method(GuildMemberCacheService, "getMembers", async () => new Collection([
    ["1161955292674801704", singer("1161955292674801704", "滅却師")],
    ["1509522380798693506", singer("1509522380798693506", "神枝")],
    ["1448970281900048438", singer("1448970281900048438", "六花")],
    ["1007920454478082059", singer("1007920454478082059", "右与")],
    ["649438093996195851", singer("649438093996195851", "シロ")],
  ]));

  let payload;
  await SuperchatService.showStreamerSelect({
    guild: {},
    editReply: async (value) => { payload = value; },
  });

  const select = payload.components[0].toJSON().components[0];
  assert.deepEqual(
    select.options.map(({ label, value }) => ({ label, value })),
    [
      { label: "右与", value: "1007920454478082059" },
      { label: "神枝", value: "1509522380798693506" },
      { label: "滅却師", value: "1161955292674801704" },
      { label: "六花", value: "1448970281900048438" },
    ],
  );
  assert.ok(select.options.every((option) => !("description" in option)));
  assert.equal(payload.embeds[0].toJSON().description, "送金先を選択してください。");
  assert.doesNotMatch(JSON.stringify(payload), /スパチャを送る配信者/);
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
  assert.equal(embed.description, "送金額: **12,345LIA**\n配信者: <@222>");
  assert.deepEqual(embed.fields, [{ name: "コメント", value: "楽しい配信をありがとう" }]);
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
