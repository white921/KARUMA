const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { GatewayRateLimitError } = require('@discordjs/util');
const { GuildMemberCacheService: cache } = require('../dist/service/system/guildMemberCacheService');
const { SuperchatService } = require('../dist/service/market/superchatService');
const { CastPaymentService } = require('../dist/service/cast/castPaymentService');
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const discordRoot = path.dirname(require.resolve('discord.js'));
const memberAdd = require(path.join(discordRoot, 'client/websocket/handlers/GUILD_MEMBER_ADD'));
const shard = { status: 0 };
const guildId = '100000000000000001';
const userId = '1086598017345388685';
const secondId = '100000000000000003';
const packet = (id = userId, roles = []) => ({
  guild_id: guildId, user: { id, username: `user-${id}`, discriminator: '0', bot: false },
  roles, joined_at: '2026-01-01T00:00:00.000Z', nick: null,
});
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, data = [packet()]) {
  t.mock.method(console, 'log', () => {});
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.user = client.users._add({ id: '100000000000000099', username: 'bot', discriminator: '0', bot: true });
  const guild = client.guilds._add({ id: guildId, name: 'test', unavailable: false, channels: [], member_count: data.length,
    roles: [guildId, ROLE_IDS.CAST_MAID, ROLE_IDS.STREAMER_MANAGER].map(id => ({ id, name: id, permissions: '0' })) });
  guild.shardId = 0;
  let snapshot = data;
  const fetch = t.mock.method(guild.members, 'fetch', async options => {
    assert.equal(options, undefined, 'this fixture only expects full fetches');
    return new Collection(snapshot.map(item => [item.user.id, guild.members._add(item)]));
  });
  cache.install(client);
  return { client, guild, fetch, setSnapshot: data => { snapshot = data; },
    update: data => client.actions.GuildMemberUpdate.handle(data, shard),
    add: data => {
      client.emit('raw', { t: 'GUILD_MEMBER_ADD', d: data }, 0);
      memberAdd(client, { d: data }, shard);
    },
    remove: id => {
      const data = { guild_id: guildId, user: { id } };
      client.emit('raw', { t: 'GUILD_MEMBER_REMOVE', d: data }, 0);
      client.actions.GuildMemberRemove.handle(data, shard);
    },
  };
}

test('startup and concurrent consumers share one complete fetch; snapshots cannot clear the shared cache', async t => {
  const f = fixture(t);
  let release;
  f.fetch.mock.mockImplementation(() => new Promise(resolve => { release = () => {
    const member = f.guild.members._add(packet());
    resolve(new Collection([[member.id, member]]));
  }; }));
  f.client.emit('shardReady', 0);
  f.client.emit('clientReady', f.client);
  const reads = [cache.getMembers(f.guild), cache.getMembers(f.guild)];
  assert.equal(f.fetch.mock.callCount(), 1);
  release();
  const [a, b] = await Promise.all(reads);
  assert.equal(a.size, 1); assert.equal(b.size, 1);
  a.clear();
  assert.equal((await cache.getMembers(f.guild)).size, 1);
  assert.equal(f.fetch.mock.callCount(), 1);
});

test('actual discord.js role, nickname, join and leave handlers update candidates without fetching again', async t => {
  const f = fixture(t);
  await cache.getMembers(f.guild);
  f.update({ ...packet(userId, [ROLE_IDS.CAST_MAID]), nick: '新しい名前' });
  f.add(packet(secondId));
  let members = await cache.getMembers(f.guild);
  assert.equal(members.get(userId).displayName, '新しい名前');
  assert.equal(members.get(userId).roles.cache.has(ROLE_IDS.CAST_MAID), true);
  assert.equal(members.has(secondId), true);
  f.remove(userId);
  members = await cache.getMembers(f.guild);
  assert.deepEqual([...members.keys()], [secondId]);
  assert.equal(f.fetch.mock.callCount(), 1);
});

test('superchat and cast selects share the cache and use changed roles/names on the next opening', async t => {
  const f = fixture(t, [packet(userId, [ROLE_IDS.STREAMER_MANAGER, ROLE_IDS.CAST_MAID])]);
  const payloads = [];
  const interaction = { guild: f.guild, guildId, user: { id: secondId }, deferred: true,
    editReply: async payload => payloads.push(payload), isButton: () => true,
    customId: 'castPayment:start:maid', channelId: TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL };
  await SuperchatService.showStreamerSelect(interaction);
  await CastPaymentService.handle(interaction);
  assert.equal(f.fetch.mock.callCount(), 1);
  f.update({ ...packet(userId, [ROLE_IDS.STREAMER_MANAGER, ROLE_IDS.CAST_MAID]), nick: '変更後' });
  await SuperchatService.showStreamerSelect(interaction);
  assert.equal(payloads.at(-1).components[0].toJSON().components[0].options[0].label, '変更後');
  f.update(packet(userId));
  await assert.rejects(CastPaymentService.handle(interaction), /選択できるキャストがいません/);
  await assert.rejects(SuperchatService.showStreamerSelect(interaction));
  assert.equal(f.fetch.mock.callCount(), 1);
});

test('normal resume keeps the cache and accepts replayed updates, with no periodic refresh', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  await cache.getMembers(f.guild);
  f.client.emit('shardReconnecting', 0);
  await assert.rejects(cache.getMembers(f.guild), /再接続中/);
  f.update({ ...packet(), nick: '復元後' });
  f.client.emit('shardResume', 0, 1);
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal((await cache.getMembers(f.guild)).get(userId).displayName, '復元後');
  assert.equal(f.fetch.mock.callCount(), 1);
});

test('new READY invalidates the old session and respects the per-guild cooldown', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  await cache.getMembers(f.guild);
  f.setSnapshot([packet(secondId)]);
  f.client.emit('raw', { t: 'READY' }, 0);
  await assert.rejects(cache.getMembers(f.guild), /再接続中/);
  f.client.emit('shardReady', 0);
  const reading = cache.getMembers(f.guild);
  t.mock.timers.tick(30_999); await flush();
  assert.equal(f.fetch.mock.callCount(), 1);
  t.mock.timers.tick(1);
  assert.deepEqual([...(await reading).keys()], [secondId]);
  assert.equal(f.fetch.mock.callCount(), 2);
});

test('unavailable guild reloads once when available again; install is idempotent', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  cache.install(f.client);
  assert.equal(f.client.listenerCount('guildAvailable'), 1);
  await cache.getMembers(f.guild);
  f.guild.available = false;
  f.client.emit('guildUnavailable', f.guild);
  await assert.rejects(cache.getMembers(f.guild), /再接続中/);
  f.guild.available = true;
  f.setSnapshot([packet(secondId)]);
  f.client.emit('guildAvailable', f.guild);
  const reading = cache.getMembers(f.guild);
  t.mock.timers.tick(31_000);
  assert.deepEqual([...(await reading).keys()], [secondId]);
  assert.equal(f.fetch.mock.callCount(), 2);
});

test('a newly joined guild is initialized without waiting for a user operation', async t => {
  const f = fixture(t);
  f.client.emit('guildCreate', f.guild);
  await flush();
  assert.equal(f.fetch.mock.callCount(), 1);
  assert.equal((await cache.getMembers(f.guild)).size, 1);
});

test('join/leave during a full fetch are preserved while stale cached members are pruned', async t => {
  const f = fixture(t);
  f.guild.members._add(packet('100000000000000004'));
  let release;
  f.fetch.mock.mockImplementation(() => new Promise(resolve => { release = () => {
    // A late chunk must not resurrect someone whose departure was already received.
    const member = f.guild.members._add(packet());
    resolve(new Collection([[userId, member]]));
  }; }));
  const reading = cache.getMembers(f.guild);
  f.remove(userId); f.add(packet(secondId));
  release();
  assert.deepEqual([...(await reading).keys()], [secondId]);
});

test('failed fetch is not cached and later attempts still respect cooldown', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  f.fetch.mock.mockImplementationOnce(async () => { throw new Error('network failed'); });
  await assert.rejects(cache.getMembers(f.guild), /network failed/);
  const reading = cache.getMembers(f.guild);
  assert.equal(f.fetch.mock.callCount(), 1);
  t.mock.timers.tick(31_000);
  assert.equal((await reading).size, 1);
  assert.equal(f.fetch.mock.callCount(), 2);
});

test('opcode 8 retry_after is seconds; concurrent callers share the delayed retry', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  t.mock.method(console, 'warn', () => {});
  f.fetch.mock.mockImplementationOnce(async () => {
    throw new GatewayRateLimitError({ opcode: 8, retry_after: 40.5, meta: {} }, {});
  });
  const a = cache.getMembers(f.guild), b = cache.getMembers(f.guild);
  await flush();
  t.mock.timers.tick(41_499); await flush();
  assert.equal(f.fetch.mock.callCount(), 1);
  t.mock.timers.tick(1);
  assert.equal((await a).size, 1); assert.equal((await b).size, 1);
  assert.equal(f.fetch.mock.callCount(), 2);
});

test('disconnect during initialization cannot mark the old request complete after a new session', async t => {
  const f = fixture(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  let release;
  f.fetch.mock.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(new Collection()); }));
  const original = cache.getMembers(f.guild);
  f.client.emit('shardReconnecting', 0);
  f.setSnapshot([packet(secondId)]);
  f.client.emit('raw', { t: 'READY' }, 0);
  f.client.emit('shardReady', 0);
  release(); await flush();
  assert.equal(f.fetch.mock.callCount(), 1);
  t.mock.timers.tick(31_000);
  assert.deepEqual([...(await original).keys()], [secondId]);
  assert.equal(f.fetch.mock.callCount(), 2);
});
