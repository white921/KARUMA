const test = require("node:test");
const assert = require("node:assert/strict");
const { SendService } = require("../dist/service/currency/sendService.js");
const { AccountService } = require("../dist/service/account/accountService.js");
const { ActionService } = require("../dist/service/currency/actionService.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/shared/command.js");
const recipientId = "recipient-a";

function fixture(t) {
  const events = [];
  const payloads = [];
  const fetched = [];
  const avatar = "https://cdn.discordapp.com/embed/avatars/0.png";
  const sender = { id: "sender", displayName: "送金者", displayAvatarURL: () => avatar };
  t.mock.method(AccountService, "getAccountByUserId", async (id) => [{ user_id: id, wallet: 100000 }]);
  t.mock.method(SendService, "validateMonthlySendLimit", async () => {});
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async (sql, params) => { events.push(["write", ...params]); return [{}]; },
    release() {},
  }));
  t.mock.method(ActionService, "createActionLog", async () => { events.push(["log"]); });
  t.mock.method(ActionService, "createActionLogMessage", async () => {});
  const recipient = { send: async (payload) => { events.push(["dm"]); payloads.push(payload); } };
  const interaction = {
    user: sender,
    guild: { members: { fetch: async () => ({ user: sender, displayName: "サーバー表示名", displayAvatarURL: () => avatar }) } },
    client: { users: { fetch: async (id) => { fetched.push(id); return id === "sender" ? sender : recipient; } } },
    reply: async () => { events.push(["reply"]); },
    editReply: async () => { events.push(["reply"]); },
  };
  return { interaction, events, payloads, fetched, recipient, avatar };
}

for (const entry of ["command", "panel"]) {
  test(`${entry}: 一般の受取人に送金者の名前・アイコンと確定残高をDM通知する`, async (t) => {
    const f = fixture(t);
    if (entry === "command") {
      await SendService.sendByCommand(f.interaction, "sender", recipientId, 10000, "ありがとう！");
    } else {
      await SendService.executeSend(f.interaction, "sender", recipientId, 10000, "ありがとう！", PANEL_COMMAND_NAMES.SEND, "editReply");
    }
    assert.equal(f.payloads.length, 1);
    assert.deepEqual(f.fetched, [recipientId]);
    const payload = f.payloads[0];
    const embed = payload.embeds[0].toJSON();
    assert.equal(embed.author.name, "サーバー表示名");
    assert.equal(embed.author.icon_url, f.avatar);
    assert.equal(embed.thumbnail.url, f.avatar);
    assert.match(embed.description, /^サーバー表示名 さんから \*\*10,000 LIA/);
    assert.doesNotMatch(embed.description, /<@sender>/);
    assert.equal(embed.footer.text, "受取後の残高：110,000 LIA");
    assert.deepEqual(embed.fields, [{ name: "備考", value: "ありがとう！" }]);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    assert.deepEqual(f.events.slice(0, 2), [["write", 90000, "sender"], ["write", 110000, recipientId]]);
    assert.equal(f.events.at(-1)[0], "dm");
  });
}

test("紋章送金にはユーザー取得もDM送信もしない", async (t) => {
  const f = fixture(t);
  for (const command of [PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY]) {
    await SendService.executeSend(f.interaction, "sender", recipientId, 1000, "", command, "editReply");
  }
  assert.deepEqual(f.fetched, []);
  assert.deepEqual(f.payloads, []);
});

test("DM拒否でも送金・履歴は成功し、残高更新も送信も再試行しない", async (t) => {
  const f = fixture(t);
  const errors = t.mock.method(console, "error", () => {});
  let attempts = 0;
  f.recipient.send = async () => { attempts++; throw Object.assign(new Error("Cannot send messages to this user"), { code: 50007 }); };
  await SendService.sendByCommand(f.interaction, "sender", recipientId, 10000, "");
  assert.equal(attempts, 1);
  assert.equal(errors.mock.callCount(), 1);
  assert.equal(f.events.filter(([kind]) => kind === "write").length, 2);
  assert.equal(f.events.filter(([kind]) => kind === "log").length, 1);
  assert.equal(f.events.filter(([kind]) => kind === "reply").length, 1);
});

test("空の備考は省略し、メンバー取得失敗時はユーザーの名前・アイコンを使う", async (t) => {
  const f = fixture(t);
  f.interaction.guild.members.fetch = async () => { throw new Error("Unknown member"); };
  await SendService.sendByCommand(f.interaction, "sender", recipientId, 1, "  ");
  const embed = f.payloads[0].embeds[0].toJSON();
  assert.equal(embed.author.name, "送金者");
  assert.equal(embed.author.icon_url, f.avatar);
  assert.match(embed.description, /^送金者 さんから /);
  assert.equal(embed.fields, undefined);
});

test("サーバー専用アイコンを使い、本文のニックネームのMarkdownをエスケープする", async (t) => {
  const f = fixture(t);
  const guildAvatar = "https://cdn.discordapp.com/embed/avatars/2.png";
  f.interaction.guild.members.fetch = async () => ({
    user: f.interaction.user,
    displayName: "**サーバー名**",
    displayAvatarURL: () => guildAvatar,
  });
  await SendService.sendByCommand(f.interaction, "sender", recipientId, 1, "");
  const embed = f.payloads[0].embeds[0].toJSON();
  assert.equal(embed.author.name, "**サーバー名**");
  assert.equal(embed.author.icon_url, guildAvatar);
  assert.equal(embed.thumbnail.url, guildAvatar);
  assert.equal(embed.description, "\\*\\*サーバー名\\*\\* さんから **1 LIA**が届きました。\n\n[取引履歴はこちら](https://discord.com/channels/1534636292153807039/1534648842719465683)");
});

test("長い備考でもEmbedの上限を超えない", async (t) => {
  const f = fixture(t);
  await SendService.sendByCommand(f.interaction, "sender", recipientId, 1, "あ".repeat(2000));
  assert.equal(f.payloads[0].embeds[0].toJSON().fields[0].value.length, 1024);
});

test("送金失敗時にはDMを送らない", async (t) => {
  const f = fixture(t);
  await assert.rejects(SendService.sendByCommand(f.interaction, "sender", recipientId, 100001, ""));
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.fetched, []);
});

test("受取ユーザー取得失敗も通知失敗として扱う", async (t) => {
  const f = fixture(t);
  t.mock.method(console, "error", () => {});
  f.interaction.client.users.fetch = async () => { throw new Error("Discord unavailable"); };
  await SendService.sendByCommand(f.interaction, "sender", recipientId, 1, "");
  assert.equal(f.events.filter(([kind]) => kind === "write").length, 2);
  assert.deepEqual(f.payloads, []);
});
