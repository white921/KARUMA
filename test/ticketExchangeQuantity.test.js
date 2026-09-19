const test = require('node:test');
const assert = require('node:assert/strict');
const { handleStringSelectMenu } = require('../dist/handler/interaction/stringSelectHandler');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { ItemService } = require('../dist/service/inventory/itemService');
const { AccountService } = require('../dist/service/account/accountService');
const { TicketExchangeService } = require('../dist/service/inventory/ticketExchangeService');
const { TicketExchangeLogService } = require('../dist/service/inventory/ticketExchangeLogService');
const { TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const { TICKET_EXCHANGE_DRAFT_TTL_MS } = require('../dist/constant/inventory/ticketExchange');
let sequence = 1550829000000000000n;
const nextId = () => String(++sequence);
const key = 'HOTEL_SECRET_FREE';

async function open(t, owned = 103) {
  const reads = t.mock.method(ItemService, 'getQuantities', async () => new Map([[key, owned]]));
  const accountChecks = t.mock.method(AccountService, 'hasAccount', async () => assert.fail('枚数調整で口座照会しない'));
  const creates = t.mock.method(TicketExchangeService, 'createRequest', async (id, user, item, quantity) => ({ rate: { itemKey: key, label: 'VIPホテル無料券', unitPrice: 3000 }, quantity, amount: quantity * 3000, owned }));
  const redeems = t.mock.method(TicketExchangeService, 'redeem', async () => ({ label: 'VIPホテル無料券', quantity: 5, amount: 15000, afterWallet: 16000, afterQuantity: owned - 5, alreadyCompleted: false }));
  const logs = t.mock.method(TicketExchangeLogService, 'send', async () => {});
  const cancels = t.mock.method(TicketExchangeService, 'cancel', async () => {});
  let response;
  const renders = [];
  const base = { channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', user: { id: '1001' }, client: {} };
  const editReply = async p => { response = p; renders.push(p); };
  let deferred = false;
  await handleStringSelectMenu({ ...base, id: nextId(), customId: 'ticketExchange:select', values: [key],
    deferUpdate: async () => { deferred = true; }, editReply });
  assert.equal(deferred, true);
  const buttons = () => response.components.flatMap(row => row.toJSON().components);
  const button = action => buttons().find(b => b.custom_id.startsWith(`ticketExchange:step:${action}:`));
  const press = (action, options = {}) => handlePanelButton({ ...base, id: nextId(), customId: button(action).custom_id, editReply, ...options });
  return { base, reads, accountChecks, creates, redeems, logs, cancels, renders, buttons, button, press, response: () => response, editReply };
}

test('種類選択後は5枚から開始し、＋−は5枚ずつ同じ画面を更新する', async t => {
  const f = await open(t);
  assert.match(f.response().content, /換金枚数: \*\*5枚\*\*/);
  assert.equal(f.button('minus').disabled, true);
  assert.equal(shouldDeferButtonUpdate(f.button('plus').custom_id), true);
  await f.press('plus');
  assert.match(f.response().content, /換金枚数: \*\*10枚\*\*/);
  assert.match(f.response().content, /受取額: \*\*30,000 LIA\*\*/);
  await f.press('minus');
  await f.press('minus');
  assert.match(f.response().content, /換金枚数: \*\*5枚\*\*/);
  assert.equal(f.reads.mock.callCount(), 1);
  assert.equal(f.accountChecks.mock.callCount(), 0);
  assert.equal(f.creates.mock.callCount(), 0);
  assert.equal(f.redeems.mock.callCount(), 0);
});

test('所持数の端数を除く最大枚数まで増やせるが上限を超えない', async t => {
  const f = await open(t, 12);
  await f.press('max');
  assert.match(f.response().content, /換金枚数: \*\*10枚\*\*/);
  assert.equal(f.button('plus').disabled, true);
  assert.equal(f.button('max').disabled, true);
  await f.press('plus');
  assert.match(f.response().content, /換金枚数: \*\*10枚\*\*/);
});

test('大量所持でも最大100,000枚に制限する', async t => {
  const f = await open(t, 100007);
  await f.press('max');
  assert.match(f.response().content, /換金枚数: \*\*100,000枚\*\*/);
});

test('連打は同じ古いボタンからでも加算され、画面更新は重ならない', async t => {
  const f = await open(t);
  const plus = f.button('plus').custom_id;
  let active = 0, peak = 0;
  const quantities = [];
  const editReply = async p => {
    active++; peak = Math.max(peak, active);
    quantities.push(Number(p.content.match(/換金枚数: \*\*(\d+)枚/)[1]));
    await new Promise(resolve => setImmediate(resolve));
    await f.editReply(p); active--;
  };
  await Promise.all(Array.from({ length: 5 }, () => f.press('plus', { customId: plus, editReply })));
  assert.deepEqual(quantities, [10, 15, 20, 25, 30]);
  assert.equal(peak, 1);
  assert.equal(f.creates.mock.callCount(), 0);
});

test('同一イベントの再送では増加を重複させず、別ユーザーは操作できない', async t => {
  const f = await open(t);
  const customId = f.button('plus').custom_id;
  const id = nextId();
  await Promise.all([f.press('plus', { customId, id }), f.press('plus', { customId, id })]);
  assert.match(f.response().content, /換金枚数: \*\*10枚\*\*/);
  await assert.rejects(f.press('plus', { user: { id: '1002' } }), /操作できません/);
});

test('増減と確定の連打は古い表示で決済せず、新しい表示を再確認する', async t => {
  const f = await open(t);
  const oldSubmit = f.button('submit').custom_id;
  await Promise.all([f.press('plus'), f.press('submit', { customId: oldSubmit })]);
  assert.match(f.response().content, /もう一度確定/);
  assert.match(f.response().content, /10枚/);
  assert.equal(f.creates.mock.callCount(), 0);
  const submit = f.button('submit').custom_id;
  await Promise.all([f.press('submit', { customId: submit }), f.press('submit', { customId: submit })]);
  assert.equal(f.creates.mock.callCount(), 1);
  assert.equal(f.creates.mock.calls[0].arguments[3], 10);
  assert.equal(f.redeems.mock.callCount(), 1);
  assert.equal(f.logs.mock.callCount(), 1);
  assert.deepEqual(f.response().components, []);
});

test('確定前のキャンセルはDBを変更せず、後続の＋も復活させない', async t => {
  const f = await open(t);
  const plus = f.button('plus').custom_id;
  await f.press('dismiss');
  await handlePanelButton({ ...f.base, id: nextId(), customId: plus, editReply: f.editReply });
  assert.match(f.response().content, /キャンセルしました/);
  assert.equal(f.creates.mock.callCount(), 0);
  assert.equal(f.cancels.mock.callCount(), 0);
  assert.equal(f.redeems.mock.callCount(), 0);
});

test('期限切れや再起動で失われた下書きは確定しない', async t => {
  const f = await open(t);
  const time = Date.now();
  t.mock.method(Date, 'now', () => time + TICKET_EXCHANGE_DRAFT_TTL_MS + 1);
  await f.press('submit');
  assert.match(f.response().content, /有効期限/);
  assert.equal(f.creates.mock.callCount(), 0);
  await handlePanelButton({ ...f.base, id: nextId(), customId: 'ticketExchange:step:submit:999999999999999999:0', editReply: f.editReply });
  assert.match(f.response().content, /やり直してください/);
});

test('確認作成後の再試行は同じ換金IDを使い、枚数を変更しない', async t => {
  const f = await open(t);
  let attempts = 0;
  const expected = { label: 'VIPホテル無料券', quantity: 5, amount: 15000, afterWallet: 16000, afterQuantity: 98, alreadyCompleted: false };
  f.redeems.mock.mockImplementation(async () => { if (++attempts === 1) throw new Error('temporary failure'); return expected; });
  await assert.rejects(f.press('submit'), /temporary failure/);
  await f.press('plus');
  assert.match(f.response().content, /枚数は変更できません/);
  assert.match(f.response().content, /換金枚数: \*\*5枚\*\*/);
  await f.press('submit');
  assert.equal(f.creates.mock.callCount(), 1);
  assert.equal(f.redeems.mock.callCount(), 2);
});

test('所持数が5枚未満なら調整画面を出さない', async t => {
  const f = await open(t, 4);
  assert.deepEqual(f.response().components, []);
  assert.match(f.response().content, /不足/);
});
