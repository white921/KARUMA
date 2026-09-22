const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, Collection } = require('discord.js');
const { CastPaymentService } = require('../dist/service/cast/castPaymentService');
const { BotHealthMonitor, createInitialBotHealthState, shouldRestartFromHealthState } = require('../dist/service/system/botHealthMonitor');
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const thresholds = { ackTimeoutMs: 30000, handlerTimeoutMs: 45000, gatewayDisconnectTimeoutMs: 300000, maxConsecutiveAckFailures: 3 };
function entry(t) {
  let handler;
  t.mock.method(Client.prototype, 'on', function (event, callback) { if (event === 'interactionCreate') handler = callback; return this; });
  t.mock.method(Client.prototype, 'login', async () => 'test');
  t.mock.method(console, 'log', () => {});
  BotHealthMonitor.state = createInitialBotHealthState();
  delete require.cache[require.resolve('../dist/index')];
  require('../dist/index');
  assert.ok(handler);
  return handler;
}
function interaction(customId) {
  const calls = [];
  return { customId, calls, id: 'interaction-id', user: { id: 'payer' }, guildId: 'guild', channelId: TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL,
    isChatInputCommand: () => false, isButton: () => true, isUserSelectMenu: () => false, isStringSelectMenu: () => false, isModalSubmit: () => false,
    deferred: false, replied: false,
    async deferReply() { assert.equal(this.deferred, false, 'must not acknowledge twice'); this.deferred = true; calls.push('deferReply'); },
    async deferUpdate() { assert.equal(this.deferred, false, 'must not acknowledge twice'); this.deferred = true; calls.push('deferUpdate'); },
    async showModal() { assert.equal(this.deferred, false, 'modal needs the initial response'); this.replied = true; calls.push('showModal'); },
    async editReply() { calls.push('editReply'); }, async reply() { this.replied = true; calls.push('reply'); },
  };
}
function session(stage) {
  return { id: 'ack-test', userId: 'payer', guildId: 'guild', channelId: TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL,
    menu: 'group', candidates: [{ id: 'cast', name: 'cast' }], castIds: ['cast'], page: 0, hours: 1, amount: 0, option: '',
    stage, revision: 0, expiresAt: Date.now() + 60000, busy: false };
}
function assertFinished() {
  assert.equal(BotHealthMonitor.state.pendingInteractionCount, 0);
  assert.equal(BotHealthMonitor.state.inFlightInteractionCount, 0);
  assert.deepEqual(shouldRestartFromHealthState(BotHealthMonitor.state, Date.now() + 60000, thresholds), { shouldRestart: false });
}
test('cast buttons use initial ephemeral reply, subsequent update, and immediate modal response', () => {
  assert.equal(shouldDeferButtonUpdate('castPayment:start:group'), false);
  assert.equal(shouldDeferButtonUpdate('castPayment:option:id:0'), false);
  for (const action of ['chosen', 'review', 'pay', 'plus', 'cancel']) assert.equal(shouldDeferButtonUpdate(`castPayment:${action}:id:0`), true);
});
test('real event entry records ack before fetching cast members; no false restart after completion', async t => {
  const handle = entry(t), i = interaction('castPayment:start:group');
  let release;
  i.guild = { available: true, members: { cache: new Collection(), fetch: () => new Promise(resolve => {
    release = members => { i.guild.members.cache = members; resolve(members); };
  }) } };
  const running = handle(i);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(i.calls, ['deferReply']);
  assert.equal(BotHealthMonitor.state.pendingInteractionCount, 0);
  assert.equal(BotHealthMonitor.state.inFlightInteractionCount, 1);
  release(new Collection([['cast', { id: 'cast', displayName: 'cast', user: { bot: false }, roles: { cache: new Collection([[ROLE_IDS.CAST_MAID, {}]]) } }]]));
  await running; assertFinished();
});
for (const [action, stage] of [['chosen', 'cast'], ['review', 'time'], ['cancel', 'confirm']]) {
  test(`${action} acknowledges once and leaves no pending watchdog entry`, async t => {
    const handle = entry(t), s = session(stage); CastPaymentService.sessions.set(s.id, s);
    const i = interaction(`castPayment:${action}:${s.id}:0`); await handle(i);
    assert.equal(i.calls.filter(x => x.startsWith('defer')).length, 1); assert.equal(i.calls[0], 'deferUpdate'); assertFinished();
  });
}
test('payment is acknowledged and shows processing before slow settlement; no double ack or false timeout', async t => {
  const handle = entry(t), s = session('confirm'); CastPaymentService.sessions.set(s.id, s);
  let release;
  t.mock.method(CastPaymentService, 'pay', async () => new Promise(resolve => { release = resolve; }));
  const i = interaction(`castPayment:pay:${s.id}:0`); const running = handle(i);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(i.calls, ['deferUpdate', 'editReply']);
  assert.equal(BotHealthMonitor.state.pendingInteractionCount, 0);
  assert.equal(BotHealthMonitor.state.inFlightInteractionCount, 1);
  assert.equal(shouldRestartFromHealthState(BotHealthMonitor.state, Date.now() + 31000, thresholds).shouldRestart, false);
  release(); await running; assertFinished();
});
test('option modal is not deferred and is recorded as acknowledged', async t => {
  const handle = entry(t), s = session('option'); s.menu = 'maid'; CastPaymentService.sessions.set(s.id, s);
  const i = interaction(`castPayment:option:${s.id}:0`); await handle(i);
  assert.deepEqual(i.calls, ['showModal']); assertFinished();
});
test('failed initial acknowledgement never begins payment', async t => {
  const handle = entry(t), s = session('confirm'); CastPaymentService.sessions.set(s.id, s);
  let paid = false; t.mock.method(CastPaymentService, 'pay', async () => { paid = true; });
  t.mock.method(console, 'error', () => {});
  const i = interaction(`castPayment:pay:${s.id}:0`); i.deferUpdate = async () => { throw new Error('ack failed'); };
  await handle(i); assert.equal(paid, false); assert.equal(BotHealthMonitor.state.pendingInteractionCount, 0);
});
