const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { PANEL_COMMAND_NAMES: C } = require("../dist/constant/shared/command");
const { SHOP_TICKET_TYPE, SHOP_TICKET_NONE } = require("../dist/constant/market/shopTicket");
const { PAYMENT_CONFIRMATION_TTL_MS } = require("../dist/constant/currency/paymentConfirmation");
const { handleModalSubmit } = require("../dist/handler/interaction/modalHandler");
const { handlePanelButton } = require("../dist/handler/interaction/panelButtonHandler");
const { shouldDeferButtonUpdate } = require("../dist/util/interaction/interactionAck");
const { AccountService } = require("../dist/service/account/accountService");
const { ShopPaymentService } = require("../dist/service/market/shopPaymentService");
const { SuperchatService } = require("../dist/service/market/superchatService");
const { SendService } = require("../dist/service/currency/sendService");
const { DbService } = require("../dist/service/system/dbService");
const { ActionService } = require("../dist/service/currency/actionService");
const { ROLE_IDS, SUPERCHAT_STREAMER_THREAD_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id");

function modal(customId, amount = "5000", comment = "商品・備考") {
  const replies = [];
  const fields = new Map([["amount", amount], ["comment", comment]]);
  return {
    customId, user: { id: "buyer" }, guildId: "guild", channelId: "channel",
    fields: { fields, getTextInputValue: (key) => fields.get(key) },
    deferReply: async (payload) => assert.equal(payload.flags, MessageFlags.Ephemeral),
    editReply: async (payload) => replies.push(payload), replies,
  };
}
function button(source, action = "confirm", overrides = {}) {
  const components = source.replies[0].components[0].toJSON().components;
  return { ...source, deferred: true,
    customId: components[action === "confirm" ? 0 : 1].custom_id, ...overrides };
}
function mockPayments(t) {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(DbService, "getConnection", async () => assert.fail("confirmation must not reach DB"));
  return {
    shop: t.mock.method(ShopPaymentService, "pay", async () => {}),
    send: t.mock.method(SendService, "executeSend", async () => {}),
    superchat: t.mock.method(SuperchatService, "send", async () => {}),
  };
}
const scenarios = [
  ["市場・チケットなし", `${C.SHOP_SEND}_${SHOP_TICKET_NONE}`, "shop", [5000, "商品・備考", SHOP_TICKET_NONE, C.SHOP_SEND]],
  ["市場・割引券", `${C.SHOP_SEND}_${SHOP_TICKET_TYPE.DISCOUNT_10}`, "shop", [5000, "商品・備考", SHOP_TICKET_TYPE.DISCOUNT_10, C.SHOP_SEND]],
  ["宮廷市場", C.COURT_SHOP_SEND, "shop", [5000, "商品・備考", SHOP_TICKET_NONE, C.COURT_SHOP_SEND]],
  ["闇市場", C.DARK_SHOP_SEND, "shop", [5000, "商品・備考", SHOP_TICKET_NONE, C.DARK_SHOP_SEND]],
  ["通常送金", `${C.SEND}_buyer_recipient`, "send", ["buyer", "recipient", 5000, "商品・備考", C.SEND, "editReply"]],
  ...[C.CASINO_GF, C.CASINO_MAJONG, C.CASINO_OTHER].map((command) => [command, `${command}_buyer_recipient`, "send", ["buyer", "recipient", 5000, "商品・備考", command, "editReply"]]),
  ["歌冠スパチャ", `${C.SUPERCHAT_SEND}:streamer:singer`, "superchat", [5000, "商品・備考", "streamer", "singer"]],
  ["声冠スパチャ", `${C.SUPERCHAT_SEND}:streamer:voice`, "superchat", [5000, "商品・備考", "streamer", "voice"]],
];

for (const [name, customId, kind, args] of scenarios) {
  test(`${name}: 入力送信では決済せず、表示内容を確定時に一度だけ処理する`, async (t) => {
    const payments = mockPayments(t);
    const source = modal(customId);
    await handleModalSubmit(source);
    for (const payment of Object.values(payments)) assert.equal(payment.mock.callCount(), 0);
    const embed = source.replies[0].embeds[0].toJSON();
    assert.match(embed.description, /5,000LIA/);
    assert.ok(embed.fields.some((field) => field.value.includes("商品・備考")));
    if (kind === "send") assert.ok(embed.fields.some((field) => field.value === "<@recipient>"));
    if (kind === "superchat") {
      assert.ok(embed.fields.some((field) => field.value === "<@streamer>"));
      assert.ok(embed.fields.some((field) => field.value === (customId.endsWith("singer") ? "歌冠ステージ" : "声冠ステージ")));
    }
    if (name === "市場・割引券") assert.ok(embed.fields.some((field) => field.value.includes("10%OFF（1枚）")));
    const confirm = button(source);
    assert.equal(shouldDeferButtonUpdate(confirm.customId), true);
    const results = await Promise.allSettled([handlePanelButton(confirm), handlePanelButton(confirm)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(payments[kind].mock.callCount(), 1);
    assert.deepEqual(payments[kind].mock.calls[0].arguments, [confirm, ...args]);
    assert.deepEqual(source.replies[1].components, []);
    assert.deepEqual(source.replies[1].embeds, []);
  });

  test(`${name}: キャンセルは決済せず、その後の確定も拒否する`, async (t) => {
    const payments = mockPayments(t);
    const source = modal(customId);
    await handleModalSubmit(source);
    const cancel = button(source, "cancel");
    assert.equal(shouldDeferButtonUpdate(cancel.customId), true);
    await handlePanelButton(cancel);
    assert.match(source.replies[1].content, /キャンセル/);
    assert.deepEqual(source.replies[1].components, []);
    await assert.rejects(handlePanelButton(button(source)), /処理済み/);
    for (const payment of Object.values(payments)) assert.equal(payment.mock.callCount(), 0);
  });
}

test("別ユーザー・別チャンネル・別サーバーの操作を拒否し、本人は確定できる", async (t) => {
  const payments = mockPayments(t);
  const source = modal(C.COURT_SHOP_SEND);
  await handleModalSubmit(source);
  for (const overrides of [{ user: { id: "other" } }, { channelId: "other" }, { guildId: "other" }]) {
    await assert.rejects(handlePanelButton(button(source, "confirm", overrides)), /操作できません/);
  }
  assert.equal(payments.shop.mock.callCount(), 0);
  await handlePanelButton(button(source));
  assert.equal(payments.shop.mock.callCount(), 1);
});

test("期限切れ・再起動などで存在しない確認情報では決済しない", async (t) => {
  const payments = mockPayments(t);
  const source = modal(C.COURT_SHOP_SEND);
  await handleModalSubmit(source);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + PAYMENT_CONFIRMATION_TTL_MS + 1);
  await assert.rejects(handlePanelButton(button(source)), /期限切れ/);
  await assert.rejects(handlePanelButton(button(source, "confirm", { customId: "paymentConfirmation:confirm:missing" })), /期限切れ/);
  assert.equal(payments.shop.mock.callCount(), 0);
});

test("不正入力・送金元の不一致を確認表示前に拒否する", async (t) => {
  mockPayments(t);
  for (const amount of ["0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
    await assert.rejects(handleModalSubmit(modal(C.COURT_SHOP_SEND, amount)), /整数/);
  }
  await assert.rejects(handleModalSubmit(modal(C.COURT_SHOP_SEND, "5000", "  ")), /商品名/);
  await assert.rejects(handleModalSubmit(modal(`${C.SEND}_other_recipient`)), /送金元/);
  await assert.rejects(handleModalSubmit(modal(`${C.SEND}_buyer_buyer`)), /自分自身/);
  await assert.rejects(handleModalSubmit(modal(`${C.SUPERCHAT_SEND}:streamer:unknown`)), /ステージ/);
  await assert.rejects(handleModalSubmit(modal(`${C.SHOP_SEND}_${SHOP_TICKET_TYPE.DISCOUNT_10}`, "1000000")), /100万/);
});

test("決済処理が失敗した後も、同じ確認画面から再実行しない", async (t) => {
  const payments = mockPayments(t);
  payments.shop.mock.mockImplementation(async () => { throw new Error("payment failed"); });
  const source = modal(C.COURT_SHOP_SEND);
  await handleModalSubmit(source);
  await assert.rejects(handlePanelButton(button(source)), /payment failed/);
  await assert.rejects(handlePanelButton(button(source)), /処理済み/);
  assert.equal(payments.shop.mock.callCount(), 1);
});

test("送金確定時に残高・月間上限を再検証する", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(DbService, "getConnection", async () => assert.fail("invalid transfer must not write"));
  let wallet = 10000;
  t.mock.method(AccountService, "getAccountByUserId", async (id) => [{ user_id: id, wallet }]);
  const limit = t.mock.method(SendService, "validateMonthlySendLimit", async () => { throw new Error("月間送金上限"); });
  const source = modal(`${C.SEND}_buyer_recipient`);
  await handleModalSubmit(source);
  wallet = 100;
  await assert.rejects(handlePanelButton(button(source)), /残高/);
  assert.equal(limit.mock.callCount(), 0);
  wallet = 10000;
  const second = modal(`${C.SEND}_buyer_recipient`);
  await handleModalSubmit(second);
  await assert.rejects(handlePanelButton(button(second)), /月間送金上限/);
  assert.equal(limit.mock.callCount(), 1);
});

for (const stage of ["singer", "voice"]) {
  test(`スパチャ確定は${stage}の送付先へ決済・投稿し、二重に応答しない`, async (t) => {
    t.mock.method(AccountService, "hasAccount", async () => true);
    t.mock.method(AccountService, "getAccountByUserId", async (id) => [{ user_id: id, wallet: 10000 }]);
    t.mock.method(ActionService, "executeActionLog", async () => {});
    const streamerId = Object.keys(SUPERCHAT_STREAMER_THREAD_IDS)[0];
    const writes = [];
    t.mock.method(DbService, "getConnection", async () => ({
      beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
      execute: async (sql, params) => { writes.push(params); return [{}]; },
    }));
    const fetched = [];
    const published = [];
    const source = modal(`${C.SUPERCHAT_SEND}:${streamerId}:${stage}`);
    source.guild = { members: { fetch: async ({ user, force }) => {
      assert.equal(force, true);
      fetched.push(user);
      return { id: user, displayName: "送信者", displayAvatarURL: () => "https://example.com/avatar.png",
        roles: { cache: new Set([ROLE_IDS.SINGER_CROWN]) } };
    } } };
    source.client = { channels: { fetch: async (id) => ({
      isTextBased: () => true, isThread: () => id === SUPERCHAT_STREAMER_THREAD_IDS[streamerId],
      send: async (payload) => published.push({ id, payload }),
    }) } };
    await handleModalSubmit(source);
    assert.equal(writes.length, 0);
    assert.equal(published.length, 0);
    await handlePanelButton(button(source, "confirm", {
      deferReply: async () => assert.fail("already deferred button"),
    }));
    assert.deepEqual(fetched, ["buyer", streamerId]);
    assert.deepEqual(writes, [[5000, "buyer"], [15000, streamerId]]);
    assert.deepEqual(published.map(({ id }) => id), [
      stage === "singer" ? TEXT_CHANNEL_IDS.SINGER_CROWN_STAGE : TEXT_CHANNEL_IDS.VOICE_CROWN_STAGE,
      SUPERCHAT_STREAMER_THREAD_IDS[streamerId],
    ]);
    assert.deepEqual(source.replies.at(-1).embeds, []);
    assert.deepEqual(source.replies.at(-1).components, []);
  });
}

test("確認後に配信者の資格が失われた場合、スパチャを決済しない", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(DbService, "getConnection", async () => assert.fail("invalid streamer must not charge"));
  const streamerId = "1086598017345388685";
  const source = modal(`${C.SUPERCHAT_SEND}:${streamerId}:singer`);
  source.guild = { members: { fetch: async ({ user, force }) => {
    assert.equal(force, true);
    return { id: user, roles: { cache: new Set() } };
  } } };
  await handleModalSubmit(source);
  await assert.rejects(handlePanelButton(button(source)), /配信者/);
});
