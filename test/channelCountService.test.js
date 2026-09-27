const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {Collection, ChannelType} = require('discord.js');
const {ChannelCountService} = require('../dist/service/system/channelCountService');
const {VC_IDS} = require('../dist/constant/shared/id');

function setup(t) {
  const edits = [];
  let fetches = 0;
  const target = {type: ChannelType.GuildVoice, name: 'チャンネル数', isThread: () => false, setName: async name => {edits.push(name); target.name = name;}};
  const channels = new Collection([
    [VC_IDS.CHANNEL_COUNT, target],
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
  assert.deepEqual(s.edits, ['チャンネル数 4/500']);
});

test('unchanged names are skipped and successive count changes have no fixed cooldown', async t => {
  const s = setup(t);
  s.target.name = 'チャンネル数 4/500';
  await s.service.refresh();
  assert.equal(s.edits.length, 0);
  s.channels.set('new', {isThread: () => false});
  await s.service.refresh();
  s.channels.delete('new');
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数 5/500', 'チャンネル数 4/500']);
});

test('a count change while Discord is processing a rename gets reconciled afterwards', async t => {
  const s = setup(t);
  let release;
  s.target.setName = async name => {
    s.edits.push(name);
    if (s.edits.length === 1) await new Promise(resolve => {release = resolve;});
    s.target.name = name;
  };
  const first = s.service.refresh();
  await new Promise(setImmediate);
  s.channels.set('new', {isThread: () => false});
  await s.service.refresh();
  assert.deepEqual(s.edits, ['チャンネル数 4/500']);
  release();
  await first;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(s.edits, ['チャンネル数 4/500', 'チャンネル数 5/500']);
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
