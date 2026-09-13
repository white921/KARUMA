const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");
const { PANEL_COMMAND_NAMES } = require("../dist/constant/command.js");
const { BOT_ID, TEXT_CHANNEL_IDS, THREAD_IDS } = require("../dist/constant/id.js");
const { COURT_SHOP_PANEL_MESSAGES } = require("../dist/constant/panel.js");
const { SHOP_TICKET_TYPE, SHOP_TICKET_NONE } = require("../dist/constant/shopTicket.js");
const { createCourtShopPanelActionRow } = require("../dist/service/shopPanelService.js");
const { resolvePanelInstallTarget, PANEL_INSTALL_TARGETS } = require("../dist/service/panelInstallService.js");
const { handlePanelButton } = require("../dist/handler/panelButtonHandler.js");
const { handleModalSubmit } = require("../dist/handler/modalHandler.js");
const { AccountService } = require("../dist/service/accountService.js");
const { ShopPaymentService } = require("../dist/service/shopPaymentService.js");
const { ShopTicketService } = require("../dist/service/shopTicketService.js");
const { DbService } = require("../dist/service/dbService.js");
const { HistoryService } = require("../dist/service/historyService.js");

const commandName = PANEL_COMMAND_NAMES.COURT_SHOP_SEND;

test("宮廷市場の購入ボタンから必須2項目のモーダルが直接開く", async (t) => {
  assert.equal(TEXT_CHANNEL_IDS.COURT_SHOP_PANEL, "1548513061130862593");
  assert.equal(resolvePanelInstallTarget(TEXT_CHANNEL_IDS.COURT_SHOP_PANEL), PANEL_INSTALL_TARGETS.COURT_SHOP);
  assert.equal(COURT_SHOP_PANEL_MESSAGES.DESCRIPTION, "宮廷市場の商品購入はこちらのパネルから行ってください。\n割引チケット、Lv特典は使用できません。");
  const buttons = createCourtShopPanelActionRow().toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => [custom_id, label]), [[commandName, "購入"], [PANEL_COMMAND_NAMES.VIEW, "残高確認"]]);
  t.mock.method(AccountService, "hasAccount", async () => true);
  let modal;
  await handlePanelButton({ customId: commandName, user: { id: "buyer" }, showModal: async (value) => { modal = value.toJSON(); } });
  assert.equal(modal.custom_id, commandName);
  assert.equal(modal.title, "宮廷市場商品購入");
  const fields = modal.components.flatMap((row) => row.components);
  assert.deepEqual(fields.map(({ custom_id, required }) => [custom_id, required]), [["amount", true], ["comment", true]]);
});

function paymentFixture(t, wallet = 10000, failCredit = false) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    execute: async (sql, params) => {
      calls.push([sql, params]);
      if (sql.startsWith("SELECT")) return [[{ wallet: params[0] === BOT_ID ? 20000 : wallet }]];
      if (failCredit && sql.startsWith("UPDATE") && params[1] === BOT_ID) throw new Error("credit failed");
      return [{}];
    },
  };
  t.mock.method(DbService, "getConnection", async () => connection);
  const ticket = t.mock.method(ShopTicketService, "consume", async () => assert.fail("宮廷市場でチケットを消費してはいけない"));
  const fields = new Map([["amount", "5000"], ["comment", " 王冠 "]]);
  const interaction = {
    customId: commandName,
    user: { id: "buyer" },
    fields: { fields, getTextInputValue: (key) => fields.get(key) },
    deferReply: async (payload) => calls.push(["defer", payload]),
    editReply: async (payload) => calls.push(["reply", payload]),
    client: { channels: { fetch: async (id) => {
      calls.push(["fetch", id]);
      return { isThread: () => true, isTextBased: () => true, send: async (message) => calls.push(["log", message]) };
    } } },
  };
  return { interaction, calls, ticket };
}

test("宮廷市場のモーダル送信でBotへ全額送金し、履歴と指定スレッドに商品を記録する", async (t) => {
  const { interaction, calls, ticket } = paymentFixture(t);
  await handleModalSubmit(interaction);
  const updates = calls.filter(([sql]) => sql.startsWith("UPDATE"));
  assert.deepEqual(updates.map(([, params]) => params), [[5000, "buyer"], [25000, BOT_ID]]);
  const action = calls.find(([sql]) => sql.startsWith("INSERT INTO actions"))[1];
  assert.deepEqual(action.slice(0, 6), ["court_shop_purchase", 5000, "buyer", BOT_ID, 5000, 25000]);
  assert.match(action[6], /^王冠\n/);
  assert.equal(calls.filter(([op]) => op === "commit").length, 1);
  assert.equal(calls.filter(([op]) => op === "rollback").length, 0);
  assert.equal(ticket.mock.callCount(), 0);
  assert.equal(calls.find(([op]) => op === "defer")[1].flags, MessageFlags.Ephemeral);
  assert.deepEqual(calls.find(([op]) => op === "fetch"), ["fetch", "1548700013306052689"]);
  assert.equal(THREAD_IDS.COURT_SHOP_LOG_THREAD, "1548700013306052689");
  const log = calls.find(([op]) => op === "log")[1];
  assert.match(log, /宮廷市場商品購入/);
  assert.match(log, /<@buyer>が5,000LIA/);
  assert.match(log, /王冠/);
  const history = HistoryService.createHistoryString({ id: 1, command_name: action[0], amount: 5000, from_user_id: "buyer", to_user_id: BOT_ID, from_after_wallet: 5000, to_after_wallet: 25000, comment: action[6], created_at: new Date() }, "buyer");
  assert.match(history, /宮廷市場商品購入/);
  assert.match(history, /-5,000LIA/);
});

test("宮廷市場は割引券を渡されても適用せず入力額を送金する", async (t) => {
  const { interaction, calls, ticket } = paymentFixture(t);
  await ShopPaymentService.pay(interaction, 5000, "王冠", SHOP_TICKET_TYPE.DISCOUNT_10, commandName);
  assert.equal(ticket.mock.callCount(), 0);
  assert.deepEqual(calls.filter(([sql]) => sql.startsWith("UPDATE")).map(([, params]) => params), [[5000, "buyer"], [25000, BOT_ID]]);
});

for (const [name, wallet, failCredit, error] of [["残高不足", 100, false, /残高が不足/], ["Botへの入金失敗", 10000, true, /credit failed/]]) {
  test(`宮廷市場は${name}ならロールバックし成功通知・ログを送らない`, async (t) => {
    const { interaction, calls } = paymentFixture(t, wallet, failCredit);
    await assert.rejects(ShopPaymentService.pay(interaction, 5000, "王冠", SHOP_TICKET_NONE, commandName), error);
    assert.equal(calls.filter(([op]) => op === "rollback").length, 1);
    assert.equal(calls.filter(([op]) => ["commit", "reply", "log"].includes(op)).length, 0);
    assert.equal(calls.at(-1)[0], "release");
  });
}

test("不正な金額・空の商品名はDBを変更する前に拒否する", async (t) => {
  const getConnection = t.mock.method(DbService, "getConnection", async () => assert.fail("invalid input reached DB"));
  for (const amount of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(ShopPaymentService.pay({}, amount, "王冠", SHOP_TICKET_NONE, commandName));
  }
  await assert.rejects(ShopPaymentService.pay({}, 5000, "  ", SHOP_TICKET_NONE, commandName), /商品名を入力/);
  assert.equal(getConnection.mock.callCount(), 0);
});
