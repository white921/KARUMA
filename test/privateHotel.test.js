const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivateHotelService: Service } = require('../dist/service/hotel/privateHotelService.js');
const { getPrivateHotelPlan, resolvePrivateHotelPayment } = require('../dist/constant/hotel/privateHotel.js');
const { createPrivateHotelPanelPayload, PrivateHotelPanelService } = require('../dist/panel/hotel/privateHotelPanelService.js');
const { createHotelVcPanelActionRows } = require('../dist/panel/hotel/hotelPanelService.js');
const { HotelVcService } = require('../dist/service/hotel/hotelVcService.js');
const { HotelFreeTicketService } = require('../dist/service/hotel/hotelFreeTicketService.js');
const { ItemService } = require('../dist/service/inventory/itemService.js');
const { DbService } = require('../dist/service/system/dbService.js');
const { ActionService } = require('../dist/service/currency/actionService.js');
const { TEXT_CHANNEL_IDS, BOT_ID } = require('../dist/constant/shared/id.js');
const { resolvePanelInstallTarget } = require('../dist/panel/panelInstallService.js');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck.js');
const { AccountService } = require('../dist/service/account/accountService.js');

test.beforeEach(t => {
  t.mock.method(AccountService, 'getAccountByUserId', async () => [{ wallet: 100000 }]);
});

function session(kind = 'vip', hours = 24, payment = 'ticket') {
  return { id: 'session', userId: '123', guildId: 'guild', kind, hours, payment,
    guestId: kind === 'vip' ? '456' : undefined, step: 'confirm', expiresAt: Date.now() + 60000 };
}

function interaction(customId, userId = '123') {
  const replies = [], logs = [], deleted = [];
  return {
    customId, user: { id: userId }, guildId: 'guild', channelId: TEXT_CHANNEL_IDS.PRIVATE_HOTEL_PANEL,
    deferred: true, replies, logs, deleted,
    guild: {
      members: { fetch: async id => ({ id, user: { bot: false } }) },
      channels: {
        fetch: async id => { assert.equal(id, TEXT_CHANNEL_IDS.PRIVATE_HOTEL_LOG); return { isTextBased: () => true, send: async body => logs.push({ id, body }) }; },
        delete: async id => deleted.push(id),
      },
    },
    editReply: async body => replies.push(body),
  };
}

function fakeDb(t, { quantity = 2, wallet = 100000, failInsert = false, failConsumeAt = 0 } = {}) {
  let state = { quantity, wallet, vcs: [], actions: [] }, snapshot, consumed = 0;
  const calls = [];
  const c = {
    beginTransaction: async () => { snapshot = structuredClone(state); calls.push('begin'); },
    commit: async () => calls.push('commit'),
    rollback: async () => { state = structuredClone(snapshot); calls.push('rollback'); },
    release: () => calls.push('release'),
    execute: async (sql, args) => {
      if (sql.startsWith('SELECT wallet')) return [[{ wallet: args[0] === BOT_ID ? 0 : state.wallet }]];
      if (sql.includes('SELECT iu.quantity')) return [[{ quantity: state.quantity }]];
      if (sql.startsWith('UPDATE accounts')) { state.wallet = args[0]; return [{}]; }
      if (sql.includes('INSERT INTO vcs')) {
        if (failInsert) throw new Error('insert failed');
        state.vcs.push(args); return [{}];
      }
      if (sql.includes('INSERT INTO actions')) { state.actions.push(args); return [{}]; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  t.mock.method(DbService, 'getConnection', async () => c);
  t.mock.method(ItemService, 'consume', async (connection, userId, key) => {
    assert.equal(connection, c); assert.equal(userId, '123');
    calls.push({ key }); consumed++;
    if (consumed === failConsumeAt || state.quantity < 1) return false;
    state.quantity--; return true;
  });
  return { state: () => state, calls };
}

test('new panel has two hotel entries and original panel offers only normal hotel and inventory', () => {
  const buttons = createPrivateHotelPanelPayload().components[0].toJSON().components;
  assert.deepEqual(buttons.map(b => b.custom_id), ['privateHotel:vip', 'privateHotel:freedom']);
  assert.deepEqual(createHotelVcPanelActionRows()[0].toJSON().components.map(b => b.custom_id),
    ['NORMAL', 'view', 'hotelTicketView']);
  assert.equal(resolvePanelInstallTarget('1534649600760086658'), 'hotel');
  assert.equal(resolvePanelInstallTarget('1550777133087854602'), 'private_hotel');
  assert.equal(TEXT_CHANNEL_IDS.HOTEL_LOG, '1534649699263578414');
  assert.equal(TEXT_CHANNEL_IDS.PRIVATE_HOTEL_LOG, '1550777212867973150');
  assert.equal(HotelFreeTicketService.getTicketType('SECRETLONG'), undefined);
  assert.equal(HotelFreeTicketService.getTicketType('FREEDOMLONG'), undefined);
  assert.equal(shouldDeferButtonUpdate('privateHotel:vip'), false);
  assert.equal(shouldDeferButtonUpdate('privateHotel:duration:nonce:24'), true);
  assert.equal(shouldDeferButtonUpdate('SECRETLONG_hotel_create_LIA_456'), false);
});

for (const [kind, hours, type, key, price, count] of [
  ['vip', 12, 'SECRET', 'HOTEL_SECRET_FREE', 30000, 1],
  ['vip', 24, 'SECRETLONG', 'HOTEL_SECRET_FREE', 50000, 2],
  ['freedom', 12, 'FREEDOM', 'HOTEL_FREEDOM_FREE', 50000, 1],
  ['freedom', 24, 'FREEDOMLONG', 'HOTEL_FREEDOM_FREE', 90000, 2],
]) {
  test(`${kind} ${hours}h uses the correct ticket type, count and currency fallback`, async t => {
    const plan = getPrivateHotelPlan(kind, hours);
    assert.deepEqual([plan.type, plan.itemKey, plan.price, plan.ticketCount], [type, key, price, count]);
    assert.equal(resolvePrivateHotelPayment(count - 1, count), 'money');
    assert.equal(resolvePrivateHotelPayment(count, count), 'ticket');
    const db = fakeDb(t, { quantity: count });
    const started = Date.now();
    await Service.recordCreation(session(kind, hours), 'vc');
    assert.equal(db.state().quantity, 0);
    assert.equal(db.state().wallet, 100000);
    assert.equal(db.calls.filter(x => x.key === key).length, count);
    const row = db.state().vcs[0];
    assert.equal(row[3], type); assert.equal(row[4], true);
    assert.ok(row[5].getTime() >= started + hours * 3600000);
    assert.equal(db.state().actions[0][1], 0);
    assert.ok(db.calls.includes('commit'));
  });
}

test('24h with only one ticket charges the full LIA price and keeps that ticket', async t => {
  const db = fakeDb(t, { quantity: 1 });
  await Service.recordCreation(session('freedom', 24, 'money'), 'vc');
  assert.equal(db.state().quantity, 1);
  assert.equal(db.state().wallet, 10000);
  assert.equal(db.state().actions[0][1], 90000);
  assert.equal(db.state().vcs[0][4], false);
});

for (const failure of [{ failConsumeAt: 2 }, { failInsert: true }]) {
  test(`ticket consumption is rolled back on failure: ${JSON.stringify(failure)}`, async t => {
    const db = fakeDb(t, failure);
    await assert.rejects(Service.recordCreation(session(), 'vc'));
    assert.equal(db.state().quantity, 2);
    assert.equal(db.state().wallet, 100000);
    assert.equal(db.state().vcs.length, 0);
    assert.equal(db.state().actions.length, 0);
    assert.ok(db.calls.includes('rollback'));
    assert.ok(!db.calls.includes('commit'));
  });
}

test('insufficient LIA never consumes the one remaining ticket', async t => {
  const db = fakeDb(t, { quantity: 1, wallet: 100 });
  await assert.rejects(Service.recordCreation(session('vip', 24, 'money'), 'vc'), /残高/);
  assert.equal(db.state().quantity, 1);
  assert.equal(db.state().wallet, 100);
  assert.equal(db.state().vcs.length, 0);
});

test('inventory change during creation aborts instead of silently switching payment', async t => {
  const db = fakeDb(t, { quantity: 1 });
  await assert.rejects(Service.recordCreation(session(), 'vc'), /所持数が変わりました/);
  assert.equal(db.state().quantity, 1);
  assert.equal(db.state().wallet, 100000);
});

test('VIP flow asks duration, guest and confirms the automatic two-ticket payment', async t => {
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 2]]));
  const i = interaction('privateHotel:vip');
  await Service.handleButton(i);
  const durationId = i.replies.at(-1).components[0].toJSON().components[1].custom_id;
  i.customId = durationId;
  await Service.handleButton(i);
  const guestId = i.replies.at(-1).components[0].toJSON().components[0].custom_id;
  i.customId = guestId; i.values = ['123'];
  await assert.rejects(Service.handleUserSelect(i), /自分/);
  i.values = ['456'];
  await Service.handleUserSelect(i);
  assert.match(i.replies.at(-1).embeds[0].toJSON().description, /チケットを2枚消費/);
  assert.match(i.replies.at(-1).embeds[0].toJSON().description, /456/);
  assert.equal(i.replies.at(-1).components[0].toJSON().components[0].label, '作成する');
});

test('freedom skips guest selection and shows LIA when two tickets are unavailable', async t => {
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_FREEDOM_FREE', 1]]));
  const i = interaction('privateHotel:freedom');
  await Service.handleButton(i);
  i.customId = i.replies.at(-1).components[0].toJSON().components[1].custom_id;
  await Service.handleButton(i);
  assert.match(i.replies.at(-1).embeds[0].toJSON().description, /90,000LIA/);
  assert.doesNotMatch(i.replies.at(-1).embeds[0].toJSON().description, /相手/);
});

test('sessions reject wrong user, wrong channel, stale steps, expiry and reuse after cancel', async () => {
  const i = interaction('privateHotel:vip');
  await Service.handleButton(i);
  const id = i.replies.at(-1).components[0].toJSON().components[0].custom_id.split(':')[2];
  await assert.rejects(Service.handleButton(interaction(`privateHotel:duration:${id}:12`, 'other')), /期限切れ/);
  const wrong = interaction(`privateHotel:duration:${id}:12`); wrong.channelId = TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL;
  await assert.rejects(Service.handleButton(wrong), /新ホテル/);
  await assert.rejects(Service.handleButton(interaction(`privateHotel:confirm:${id}`)), /古く/);
  await Service.handleButton(interaction(`privateHotel:cancel:${id}`));
  await assert.rejects(Service.handleButton(interaction(`privateHotel:duration:${id}:12`)), /期限切れ/);
  const expired = session(); expired.expiresAt = Date.now() - 1; Service.sessions.set(expired.id, expired);
  await assert.rejects(Service.handleButton(interaction('privateHotel:confirm:session')), /期限切れ/);
});

for (const payment of ['ticket', 'money']) {
  test(`new ${payment} purchases log only to the new channel and cannot be replayed`, async t => {
    Service.sessions.clear(); const s = session('vip', 24, payment); Service.sessions.set(s.id, s);
    t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', payment === 'ticket' ? 2 : 0]]));
    const record = t.mock.method(Service, 'recordCreation', async () => {});
    const create = t.mock.method(HotelVcService, 'createHotelVc', async (...args) => { assert.equal(args[4], false); return 'vc'; });
    const legacy = t.mock.method(ActionService, 'executeActionLog', async () => { throw new Error('legacy log must not run'); });
    const i = interaction('privateHotel:confirm:session');
    await Service.handleButton(i);
    assert.equal(i.logs.length, 1);
    assert.equal(i.logs[0].id, '1550777212867973150');
    assert.match(i.logs[0].body.content, payment === 'ticket' ? /チケットを2枚消費/ : /50,000LIA/);
    assert.equal(legacy.mock.callCount(), 0);
    await assert.rejects(Service.handleButton(i), /期限切れ/);
    assert.equal(create.mock.callCount(), 1); assert.equal(record.mock.callCount(), 1);
  });
}

test('changed ticket availability requests a new confirmation without creating a VC', async t => {
  Service.sessions.clear(); const s = session(); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 1]]));
  const create = t.mock.method(HotelVcService, 'createHotelVc', async () => 'vc');
  const i = interaction('privateHotel:confirm:session');
  await Service.handleButton(i);
  assert.equal(create.mock.callCount(), 0);
  assert.match(i.replies.at(-1).content, /もう一度確認/);
  assert.match(i.replies.at(-1).embeds[0].toJSON().description, /50,000LIA/);
});

test('duplicate confirmation during processing creates and charges only once', async t => {
  Service.sessions.clear(); const s = session(); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 2]]));
  let complete; const waiting = new Promise(resolve => complete = resolve);
  const create = t.mock.method(HotelVcService, 'createHotelVc', async () => { await waiting; return 'vc'; });
  const record = t.mock.method(Service, 'recordCreation', async () => {});
  const first = Service.handleButton(interaction('privateHotel:confirm:session'));
  await assert.rejects(Service.handleButton(interaction('privateHotel:confirm:session')), /処理中/);
  complete(); await first;
  assert.equal(create.mock.callCount(), 1); assert.equal(record.mock.callCount(), 1);
});

test('failed payment deletes the provisional VC and never sends a creation log', async t => {
  Service.sessions.clear(); const s = session(); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 2]]));
  t.mock.method(HotelVcService, 'createHotelVc', async () => 'vc');
  t.mock.method(Service, 'recordCreation', async () => { throw new Error('payment failed'); });
  const i = interaction('privateHotel:confirm:session');
  await assert.rejects(Service.handleButton(i), /payment failed/);
  assert.deepEqual(i.deleted, ['vc']); assert.equal(i.logs.length, 0);
});

test('legacy purchases keep their existing log channel', async () => {
  const fetched = [], sent = [];
  await ActionService.createActionLogMessage({ client: { channels: { fetch: async id => {
    fetched.push(id); return { isTextBased: () => true, send: async text => sent.push(text) };
  } } } }, 'SECRETLONG', 50000, '123', BOT_ID, '');
  assert.deepEqual(fetched, ['1534649699263578414']);
  assert.equal(sent.length, 1);
});

test('LIA balance is checked before creating or notifying a guest', async t => {
  Service.sessions.clear(); const s = session('vip', 24, 'money'); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map());
  t.mock.method(AccountService, 'getAccountByUserId', async () => [{ wallet: 0 }]);
  const create = t.mock.method(HotelVcService, 'createHotelVc', async () => 'vc');
  await assert.rejects(Service.handleButton(interaction('privateHotel:confirm:session')), /残高/);
  assert.equal(create.mock.callCount(), 0);
});

test('VC creation failure performs no ticket or LIA transaction', async t => {
  Service.sessions.clear(); const s = session(); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 2]]));
  t.mock.method(HotelVcService, 'createHotelVc', async () => { throw new Error('Discord unavailable'); });
  const record = t.mock.method(Service, 'recordCreation', async () => {});
  const i = interaction('privateHotel:confirm:session');
  await assert.rejects(Service.handleButton(i), /Discord unavailable/);
  assert.equal(record.mock.callCount(), 0); assert.equal(i.logs.length, 0);
});

test('a log send failure does not cause a committed purchase to be offered again', async t => {
  Service.sessions.clear(); const s = session(); Service.sessions.set(s.id, s);
  t.mock.method(ItemService, 'getQuantities', async () => new Map([['HOTEL_SECRET_FREE', 2]]));
  t.mock.method(HotelVcService, 'createHotelVc', async () => 'vc');
  t.mock.method(Service, 'recordCreation', async () => {});
  const errors = t.mock.method(console, 'error', () => {});
  const i = interaction('privateHotel:confirm:session');
  i.guild.channels.fetch = async () => ({ isTextBased: () => true, send: async () => { throw new Error('log unavailable'); } });
  await Service.handleButton(i);
  assert.match(i.replies.at(-1).content, /作成しました/);
  assert.equal(errors.mock.callCount(), 1);
  assert.deepEqual(i.deleted, []);
  await assert.rejects(Service.handleButton(i), /期限切れ/);
});
