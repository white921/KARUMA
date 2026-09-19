const test = require("node:test");
const assert = require("node:assert/strict");
const { Collection } = require("discord.js");
const { CreatorEmblemPaymentService } = require("../dist/service/market/creatorEmblemPaymentService.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { SendService } = require("../dist/service/currency/sendService.js");
const { CREATOR_EMBLEM_RECIPIENT_ID, CREATOR_EMBLEM_PRICING_ROLES, CREATOR_EMBLEM_CONFIRM_PREFIX, CREATOR_EMBLEM_CANCEL_ID } = require("../dist/constant/market/creatorEmblem.js");
const { ROLE_IDS, THREAD_IDS } = require("../dist/constant/shared/id.js");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck.js");
const { handleStringSelectMenu } = require("../dist/handler/interaction/stringSelectHandler.js");

function fixture(t, { tier = "noble", product = "personal", balance = 500000, price, logFailure = false, insertFailure = false, recipientExists = true } = {}) {
  const payerId = "111111111111111111";
  const member = { id: payerId, roles: { cache: new Collection([
    [CREATOR_EMBLEM_PRICING_ROLES[tier].id, { id: CREATOR_EMBLEM_PRICING_ROLES[tier].id }],
    ["guild", { id: "guild" }],
  ]) } };
  member.displayAvatarURL = options => {
    assert.deepEqual(options, { size: 256 });
    return `https://cdn.discordapp.com/guilds/1534636292153807039/users/${payerId}/avatars/server-avatar.png`;
  };
  const amount = price ?? (product === "large" ? 200000 : tier === "noble" ? 60000 : 100000);
  let accounts = [{ user_id: payerId, wallet: balance }];
  if (recipientExists) accounts.push({ user_id: CREATOR_EMBLEM_RECIPIENT_ID, wallet: 1234 });
  let actions = [], snapshot;
  const calls = [], edits = [], logs = [], fetches = [];
  const connection = {
    beginTransaction: async () => { calls.push("begin"); snapshot = structuredClone({ accounts, actions }); },
    execute: async (sql, params) => {
      if (sql.startsWith("SELECT * FROM accounts")) return [structuredClone(accounts)];
      if (sql.startsWith("SELECT id FROM actions")) return [actions.filter(a => a.comment.startsWith(params[2].slice(0, -1)))];
      if (sql.startsWith("UPDATE accounts")) {
        const account = accounts.find(a => a.user_id === params[1]);
        account.wallet += sql.includes("wallet -") ? -params[0] : params[0];
        calls.push(params[1] === payerId ? "debit" : "credit");
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO actions")) {
        if (insertFailure) throw new Error("history insert failed");
        actions.push({ id: actions.length + 1, amount: params[1], recipient: params[3], comment: params[6] });
        calls.push("history"); return [{ insertId: actions.length }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    commit: async () => calls.push("commit"),
    rollback: async () => { calls.push("rollback"); ({ accounts, actions } = structuredClone(snapshot)); },
    release: () => calls.push("release"),
  };
  const thread = { isThread: () => true, isTextBased: () => true, locked: false,
    permissionsFor: () => ({ has: () => true }),
    send: async (payload) => { if (logFailure) throw new Error("log rejected"); logs.push(payload); },
  };
  const interaction = {
    customId: `${CREATOR_EMBLEM_CONFIRM_PREFIX}:${product}:${amount}:${payerId}`,
    user: { id: payerId }, guildId: "guild", message: { id: "222222222222222222" }, values: [product],
    guild: { members: { fetch: async (options) => { fetches.push(options); return member; }, fetchMe: async () => ({}) } },
    client: { channels: { fetch: async (id) => { assert.equal(id, THREAD_IDS.CREATOR_EMBLEM_LOG_THREAD); return thread; } } },
    editReply: async (payload) => edits.push(payload),
    update: async (payload) => edits.push(payload),
  };
  t.mock.method(DbService, "getConnection", async () => connection);
  t.mock.method(SendService, "validateMonthlySendLimit", async (...args) => {
    assert.equal(args[1], CREATOR_EMBLEM_RECIPIENT_ID);
  });
  return { interaction, member, thread, edits, logs, calls, fetches,
    accounts: () => accounts, actions: () => actions };
}

test("unrelated roles do not qualify, with noble precedence", () => {
  for (const role of [ROLE_IDS.GIJUTU_LEADER, ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN]) {
    assert.throws(() => CreatorEmblemPaymentService.getPricingTier({ roles: { cache: new Collection([[role, {}]]) } }), /貴族または騎士/);
  }
  const member = { roles: { cache: new Collection(Object.values(CREATOR_EMBLEM_PRICING_ROLES).map(r => [r.id, {}])) } };
  assert.equal(CreatorEmblemPaymentService.getPriceForMember(member, "personal"), 60000);
});

for (const [roleId, label] of [[ROLE_IDS.KANRISYA, "英傑"], [ROLE_IDS.SABANUSI, "皇帝"]]) {
  for (const [product, amount] of [["personal", 60000], ["large", 200000]]) {
    test(`${label} can select and pay for ${product} at noble prices without a noble role`, async t => {
      const f = fixture(t, { product });
      f.member.roles.cache = new Collection([[roleId, { id: roleId }]]);
      await CreatorEmblemPaymentService.showProductSelect(f.interaction);
      assert.deepEqual(f.edits[0].components[0].toJSON().components[0].options.map(o => o.value), ["personal", "large"]);
      await CreatorEmblemPaymentService.showConfirmation(f.interaction);
      assert.match(f.edits[1].embeds[0].toJSON().description, new RegExp(label));
      await CreatorEmblemPaymentService.pay(f.interaction);
      assert.equal(f.accounts()[0].wallet, 500000 - amount);
      assert.equal(f.actions()[0].amount, amount);
      assert.match(f.actions()[0].comment, new RegExp(label));
      const roleField = f.logs[0].embeds[0].toJSON().fields.find(field => field.name === "適用ロール");
      assert.equal(roleField.value, `<@&${roleId}>（${label}）`);
      f.member.roles.cache.set(CREATOR_EMBLEM_PRICING_ROLES.knight.id, { id: CREATOR_EMBLEM_PRICING_ROLES.knight.id });
      assert.equal(CreatorEmblemPaymentService.getPriceForMember(f.member, "personal"), 60000);
    });
  }
}

test("knights see only personal emblems and confirmation follows product selection directly", async t => {
  const f = fixture(t, { tier: "knight" });
  await CreatorEmblemPaymentService.showProductSelect(f.interaction);
  const select = f.edits[0].components[0].toJSON().components[0];
  assert.deepEqual(select.options.map(o => o.value), ["personal"]);
  f.interaction.customId = select.custom_id;
  await handleStringSelectMenu(f.interaction);
  const confirmation = f.edits[1];
  assert.match(confirmation.embeds[0].toJSON().description, /100,000/);
  assert.match(confirmation.embeds[0].toJSON().description, /1400304116152139837/);
  assert.equal(confirmation.components[0].toJSON().components[0].custom_id,
    `${CREATOR_EMBLEM_CONFIRM_PREFIX}:personal:100000:${f.interaction.user.id}`);
  assert.deepEqual(f.fetches[0], { user: f.interaction.user.id, force: true });
});

for (const [tier, product, amount] of [["noble", "personal", 60000], ["knight", "personal", 100000], ["noble", "large", 200000]]) {
  test(`${tier} ${product}: atomic fixed-recipient payment and one embed log`, async t => {
    const f = fixture(t, { tier, product });
    await CreatorEmblemPaymentService.pay(f.interaction);
    assert.equal(f.accounts()[0].wallet, 500000 - amount);
    assert.equal(f.accounts()[1].wallet, 1234 + amount);
    assert.equal(f.actions()[0].recipient, CREATOR_EMBLEM_RECIPIENT_ID);
    assert.equal(f.actions()[0].amount, amount);
    assert.deepEqual(f.calls, ["begin", "debit", "credit", "history", "commit", "release"]);
    assert.equal(f.logs.length, 1);
    const embed = f.logs[0].embeds[0].toJSON();
    assert.equal(embed.thumbnail.url, f.member.displayAvatarURL({ size: 256 }));
    assert.match(embed.fields.find(x => x.name === "購入者").value, new RegExp(f.interaction.user.id));
    assert.equal(embed.fields.find(x => x.name === "商品").value, product === "large" ? "デカ紋章" : "個人紋章");
    assert.match(embed.fields.find(x => x.name === "適用ロール").value, new RegExp(CREATOR_EMBLEM_PRICING_ROLES[tier].id));
    assert.equal(embed.fields.some(x => x.name === "所持ロール"), false);
    assert.deepEqual(f.logs[0].allowedMentions, { parse: [] });
    assert.deepEqual(f.edits[0].components, []);
  });
}

test("a replay of the same confirmation does not debit or log twice", async t => {
  const f = fixture(t);
  await CreatorEmblemPaymentService.pay(f.interaction);
  await CreatorEmblemPaymentService.pay(f.interaction);
  assert.equal(f.accounts()[0].wallet, 440000);
  assert.equal(f.actions().length, 1);
  assert.equal(f.logs.length, 1);
  assert.match(f.edits[1].content, /重複送金はしていません/);
});

test("changing product on an already paid confirmation does not pay again", async t => {
  const f = fixture(t);
  await CreatorEmblemPaymentService.pay(f.interaction);
  f.interaction.customId = `${CREATOR_EMBLEM_CONFIRM_PREFIX}:large:200000:${f.interaction.user.id}`;
  await CreatorEmblemPaymentService.pay(f.interaction);
  assert.equal(f.accounts()[0].wallet, 440000);
  assert.equal(f.logs.length, 1);
});

test("a changed role or price requires a new confirmation", async t => {
  const f = fixture(t, { tier: "knight", price: 60000 });
  await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /ロールまたは料金が変更/);
  assert.deepEqual(f.calls, []);
});

test("old recipient-bearing buttons and other users' confirmations are rejected", async t => {
  const f = fixture(t);
  for (const customId of [`${CREATOR_EMBLEM_CONFIRM_PREFIX}:personal:1400304116152139837`, `${CREATOR_EMBLEM_CONFIRM_PREFIX}:personal:60000:999999999999999999`]) {
    f.interaction.customId = customId;
    await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /無効な支払い内容/);
  }
  assert.deepEqual(f.calls, []);
});

test("insufficient balance cannot move money", async t => {
  const f = fixture(t, { balance: 1 });
  await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /不足/);
  assert.equal(f.accounts()[0].wallet, 1);
  assert.deepEqual(f.calls, ["begin", "rollback", "release"]);
});

test("missing recipient cannot debit the payer", async t => {
  const f = fixture(t, { recipientExists: false });
  await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /口座が見つかりません/);
  assert.equal(f.accounts()[0].wallet, 500000);
  assert.equal(f.actions().length, 0);
});

test("history failure rolls both balances back", async t => {
  const f = fixture(t, { insertFailure: true });
  await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /history insert failed/);
  assert.deepEqual(f.accounts().map(a => a.wallet), [500000, 1234]);
  assert.equal(f.logs.length, 0);
  assert.ok(f.calls.includes("rollback"));
});

test("unavailable log permissions prevent payment", async t => {
  const f = fixture(t);
  f.thread.permissionsFor = () => ({ has: () => false });
  await assert.rejects(CreatorEmblemPaymentService.pay(f.interaction), /投稿先が利用できません/);
  assert.deepEqual(f.calls, []);
});

test("post-commit Discord failure reports completed payment and remains replay-safe", async t => {
  const f = fixture(t, { logFailure: true });
  t.mock.method(console, "error", () => {});
  await CreatorEmblemPaymentService.pay(f.interaction);
  assert.equal(f.accounts()[0].wallet, 440000);
  assert.match(f.edits[0].content, /再度支払わず/);
  await CreatorEmblemPaymentService.pay(f.interaction);
  assert.equal(f.accounts()[0].wallet, 440000);
});

test("confirmation and cancellation update the existing private message", () => {
  assert.equal(shouldDeferButtonUpdate(`${CREATOR_EMBLEM_CONFIRM_PREFIX}:personal:60000:123`), true);
  assert.equal(shouldDeferButtonUpdate(CREATOR_EMBLEM_CANCEL_ID), true);
});
