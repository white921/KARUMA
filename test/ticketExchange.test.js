const test = require('node:test');
const assert = require('node:assert/strict');
const { TICKET_EXCHANGE_RATES, parseTicketExchangeQuantity, getTicketExchangeRate } = require('../dist/constant/inventory/ticketExchange');
const { ITEM_KEY } = require('../dist/constant/inventory/item');
const { TEXT_CHANNEL_IDS, BOT_ID } = require('../dist/constant/shared/id');
const { createTicketExchangePanelPayload } = require('../dist/panel/inventory/ticketExchangePanelService');
const { resolvePanelInstallTarget } = require('../dist/panel/panelInstallService');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { handleStringSelectMenu } = require('../dist/handler/interaction/stringSelectHandler');
const { handleModalSubmit } = require('../dist/handler/interaction/modalHandler');
const { AccountService } = require('../dist/service/account/accountService');
const { ItemService } = require('../dist/service/inventory/itemService');
const { TicketExchangeService } = require('../dist/service/inventory/ticketExchangeService');
const { TicketExchangeLogService } = require('../dist/service/inventory/ticketExchangeLogService');
const { HistoryService } = require('../dist/service/currency/historyService');
const channel = { channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', user: { id: '1001' } };

test('換金対象は所持品の全5種類、すべて5枚単位で受け付ける', () => {
  assert.deepEqual(new Set(TICKET_EXCHANGE_RATES.map(r => r.itemKey)), new Set(Object.values(ITEM_KEY)));
  assert.deepEqual(TICKET_EXCHANGE_RATES.map(r => r.unitPrice * 5), [15000, 25000, 2500, 2500, 5000]);
  for (const q of ['5', '10', ' 15 ', '100000']) assert.equal(parseTicketExchangeQuantity(q), Number(q));
  for (const q of ['0', '1', '4', '6', '-5', '5.0', '1e1', '', 'NaN', '100005', '5枚']) assert.throws(() => parseTicketExchangeQuantity(q));
  assert.throws(() => getTicketExchangeRate('UNKNOWN'));
});

test('指定チャンネルで設置でき、パネルにレート・条件・操作を表示する', () => {
  assert.equal(channel.channelId, '1550818163699093574');
  assert.equal(resolvePanelInstallTarget(channel.channelId), 'ticket_exchange');
  const panel = createTicketExchangePanelPayload();
  assert.match(panel.embeds[0].toJSON().description, /5枚単位/);
  assert.match(panel.embeds[0].toJSON().description, /25,000 LIA/);
  assert.equal(panel.components[0].toJSON().components[0].custom_id, 'ticketExchange:start');
  assert.equal(shouldDeferButtonUpdate('ticketExchange:start'), false);
  assert.equal(shouldDeferButtonUpdate('ticketExchange:confirm:1234567890123456789'), true);
  assert.equal(shouldDeferButtonUpdate('ticketExchange:cancel:1234567890123456789'), true);
});

test('所持数5枚以上の種類だけ表示し、選択→枚数→確認→確定をルーティングする', async t => {
  t.mock.method(AccountService, 'hasAccount', async () => true);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([[ITEM_KEY.HOTEL_SECRET_FREE, 12], [ITEM_KEY.SHOP_DISCOUNT_5, 4]]));
  let response, modal;
  const editReply = async p => { response = p; };
  await handlePanelButton({ ...channel, customId: 'ticketExchange:start', editReply });
  assert.deepEqual(response.components[0].toJSON().components[0].options.map(o => o.value), [ITEM_KEY.HOTEL_SECRET_FREE]);
  await handleStringSelectMenu({ ...channel, customId: 'ticketExchange:select', values: [ITEM_KEY.HOTEL_SECRET_FREE], showModal: async m => { modal = m.toJSON(); } });
  assert.equal(modal.custom_id, 'ticketExchange:quantity:HOTEL_SECRET_FREE');
  const requestId = '1234567890123456789';
  t.mock.method(TicketExchangeService, 'createRequest', async (id, user, key, q) => {
    assert.deepEqual([id, user, key, q], [requestId, '1001', ITEM_KEY.HOTEL_SECRET_FREE, 10]);
    return { rate: getTicketExchangeRate(key), quantity: q, amount: 30000, owned: 12 };
  });
  let deferred = false;
  await handleModalSubmit({ ...channel, id: requestId, customId: modal.custom_id, fields: { getTextInputValue: () => '10' }, deferReply: async () => { deferred = true; }, editReply });
  assert.equal(deferred, true);
  assert.match(response.content, /30,000 LIA/);
  const log = t.mock.method(TicketExchangeLogService, 'send', async () => {});
  const confirmId = response.components[0].toJSON().components[0].custom_id;
  t.mock.method(TicketExchangeService, 'redeem', async (id, user) => {
    assert.deepEqual([id, user], [requestId, '1001']);
    return { label: 'VIPホテル無料券', quantity: 10, amount: 30000, afterWallet: 31000, afterQuantity: 2, alreadyCompleted: false };
  });
  await handlePanelButton({ ...channel, customId: confirmId, editReply });
  assert.equal(log.mock.callCount(), 1);
  assert.deepEqual(log.mock.calls[0].arguments.slice(1, 4), ['guild', '1001', requestId]);
  assert.match(response.content, /31,000 LIA/);
  assert.deepEqual(response.components, []);
});

test('不足・キャンセル・別チャンネルからの操作を処理する', async t => {
  t.mock.method(AccountService, 'hasAccount', async () => true);
  t.mock.method(ItemService, 'getQuantities', async () => new Map());
  let response;
  const editReply = async p => { response = p; };
  await handlePanelButton({ ...channel, customId: 'ticketExchange:start', editReply });
  assert.match(response.content, /ありません/);
  const cancel = t.mock.method(TicketExchangeService, 'cancel', async () => {});
  const redeem = t.mock.method(TicketExchangeService, 'redeem', async () => assert.fail('cancel redeemed'));
  await handlePanelButton({ ...channel, customId: 'ticketExchange:cancel:1234567890123456789', editReply });
  assert.equal(cancel.mock.callCount(), 1);
  assert.equal(redeem.mock.callCount(), 0);
  assert.deepEqual(response.components, []);
  await assert.rejects(handlePanelButton({ ...channel, channelId: 'wrong', customId: 'ticketExchange:start', editReply }), /パネルから/);
});

test('換金をチケット名・枚数付きの入金履歴として表示する', () => {
  const text = HistoryService.createHistoryString({ id: 1, command_name: 'ticket_exchange', amount: 15000, from_user_id: BOT_ID,
    to_user_id: '1001', from_after_wallet: 0, to_after_wallet: 16000, comment: 'VIPホテル無料券 5枚換金', created_at: new Date() }, '1001');
  assert.match(text, /チケット換金/);
  assert.match(text, /\+15,000LIA/);
  assert.match(text, /5枚換金/);
});
