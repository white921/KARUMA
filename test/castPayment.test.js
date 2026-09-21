const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ComponentType } = require('discord.js');
const { CastPaymentService, calculateCastAmount, isEligibleCast } = require('../dist/service/cast/castPaymentService');
const { CAST_MENUS } = require('../dist/constant/cast/castPayment');
const { BOT_ID, ROLE_IDS, TEXT_CHANNEL_IDS, THREAD_IDS } = require('../dist/constant/shared/id');
const { DbService } = require('../dist/service/system/dbService');
const { createCastPaymentPanelPayload } = require('../dist/panel/cast/castPaymentPanelService');
const { resolvePanelInstallTarget } = require('../dist/panel/panelInstallService');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { handleStringSelectMenu } = require('../dist/handler/interaction/stringSelectHandler');
const { handleModalSubmit } = require('../dist/handler/interaction/modalHandler');
const member = (id, role, bot = false) => ({ id, displayName: `cast-${id}`, user: { bot }, roles: { cache: new Collection([[role, {}]]) } });
function fixture(t, menu = 'group', extra = {}) {
  const members = new Collection([
    ['maid', member('maid', ROLE_IDS.CAST_MAID)], ['butler', member('butler', ROLE_IDS.CAST_BUTLER)],
    ['ordinary', member('ordinary', 'other')], ['bot', member('bot', ROLE_IDS.CAST_MAID, true)],
  ]);
  const edits = [], modals = [], logs = [], payments = [];
  const thread = { id: CAST_MENUS[menu].threadId, guildId: 'guild', isThread: () => true, locked: false,
    permissionsFor: () => ({ has: () => true }), send: async p => { logs.push(p); return { id: 'log' }; } };
  const base = { user: { id: 'payer' }, guildId: 'guild', channelId: TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL,
    guild: { members: { fetch: async options => options ? members.get(options.user) : members, fetchMe: async () => ({}) } },
    client: { channels: { fetch: async id => { assert.equal(id, CAST_MENUS[menu].threadId); return thread; } } },
    editReply: async p => { edits.push(p); }, showModal: async p => modals.push(p),
    deferReply: async () => {}, deferUpdate: async () => {}, ...extra };
  t.mock.method(CastPaymentService, 'transfer', async s => { payments.push(structuredClone(s)); return true; });
  t.mock.method(DbService, 'getConnection', async () => ({ execute: async () => [[], []], release() {} }));
  function interaction(kind, customId, values, override = {}) {
    return { ...base, customId, values, isButton: () => kind === 'button', isStringSelectMenu: () => kind === 'select',
      isModalSubmit: () => kind === 'modal', isFromMessage: () => true, ...override };
  }
  function currentId(action) {
    const component = edits.at(-1).components.flatMap(r => r.toJSON().components).find(c => c.custom_id?.split(':')[1] === action);
    assert.ok(component, action); return component.custom_id;
  }
  return { members, edits, modals, logs, payments, thread, interaction, currentId,
    start: () => handlePanelButton(interaction('button', `castPayment:start:${menu}`)),
    select: (values, override) => handleStringSelectMenu(interaction('select', currentId('cast'), values, override)),
    button: (action, override) => handlePanelButton(interaction('button', currentId(action), undefined, override)),
    modal: (amount, option) => handleModalSubmit(interaction('modal', modals.at(-1).toJSON().custom_id, undefined,
      { fields: { getTextInputValue: key => key === 'amount' ? amount : option } })),
  };
}
test('five entry buttons and install target match requested channel', () => {
  const p = createCastPaymentPanelPayload();
  assert.deepEqual(p.components[0].toJSON().components.map(c => c.label), ['ツーショ', 'フリー', '団体指名', 'お給仕メイド', 'お仕え執事']);
  assert.equal(resolvePanelInstallTarget('1551478036673728512'), 'cast_payment');
});
test('prices are per hour and group prices are per cast', () => {
  assert.equal(calculateCastAmount('group', 3, 2), 300000);
  assert.equal(calculateCastAmount('twoshot', 1, 3), 90000);
  assert.equal(calculateCastAmount('free', 1, 2), 20000);
  for (const [c, h] of [[0, 1], [1, 0], [1, 1.5], [2, Infinity]]) assert.throws(() => calculateCastAmount('group', c, h));
  assert.throws(() => calculateCastAmount('twoshot', 2, 1));
  for (const amount of [0, -1, 1.5, Infinity, 2147483648]) assert.throws(() => calculateCastAmount('maid', 1, 1, amount));
});
test('role restrictions exclude unrelated members and bots', () => {
  assert.equal(isEligibleCast(member('m', ROLE_IDS.CAST_MAID), 'maid'), true);
  assert.equal(isEligibleCast(member('m', ROLE_IDS.CAST_MAID), 'butler'), false);
  assert.equal(isEligibleCast(member('m', ROLE_IDS.CAST_MAID, true), 'group'), false);
  assert.equal(isEligibleCast(member('m', 'other'), 'group'), false);
});
test('group accumulates and removes select choices, then pays exactly once after final confirmation', async t => {
  const f = fixture(t); await f.start();
  assert.equal(f.edits.at(-1).components[0].toJSON().components[0].type, ComponentType.StringSelect);
  await f.select(['maid']); await f.select(['butler']);
  assert.match(f.edits.at(-1).embeds[0].toJSON().fields[0].value, /maid[\s\S]*butler/);
  await f.select(['maid']); await f.select(['maid']);
  await f.button('chosen'); await f.button('plus'); await f.button('review');
  assert.equal(f.payments.length, 0);
  assert.match(JSON.stringify(f.edits.at(-1).embeds[0]), /200,000/);
  const payId = f.currentId('pay');
  await Promise.allSettled([handlePanelButton(f.interaction('button', payId)), handlePanelButton(f.interaction('button', payId))]);
  assert.equal(f.payments.length, 1); assert.equal(f.payments[0].hours, 2);
  assert.equal(f.logs.length, 1); assert.equal(f.thread.id, THREAD_IDS.CAST_BASIC_LOG);
});
for (const menu of ['twoshot', 'free']) test(`${menu} chooses a single cast and hours`, async t => {
  const f = fixture(t, menu); await f.start();
  assert.equal(f.edits.at(-1).components[0].toJSON().components[0].max_values, 1);
  await f.select(['maid']); await f.button('review'); await f.button('pay');
  assert.equal(f.payments.length, 1); assert.equal(f.logs.length, 1);
});
for (const menu of ['maid', 'butler']) test(`${menu} opens modal from select and logs option only after payment`, async t => {
  const f = fixture(t, menu); await f.start();
  assert.deepEqual(f.edits.at(-1).components[0].toJSON().components[0].options.map(o => o.value), [menu]);
  await f.select([menu]); assert.equal(f.modals.length, 1); assert.equal(f.payments.length, 0);
  await f.modal('15000', 'オプションテスト'); assert.equal(f.payments.length, 0);
  await f.button('pay');
  assert.equal(f.payments[0].amount, 15000); assert.equal(f.payments[0].option, 'オプションテスト');
  assert.match(JSON.stringify(f.logs[0]), /オプションテスト/);
});
test('modal cancellation leaves a reopen button; invalid amount does not pay', async t => {
  const f = fixture(t, 'maid'); await f.start(); await f.select(['maid']);
  await f.button('option'); assert.equal(f.modals.length, 2);
  await assert.rejects(f.modal('1e5', 'option'), /整数/);
  await assert.rejects(f.modal('100', ' '), /オプション/);
  assert.equal(f.payments.length, 0); await f.button('cancel');
});
test('cancel and stale confirmation cannot debit; another user cannot operate', async t => {
  const f = fixture(t); await f.start();
  await assert.rejects(f.select(['maid'], { user: { id: 'other' } }), /操作できません/);
  await assert.rejects(f.select(['ordinary']), /無効/);
  const old = f.currentId('cast'); await f.select(['maid']);
  await assert.rejects(handleStringSelectMenu(f.interaction('select', old, ['butler'])), /重複/);
  await f.button('chosen'); await f.button('review'); const payId = f.currentId('pay');
  await f.button('cancel'); await assert.rejects(handlePanelButton(f.interaction('button', payId)), /処理済み/);
  assert.equal(f.payments.length, 0);
});
test('role removal or unavailable log thread prevents all money movement', async t => {
  const f = fixture(t, 'free'); await f.start(); await f.select(['maid']); await f.button('review');
  f.members.get('maid').roles.cache.clear(); await assert.rejects(f.button('pay'), /対象ロール/);
  assert.equal(f.payments.length, 0);
  f.members.get('maid').roles.cache.set(ROLE_IDS.CAST_MAID, {});
  await f.start(); await f.select(['maid']); await f.button('review'); f.thread.locked = true;
  await assert.rejects(f.button('pay'), /ログ/); assert.equal(f.payments.length, 0);
});
test('more than 25 cast members can be selected across pages', async t => {
  const f = fixture(t); for (let i = 0; i < 30; i++) f.members.set(String(i), member(String(i), ROLE_IDS.CAST_MAID));
  await f.start(); const first = f.edits.at(-1).components[0].toJSON().components[0].options[0].value;
  await f.select([first]); await f.button('next');
  const last = f.edits.at(-1).components[0].toJSON().components[0].options.at(-1).value;
  await f.select([last]); await f.button('chosen'); await f.button('review'); await f.button('pay');
  assert.deepEqual(f.payments[0].castIds, [first, last]);
});
test('a log failure reports completed payment and cannot charge twice', async t => {
  const f = fixture(t, 'free'); t.mock.method(console, 'error', () => {});
  f.thread.send = async () => { throw new Error('discord unavailable'); };
  await f.start(); await f.select(['maid']); await f.button('review'); await f.button('pay');
  assert.equal(f.payments.length, 1); assert.match(f.edits.at(-1).content, /再度支払わず/);
});

function transactionFixture(t, { balance = 100000, duplicate = false, failInsert = false } = {}) {
  let payer = balance, recipient = 100, snapshot;
  const calls = [];
  const connection = {
    beginTransaction: async () => { snapshot = [payer, recipient]; calls.push('begin'); },
    execute: async (sql, params) => {
      calls.push(sql);
      if (sql.startsWith('SELECT *')) return [[{ user_id: 'payer', wallet: payer }, { user_id: BOT_ID, wallet: recipient }]];
      if (sql.startsWith('SELECT id')) return [duplicate ? [{ id: 'id' }] : []];
      if (sql.includes('wallet = wallet -')) payer -= params[0];
      if (sql.includes('wallet = wallet +')) recipient += params[0];
      if (failInsert && sql.startsWith('INSERT INTO cast_payments')) throw new Error('insert failed');
      return [[], []];
    },
    rollback: async () => { [payer, recipient] = snapshot; calls.push('rollback'); },
    commit: async () => { calls.push('commit'); }, release: () => calls.push('release'),
  };
  t.mock.method(DbService, 'getConnection', async () => connection);
  const session = { id: 'payment-id', userId: 'payer', menu: 'group', castIds: ['maid'], hours: 1, amount: 0, option: '' };
  return { calls, session, balances: () => [payer, recipient] };
}
test('transaction debits user, credits only bot, and records details atomically', async t => {
  const f = transactionFixture(t); assert.equal(await CastPaymentService.transfer(f.session), true);
  assert.deepEqual(f.balances(), [50000, 50100]); assert.ok(f.calls.includes('commit'));
  assert.ok(f.calls.some(c => c.includes('ORDER BY user_id FOR UPDATE')));
});
test('duplicate payment record skips debit', async t => {
  const f = transactionFixture(t, { duplicate: true }); assert.equal(await CastPaymentService.transfer(f.session), false);
  assert.deepEqual(f.balances(), [100000, 100]); assert.ok(!f.calls.includes('commit'));
});
test('insufficient balance and failed detail insert roll back all changes', async t => {
  const f = transactionFixture(t, { balance: 100 });
  await assert.rejects(CastPaymentService.transfer(f.session)); assert.deepEqual(f.balances(), [100, 100]);
  const g = transactionFixture(t, { failInsert: true });
  await assert.rejects(CastPaymentService.transfer(g.session), /insert failed/);
  assert.deepEqual(g.balances(), [100000, 100]); assert.equal(g.calls.at(-1), 'release');
});
