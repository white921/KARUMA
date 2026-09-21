const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, Collection, PermissionFlagsBits: P, PermissionsBitField, OverwriteType } = require('discord.js');
const { DarkMessageService, canIssueDarkMessage, assertDarkMessageBuyer, createDarkMessageOverwrites,
  createDarkMessageModal, anonymousAudioName, createDarkMessagePayload } = require('../dist/service/market/darkMessageService');
const { DarkMessageStore } = require('../dist/service/market/darkMessageStore');
const { DbService } = require('../dist/service/system/dbService');
const { DARK_MESSAGE_OPERATOR_ROLES, DARK_MESSAGE_MAX_AUDIO_BYTES } = require('../dist/constant/market/darkMessage');
const { ROLE_IDS, CATEGORY_IDS } = require('../dist/constant/shared/id');
const { letterData, whisperData } = require('../dist/command/market/darkMessagePanel');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { handleUserSelectMenu } = require('../dist/handler/interaction/userSelectHandler');
const { handleModalSubmit } = require('../dist/handler/interaction/modalHandler');
const { AccountService } = require('../dist/service/account/accountService');

const id = '123456789012345678';
const recipientId = '223456789012345678';
const request = () => ({ request_id: id, buyer_id: 'buyer', operator_id: 'operator', guild_id: 'guild',
  source_channel_id: 'ticket', product: 'letter', status: 'issued' });
const identity = () => ({ user: { id: 'buyer' }, guildId: 'guild', channelId: 'ticket' });

test('パネル発行は指定4ロールのみ。管理者権限だけでは発行できない', () => {
  for (const role of DARK_MESSAGE_OPERATOR_ROLES) assert.equal(canIssueDarkMessage({ roles: [role] }), true);
  for (const role of [ROLE_IDS.SHOP_LEADER, ROLE_IDS.SHOP_STAFF, ROLE_IDS.GINKOU_LEADER, 'other'])
    assert.equal(canIssueDarkMessage({ roles: [role] }), false);
  assert.equal(canIssueDarkMessage({ permissions: { administrator: true } }), false);
});

test('指定のコマンド名・必須購入者。DM不可', () => {
  assert.deepEqual([letterData, whisperData].map(d => d.toJSON().name), ['闇手紙パネル', '悪魔ささやきパネル']);
  for (const data of [letterData, whisperData]) {
    assert.equal(data.toJSON().dm_permission, false);
    assert.equal(data.toJSON().options[0].name, '購入者');
    assert.equal(data.toJSON().options[0].required, true);
  }
});

test('購入者・サーバー・チケットを毎回照合し、使用済みパネルを拒否', () => {
  assertDarkMessageBuyer(request(), identity());
  for (const change of [{ buyer_id: 'other' }, { guild_id: 'other' }, { source_channel_id: 'other' },
    { status: 'sending' }, { status: 'delivered' }, { status: 'failed' }])
    assert.throws(() => assertDarkMessageBuyer({ ...request(), ...change }, identity()));
  assert.throws(() => assertDarkMessageBuyer(undefined, identity()));
});

test('作成時はeveryoneを拒否し、4ロールとBotだけを明示許可。購入者の許可なし', () => {
  const overwrites = createDarkMessageOverwrites('guild', 'bot');
  assert.equal(overwrites.length, 6);
  const everyone = overwrites.find(o => o.id === 'guild');
  assert.equal(new PermissionsBitField(everyone.deny).has(P.ViewChannel), true);
  assert.deepEqual(overwrites.filter(o => new PermissionsBitField(o.allow || []).has(P.ViewChannel)).map(o => o.id),
    [...DARK_MESSAGE_OPERATOR_ROLES, 'bot']);
  assert.equal(overwrites.find(o => o.id === 'bot').type, OverwriteType.Member);
});

test('音声モーダルはLabel内に必須のFile Uploadを1個配置', () => {
  const audio = createDarkMessageModal('whisper', id, recipientId, 'target').toJSON();
  assert.equal(audio.components[0].type, 18);
  assert.deepEqual(audio.components[0].component, { type: 19, custom_id: 'audio', min_values: 1, max_values: 1, required: true });
  const letter = createDarkMessageModal('letter', id, recipientId, 'target').toJSON();
  assert.equal(letter.components[0].component.max_length, 4000);
});

const audio = () => ({ name: 'sender-name.mp3', size: 4, contentType: 'audio/mpeg',
  url: 'https://cdn.discordapp.com/ephemeral-attachments/123/456/sender-name.mp3?ex=1' });

test('元ファイル名を隠し、不正URL・形式・サイズを拒否', () => {
  assert.equal(anonymousAudioName(audio()), 'voice-message.mp3');
  for (const change of [{ name: 'image.png' }, { contentType: 'image/png' }, { size: 0 },
    { size: DARK_MESSAGE_MAX_AUDIO_BYTES + 1 }, { url: 'http://cdn.discordapp.com/attachments/a' },
    { url: 'https://evil.test/attachments/a' }, { url: 'https://cdn.discordapp.com/not-attachments/a' }])
    assert.throws(() => anonymousAudioName({ ...audio(), ...change }));
});

test('配送内容は商品名と本文/音声のみ。作者・元URL・送信元は付けない', () => {
  const payload = createDarkMessagePayload('letter', '@everyone hello');
  assert.deepEqual(payload.embeds[0].toJSON(), { title: '闇手紙', color: 0x392247, description: '@everyone hello' });
  assert.deepEqual(payload.allowedMentions.parse, []);
  assert.equal(payload.content, undefined);
  assert.deepEqual(createDarkMessagePayload('whisper', undefined, { attachment: Buffer.from('test'), name: 'voice-message.mp3' }).embeds[0].toJSON(),
    { title: '悪魔の囁き', color: 0x392247 });
});

function setup(t, kind = 'letter') {
  const r = { ...request(), product: kind };
  const events = [];
  t.mock.method(DarkMessageStore, 'get', async () => r);
  t.mock.method(DarkMessageStore, 'claim', async (...args) => {
    events.push(['claim', ...args]);
    if (r.status !== 'issued') return false;
    r.status = 'sending'; return true;
  });
  for (const method of ['recordChannel', 'recordMessage', 'complete', 'fail'])
    t.mock.method(DarkMessageStore, method, async (...args) => { events.push([method, ...args]); });
  const channel = { id: 'delivery', send: async payload => { events.push(['send', payload]); return { id: 'message' }; },
    permissionOverwrites: { edit: async (...args) => { events.push(['grant', ...args]); } } };
  const i = { ...identity(), client: { user: { id: 'bot' } }, customId: `darkMessage:submit:${id}:${recipientId}`,
    deferReply: async () => {}, editReply: async payload => { events.push(['reply', payload]); },
    fields: { getTextInputValue: () => 'secret body', getUploadedFiles: () => new Collection([['audio', audio()]]) },
    guild: { id: 'guild', members: { fetch: async () => ({ user: { bot: false } }) }, channels: {
      fetch: async () => ({ id: CATEGORY_IDS.DARK_MARKET, type: ChannelType.GuildCategory }),
      create: async opts => { events.push(['create', opts]); return channel; },
    } } };
  return { i, r, events, channel };
}

test('記録→投稿→メッセージ記録の後に受取人へ公開。二重送信を拒否', async t => {
  const { i, events } = setup(t);
  await handleModalSubmit(i);
  assert.deepEqual(events.map(e => e[0]), ['claim', 'create', 'recordChannel', 'send', 'recordMessage', 'grant', 'complete', 'reply']);
  assert.deepEqual(events[0].slice(1), [id, 'buyer', 'guild', 'ticket', recipientId]);
  assert.equal(events[1][1].parent, CATEGORY_IDS.DARK_MARKET);
  assert.equal(events[1][1].permissionOverwrites.some(o => o.id === recipientId || o.id === 'buyer'), false);
  assert.equal(events.find(e => e[0] === 'grant')[1], recipientId);
  assert.match(events.at(-1)[1].content, /送信しました/);
  await assert.rejects(DarkMessageService.submit(i), /送信済み/);
  assert.equal(events.filter(e => e[0] === 'create').length, 1);
});

test('同時送信はDBのclaimに勝った1件だけを配送', async t => {
  const { i, events } = setup(t);
  const results = await Promise.allSettled([DarkMessageService.submit(i), DarkMessageService.submit(i)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(events.filter(e => e[0] === 'send').length, 1);
});

for (const failing of ['recordChannel', 'send', 'recordMessage', 'grant', 'complete']) {
  test(`配送の${failing}失敗時は再送可能に戻さず記録し、内部エラーや送信元を表示しない`, async t => {
    const { i, events, channel } = setup(t);
    const target = failing === 'send' ? channel : failing === 'grant' ? channel.permissionOverwrites : DarkMessageStore;
    t.mock.method(target, failing === 'grant' ? 'edit' : failing, async () => { throw new Error('private sender and payload'); });
    t.mock.method(console, 'error', () => {});
    await assert.rejects(DarkMessageService.submit(i), /^Error: 送信の完了を確認できませんでした/);
    assert.equal(events.filter(e => e[0] === 'fail').length, 1);
    if (['recordChannel', 'send', 'recordMessage'].includes(failing))
      assert.equal(events.some(e => e[0] === 'grant'), false);
  });
}

test('音声を再アップロードし、元URLと元ファイル名を受取側へ渡さない', async t => {
  const { i, events } = setup(t, 'whisper');
  t.mock.method(globalThis, 'fetch', async () => new Response(Buffer.from('test')));
  await DarkMessageService.submit(i);
  const payload = events.find(e => e[0] === 'send')[1];
  assert.equal(payload.files[0].name, 'voice-message.mp3');
  assert.deepEqual(payload.files[0].attachment, Buffer.from('test'));
  assert.equal(JSON.stringify(payload).includes('sender-name'), false);
});

test('不正音声・退出済み受取人はパネルを消費しない', async t => {
  const { i, events } = setup(t, 'whisper');
  i.fields.getUploadedFiles = () => new Collection([['audio', { ...audio(), size: DARK_MESSAGE_MAX_AUDIO_BYTES + 1 }]]);
  await assert.rejects(DarkMessageService.submit(i), /10MiB/);
  assert.equal(events.length, 0);
  i.guild.members.fetch = async () => { throw new Error('unknown member'); };
  await assert.rejects(DarkMessageService.submit(i), /サーバーにいません/);
  assert.equal(events.length, 0);
});

test('ボタン・宛先選択は本人を検証して応答。銀行口座は不要', async t => {
  t.mock.method(DarkMessageStore, 'get', async () => request());
  t.mock.method(AccountService, 'hasAccount', async () => { throw new Error('unrelated bank check'); });
  const payloads = [];
  const i = { ...identity(), customId: `darkMessage:start:${id}`, editReply: async p => payloads.push(p) };
  await handlePanelButton(i);
  i.customId = `darkMessage:target:${id}`;
  i.values = [recipientId];
  i.users = new Collection([[recipientId, { username: 'target', bot: false }]]);
  i.showModal = async p => payloads.push(p);
  await handleUserSelectMenu(i);
  assert.equal(payloads[1].toJSON().custom_id, `darkMessage:submit:${id}:${recipientId}`);
  i.user.id = 'other';
  await assert.rejects(handleUserSelectMenu(i), /本人だけ/);
});

test('発行時は最新のロールを取得し、権限喪失を拒否', async t => {
  const create = t.mock.method(DarkMessageStore, 'create', async () => {});
  let fetched;
  await assert.rejects(DarkMessageService.issue({ user: { id: 'operator' }, member: { roles: [ROLE_IDS.DARK_SHOP_LEADER] },
    channel: { isSendable: () => true }, guild: { members: { fetch: async args => { fetched = args; return { roles: [] }; } } } }, 'letter'), /のみ実行/);
  assert.deepEqual(fetched, { user: 'operator', force: true });
  assert.equal(create.mock.callCount(), 0);
});

test('claim SQLは購入者・サーバー・チケット・未使用状態を条件に含む', async t => {
  let released = 0;
  const queries = [];
  t.mock.method(DbService, 'getConnection', async () => ({ execute: async (sql, args) => {
    queries.push([sql, args]); return [{ affectedRows: queries.length === 1 ? 1 : 0 }];
  }, release: () => released++ }));
  assert.equal(await DarkMessageStore.claim(id, 'buyer', 'guild', 'ticket', recipientId), true);
  assert.equal(await DarkMessageStore.claim(id, 'buyer', 'guild', 'ticket', recipientId), false);
  assert.match(queries[0][0], /buyer_id = \? AND guild_id = \? AND source_channel_id = \? AND status = 'issued'/);
  assert.equal(released, 2);
});
