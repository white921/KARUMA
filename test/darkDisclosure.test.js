const test = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder } = require('discord.js');
const { DarkDisclosureStore, assertDisclosureRecipient } = require('../dist/service/market/darkDisclosureStore');
const { DarkDisclosureService } = require('../dist/service/market/darkDisclosureService');
const { DarkMessageStore } = require('../dist/service/market/darkMessageStore');
const { DbService } = require('../dist/service/system/dbService');
const { createDisclosureOffer, createDisclosureConfirmation } = require('../dist/panel/market/darkDisclosurePanel');
const { createDarkMessagePayload } = require('../dist/service/market/darkMessageService');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { BOT_ID } = require('../dist/constant/shared/id');

const requestId = '123456789012345678', confirmationId = '223456789012345678';
const context = () => ({ requestId, userId: 'recipient', guildId: 'guild', channelId: 'delivery' });
const request = () => ({ request_id: requestId, buyer_id: 'secret-sender', recipient_id: 'recipient', guild_id: 'guild',
  delivery_channel_id: 'delivery', delivery_message_id: 'message', status: 'delivered', product: 'letter' });

function database(t, changes = {}) {
  let state = { wallet: 50000, frozen: false, botWallet: 100000, request: request(), paid: null, actions: [],
    confirmation: { confirmation_id: confirmationId, request_id: requestId, user_id: 'recipient', status: 'pending', amount: 35000, expired: 0 },
    ...changes };
  let snapshot, released = 0;
  const queries = [];
  const connection = {
    beginTransaction: async () => { snapshot = structuredClone(state); },
    commit: async () => { snapshot = undefined; },
    rollback: async () => { if (snapshot) { state = snapshot; snapshot = undefined; } },
    release: () => released++,
    execute: async (sql, args) => {
      queries.push([sql, args]);
      if (changes.failOn && sql.includes(changes.failOn)) throw new Error('injected DB failure');
      if (sql.startsWith('SELECT wallet, is_frozen')) return [[...(state.missingAccount ? [] : [{ wallet: state.wallet, is_frozen: state.frozen ? 1 : 0 }])]];
      if (sql.startsWith('SELECT wallet FROM accounts')) return [[...(state.missingBot ? [] : [{ wallet: state.botWallet }])]];
      if (sql.startsWith('SELECT * FROM dark_message_requests')) return [[state.request]];
      if (sql.startsWith('SELECT * FROM dark_message_disclosures')) return [[...(state.paid ? [state.paid] : [])]];
      if (sql.includes('FROM dark_message_disclosure_confirmations')) return [[...(state.confirmation ? [state.confirmation] : [])]];
      if (sql.startsWith('UPDATE accounts SET wallet = wallet -')) state.wallet -= args[0];
      else if (sql.startsWith('UPDATE accounts SET wallet = wallet +')) state.botWallet += args[0];
      else if (sql.startsWith('INSERT INTO actions')) { state.actions.push(args); return [{ insertId: 1 }]; }
      else if (sql.startsWith('INSERT INTO dark_message_disclosures')) { assert.equal(state.paid, null); state.paid = { request_id: args[0], payer_id: args[2], amount: args[3], after_wallet: args[4] }; }
      else if (sql.startsWith('UPDATE dark_message_disclosure_confirmations')) state.confirmation.status = 'completed';
      else throw new Error('Unexpected SQL ' + sql);
      return [{ affectedRows: 1 }];
    },
  };
  t.mock.method(DbService, 'getConnection', async () => connection);
  return { state: () => state, queries, released: () => released };
}

test('受取人・guild・TC・配送完了を検証。送信者や管理者の代理購入は不可', () => {
  assertDisclosureRecipient(request(), context());
  for (const change of [{ userId: 'secret-sender' }, { userId: 'administrator' }, { channelId: 'ticket' }, { guildId: 'other' }, { userId: BOT_ID }])
    assert.throws(() => assertDisclosureRecipient(request(), { ...context(), ...change }));
  for (const change of [{ status: 'sending' }, { status: 'failed' }, { delivery_message_id: null }])
    assert.throws(() => assertDisclosureRecipient({ ...request(), ...change }, context()));
});

test('35,000LIAを引き落としてBotへ入金し、履歴と開示記録を同時に確定', async t => {
  const db = database(t);
  const result = await DarkDisclosureStore.purchase(confirmationId, context());
  assert.equal(result.alreadyPaid, false);
  assert.equal(result.request.buyer_id, 'secret-sender');
  assert.equal(db.state().wallet, 15000);
  assert.equal(db.state().botWallet, 135000);
  assert.equal(db.state().actions.length, 1);
  assert.equal(db.state().confirmation.status, 'completed');
  assert.equal(JSON.stringify(db.state().actions).includes('secret-sender'), false);
  assert.equal(db.released(), 1);
  const repeated = await DarkDisclosureStore.purchase('different-confirmation', context());
  assert.equal(repeated.alreadyPaid, true);
  assert.equal(db.state().wallet, 15000);
  assert.equal(db.state().actions.length, 1);
});

for (const [name, change] of [
  ['残高不足', { wallet: 34999 }], ['凍結', { frozen: true }], ['口座なし', { missingAccount: true }],
  ['Bot口座なし', { missingBot: true }], ['Bot上限', { botWallet: 2147483647 }],
  ['期限切れ', { expired: 1 }], ['キャンセル', { status: 'cancelled' }], ['確認なし', { confirmation: null }],
  ['別人の確認', { user_id: 'other' }], ['別メッセージの確認', { request_id: 'other' }], ['価格違い', { amount: 1 }],
]) {
  test(`${name}なら課金も開示記録も行わない`, async t => {
    const isConfirmation = ['expired', 'status', 'user_id', 'request_id', 'amount'].some(k => k in change);
    const db = database(t, isConfirmation ? {} : change);
    if (isConfirmation) Object.assign(db.state().confirmation, change);
    const before = db.state().wallet;
    await assert.rejects(DarkDisclosureStore.purchase(confirmationId, context()));
    assert.equal(db.state().wallet, before);
    assert.equal(db.state().actions.length, 0);
    assert.equal(db.state().paid, null);
  });
}

for (const failOn of ['UPDATE accounts SET wallet = wallet +', 'INSERT INTO actions', 'INSERT INTO dark_message_disclosures', 'UPDATE dark_message_disclosure_confirmations']) {
  test(`${failOn}の途中失敗でも引き落としをロールバック`, async t => {
    const db = database(t, { failOn });
    await assert.rejects(DarkDisclosureStore.purchase(confirmationId, context()), /injected/);
    assert.equal(db.state().wallet, 50000);
    assert.equal(db.state().botWallet, 100000);
    assert.equal(db.state().paid, null);
    assert.equal(db.state().actions.length, 0);
    assert.equal(db.released(), 1);
  });
}

test('購入済みなら残高不足・凍結・口座削除後でも再課金せず結果を返す', async t => {
  const db = database(t, { wallet: 0, frozen: true, missingAccount: true, paid: { after_wallet: 15000 } });
  const result = await DarkDisclosureStore.purchase(confirmationId, context());
  assert.equal(result.alreadyPaid, true);
  assert.equal(db.state().actions.length, 0);
});

test('公開パネルと確認画面は価格・残高を表示し、送信元は含まない', () => {
  const payload = createDarkMessagePayload('letter', 'body', undefined, requestId);
  assert.equal(payload.embeds[0].data.description, 'body');
  assert.match(payload.embeds[1].data.description, /35,000 LIA/);
  assert.equal(payload.components[0].components[0].data.custom_id, `darkDisclosure:show:${requestId}`);
  const confirm = createDisclosureConfirmation(requestId, confirmationId, 'letter', 50000);
  assert.match(confirm.embeds[0].data.description, /15,000 LIA/);
  assert.equal(JSON.stringify(confirm).includes('secret-sender'), false);
  assert.equal(shouldDeferButtonUpdate(`darkDisclosure:show:${requestId}`), false);
  for (const action of ['confirm', 'cancel']) assert.equal(shouldDeferButtonUpdate(`darkDisclosure:${action}:${requestId}:${confirmationId}`), true);
});

function ui(t, action = 'show') {
  const events = [];
  const originalEmbed = new EmbedBuilder().setTitle('闇手紙').setDescription('body');
  const message = { author: { id: 'bot' }, embeds: [originalEmbed], edit: async p => events.push(['public', p]) };
  t.mock.method(DarkMessageStore, 'get', async () => request());
  t.mock.method(DarkDisclosureStore, 'get', async () => undefined);
  t.mock.method(DarkDisclosureStore, 'prepare', async () => { events.push(['prepare']); return 50000; });
  t.mock.method(DarkDisclosureStore, 'purchase', async () => { events.push(['purchase']); return { request: request(), alreadyPaid: false }; });
  t.mock.method(DarkDisclosureStore, 'cancel', async () => { events.push(['cancel']); });
  const i = { id: confirmationId, user: { id: 'recipient' }, guildId: 'guild', channelId: 'delivery',
    client: { user: { id: 'bot' } }, customId: `darkDisclosure:${action}:${requestId}` + (action === 'show' ? '' : `:${confirmationId}`),
    channel: { id: 'delivery', isTextBased: () => true, isDMBased: () => false, messages: { fetch: async () => message } },
    editReply: async p => events.push(['private', p]) };
  return { i, events, message };
}

test('最初のクリックは確認画面だけ。課金・公開はしない', async t => {
  const { i, events } = ui(t);
  await handlePanelButton(i);
  assert.deepEqual(events.map(e => e[0]), ['prepare', 'private']);
  assert.equal(JSON.stringify(events).includes('secret-sender'), false);
});

test('確定後だけ開示。元の本文と音声添付を保持し送信者にメンション通知しない', async t => {
  const { i, events } = ui(t, 'confirm');
  await handlePanelButton(i);
  assert.deepEqual(events.map(e => e[0]), ['purchase', 'public', 'private']);
  const p = events[1][1];
  assert.equal(p.embeds[0].data.description, 'body');
  assert.match(p.embeds[1].data.description, /secret-sender/);
  assert.equal(p.attachments, undefined);
  assert.equal(p.files, undefined);
  assert.deepEqual(p.allowedMentions.parse, []);
  assert.deepEqual(p.components, []);
});

test('キャンセルは確認だけを閉じる', async t => {
  const { i, events } = ui(t, 'cancel');
  await handlePanelButton(i);
  assert.deepEqual(events.map(e => e[0]), ['cancel', 'private']);
});

test('受取人以外は開示済みでも結果にアクセスできない', async t => {
  const { i, events } = ui(t);
  i.user.id = 'other';
  t.mock.method(DarkDisclosureStore, 'get', async () => ({ after_wallet: 15000 }));
  await assert.rejects(handlePanelButton(i), /本人だけ/);
  assert.deepEqual(events, []);
});

test('元メッセージが消えた場合は新たに課金しない', async t => {
  const { i, events } = ui(t, 'confirm');
  i.channel.messages.fetch = async () => { throw new Error('deleted'); };
  await assert.rejects(handlePanelButton(i), /見つかりません/);
  assert.deepEqual(events, []);
});

test('公開表示失敗時も本人へ結果を返し、再表示では追加課金しない', async t => {
  const { i, events, message } = ui(t, 'confirm');
  t.mock.method(console, 'error', () => {});
  message.edit = async () => { throw new Error('Discord unavailable'); };
  await handlePanelButton(i);
  assert.deepEqual(events.map(e => e[0]), ['purchase', 'private']);
  assert.match(events[1][1].embeds[0].data.description, /secret-sender/);
  t.mock.method(DarkDisclosureStore, 'get', async () => ({ after_wallet: 15000 }));
  i.customId = `darkDisclosure:show:${requestId}`;
  message.edit = async p => events.push(['public', p]);
  await handlePanelButton(i);
  assert.equal(events.filter(e => e[0] === 'purchase').length, 1);
  assert.match(events.at(-1)[1].content, /追加の引き落としはありません/);
});
