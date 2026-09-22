const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');
const { DarkMessageStore } = require('../dist/service/market/darkMessageStore');
const { DarkDisclosureStore } = require('../dist/service/market/darkDisclosureStore');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { createDisclosureOffer } = require('../dist/panel/market/darkDisclosurePanel');

const requestId = '123456789012345678';
function setup(t, product = 'letter') {
  const events = [];
  const request = { request_id: requestId, product, guild_id: 'guild', recipient_id: 'recipient',
    status: 'delivered', delivery_channel_id: 'delivery', delivery_message_id: 'panel' };
  t.mock.method(DarkMessageStore, 'get', async () => request);
  t.mock.method(DarkDisclosureStore, 'purchase', async () => { throw Error('must not charge'); });
  const i = { customId: `darkClose:show:${requestId}`, user: { id: 'recipient' }, guildId: 'guild',
    channelId: 'delivery', client: { user: { id: 'bot' } }, message: { id: 'panel', author: { id: 'bot' } },
    channel: { id: 'delivery', type: ChannelType.GuildText, delete: async () => events.push(['delete']) },
    editReply: async p => events.push(['reply', p]) };
  const show = async () => {
    await handlePanelButton(i);
    return events.at(-1)[1].components[0].components.map(b => b.data.custom_id);
  };
  return { i, request, events, show };
}

test('開示パネルの閉じるボタンは本人限定の新規確認応答、確定・取消はその確認を更新', () => {
  const row = createDisclosureOffer(requestId).row.toJSON();
  assert.equal(row.components[1].label, 'このTCを閉じる');
  assert.equal(shouldDeferButtonUpdate(row.components[1].custom_id), false);
  for (const action of ['confirm', 'cancel'])
    assert.equal(shouldDeferButtonUpdate(`darkClose:${action}:${requestId}:token`), true);
});

for (const product of ['letter', 'whisper']) {
  test(`${product}: 初回は警告だけ、削除を確定して初めて対象TCを削除`, async t => {
    const { i, events, show } = setup(t, product);
    const [confirm] = await show();
    assert.deepEqual(events.map(e => e[0]), ['reply']);
    const panel = events[0][1];
    assert.match(panel.embeds[0].data.description, /復元できません/);
    assert.equal(panel.components[0].components[0].data.label, '削除');
    assert.equal(panel.components[0].components[0].data.style, 4);
    i.customId = confirm;
    await handlePanelButton(i);
    assert.deepEqual(events.map(e => e[0]), ['reply', 'reply', 'delete', 'reply']);
    await assert.rejects(handlePanelButton(i), /確認が無効/);
    assert.equal(events.filter(e => e[0] === 'delete').length, 1);
  });
}

test('キャンセル後は古い確認ボタンでも削除できない', async t => {
  const { i, events, show } = setup(t);
  const [confirm, cancel] = await show();
  i.customId = cancel;
  await handlePanelButton(i);
  assert.match(events.at(-1)[1].content, /キャンセル/);
  i.customId = confirm;
  await assert.rejects(handlePanelButton(i), /確認が無効/);
  assert.equal(events.some(e => e[0] === 'delete'), false);
});

test('確認なし・期限切れでは削除しない', async t => {
  const { i, events, show } = setup(t);
  const [confirm] = await show();
  i.customId = `darkClose:confirm:${requestId}:${'0'.repeat(24)}`;
  await assert.rejects(handlePanelButton(i), /確認が無効/);
  i.customId = confirm;
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 600001);
  await assert.rejects(handlePanelButton(i), /期限切れ/);
  assert.equal(events.some(e => e[0] === 'delete'), false);
});

for (const change of ['user', 'guild', 'channel', 'status', 'type', 'panel', 'author']) {
  test(`別の${change}からTC削除の確認を開けない`, async t => {
    const { i, request, events } = setup(t);
    if (change === 'user') i.user.id = 'operator';
    if (change === 'guild') i.guildId = 'other';
    if (change === 'channel') i.channelId = 'other';
    if (change === 'status') request.status = 'sending';
    if (change === 'type') i.channel.type = ChannelType.GuildVoice;
    if (change === 'panel') i.message.id = 'other';
    if (change === 'author') i.message.author.id = 'other';
    await assert.rejects(handlePanelButton(i));
    assert.deepEqual(events, []);
  });
}

test('確定時も宛先とTCを再確認し、別人・別TCへの確認流用を拒否', async t => {
  const { i, events, show } = setup(t);
  const [confirm] = await show();
  i.customId = confirm;
  i.user.id = 'other';
  await assert.rejects(handlePanelButton(i), /受取人本人/);
  i.user.id = 'recipient';
  i.channelId = 'other';
  await assert.rejects(handlePanelButton(i), /受取人本人/);
  assert.equal(events.some(e => e[0] === 'delete'), false);
});

test('複数の確認画面から同時確定しても削除を重ねない', async t => {
  const { i, events, show } = setup(t);
  const [first] = await show();
  const [second] = await show();
  const results = await Promise.allSettled([
    handlePanelButton({ ...i, customId: first }), handlePanelButton({ ...i, customId: second }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(events.filter(e => e[0] === 'delete').length, 1);
});

test('削除失敗は成功と表示せず、再度確認が必要', async t => {
  const { i, events, show } = setup(t);
  const [confirm] = await show();
  i.customId = confirm;
  i.channel.delete = async () => { throw Error('Missing permissions'); };
  await assert.rejects(handlePanelButton(i), /削除できませんでした/);
  assert.equal(events.some(e => e[1]?.content === 'TCを削除しました。'), false);
  await assert.rejects(handlePanelButton(i), /確認が無効/);
});
