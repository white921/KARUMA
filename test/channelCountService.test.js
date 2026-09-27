const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {Collection, ChannelType} = require('discord.js');
const {ChannelCountService, CHANNEL_COUNT_UPDATE_INTERVAL_MS} = require('../dist/service/system/channelCountService');
const {TEXT_CHANNEL_IDS} = require('../dist/constant/shared/id');

function setup(t) {
  const edits = [];
  let fetches = 0;
  const target = {type: ChannelType.GuildText, name: 'チャンネル数', isThread: () => false, setName: async name => {edits.push(name); target.name = name;}};
  const channels = new Collection([
    [TEXT_CHANNEL_IDS.CHANNEL_COUNT, target],
    ['category', {isThread: () => false}], ['voice', {isThread: () => false}],
    ['forum', {isThread: () => false}], ['thread', {isThread: () => true}], ['missing', null],
  ]);
  const guild = {available: true, channels: {fetch: async () => {fetches++; return channels;}}};
  const client = Object.assign(new EventEmitter(), {isReady: () => true, guilds: {fetch: async () => guild}});
  const service = new ChannelCountService(client, 'guild');
  t.after(() => service.stop());
  return {service, edits, target, channels, client, fetches: () => fetches};
}

test('counter includes itself, categories, voice and forum but excludes threads and nulls', async t => {
  const s = setup(t);
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数-4／500']);
});

test('unchanged name is not written and rapid changes are coalesced', async t => {
  const s = setup(t);
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  s.target.name = 'チャンネル数-4／500';
  await s.service.refresh();
  assert.equal(s.edits.length, 0);
  s.channels.set('new', {isThread: () => false});
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数-5／500']);
  s.channels.delete('new');
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数-5／500']);
  now += CHANNEL_COUNT_UPDATE_INTERVAL_MS;
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数-5／500', 'チャンネル数-4／500']);
});

test('startup registers create/delete events once and stopping removes them', async t => {
  const s = setup(t);
  s.service.start();
  s.service.start();
  await new Promise(setImmediate);
  assert.equal(s.client.listenerCount('channelCreate'), 1);
  assert.equal(s.client.listenerCount('channelDelete'), 1);
  assert.equal(s.fetches(), 1);
  s.service.stop();
  assert.equal(s.client.listenerCount('channelCreate'), 0);
  assert.equal(s.client.listenerCount('channelDelete'), 0);
});
