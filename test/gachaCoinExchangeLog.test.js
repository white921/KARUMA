const test = require('node:test');
const assert = require('node:assert/strict');
const { GachaCoinService } = require('../dist/service/market/gachaCoinService');
const { GACHA_COIN_REWARDS } = require('../dist/constant/market/gachaCoin');
const { handleGachaCoinButton } = require('../dist/service/market/gachaCoinInteractionService');

function fixture({ failSend = false, guildId = 'guild', thread = true, failReply = false } = {}) {
  const calls = [];
  return { calls, interaction: {
    id: '1234567890123456789', customId: 'gachaCoin:confirm:1234567890123456788', guildId: 'guild', user: { id: 'user' },
    client: { channels: { fetch: async id => {
      calls.push(['fetch', id]);
      return { guildId, isThread: () => thread, send: async payload => {
        calls.push(['send', payload]); if (failSend) throw new Error('Discord unavailable');
      } };
    } } },
    editReply: async payload => { calls.push(['reply', payload]); if (failReply) throw new Error('Reply unavailable'); },
  } };
}
function mockExchange(t, calls, result = {}) {
  return t.mock.method(GachaCoinService, 'redeem', async (...args) => {
    calls.push(['redeem', ...args]);
    return { reward: GACHA_COIN_REWARDS[0], balance: 20, alreadyCompleted: false, ...result };
  });
}

test('各券種の交換確定後に指定スレッドへ内容を記録し残高は表示しない', async t => {
  for (const reward of GACHA_COIN_REWARDS) {
    const { calls, interaction } = fixture(); mockExchange(t, calls, { reward });
    await handleGachaCoinButton(interaction);
    assert.deepEqual(calls.map(c => c[0]), ['redeem', 'fetch', 'send', 'reply']);
    assert.deepEqual(calls[0], ['redeem', '1234567890123456788', 'user']);
    assert.deepEqual(calls[1], ['fetch', '1551813206740176986']);
    const payload = calls[2][1]; const embed = payload.embeds[0].toJSON();
    assert.deepEqual(embed.fields, [
      { name: '交換者', value: '<@user>' },
      { name: 'アイテム', value: `${reward.label} × 1枚` },
      { name: '消費コイン', value: `${reward.cost}枚`, inline: true },
    ]);
    assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    assert.equal(payload.nonce, '1234567890123456788'); assert.equal(payload.enforceNonce, true);
  }
});

test('同じ交換の再実行ではログを追加しない', async t => {
  const { calls, interaction } = fixture(); mockExchange(t, calls, { alreadyCompleted: true });
  await handleGachaCoinButton(interaction);
  assert.deepEqual(calls.map(c => c[0]), ['redeem', 'reply']);
});

test('交換失敗・キャンセル時には成功ログを送らない', async t => {
  const { calls, interaction } = fixture();
  t.mock.method(GachaCoinService, 'redeem', async () => { throw new Error('insufficient coins'); });
  await assert.rejects(handleGachaCoinButton(interaction), /insufficient/);
  assert.deepEqual(calls, []);
  t.mock.method(GachaCoinService, 'cancel', async () => {});
  interaction.customId = 'gachaCoin:cancel:1234567890123456788';
  await handleGachaCoinButton(interaction);
  assert.deepEqual(calls.map(c => c[0]), ['reply']);
});

test('ログ送信失敗でも交換を再実行せず成功を返す', async t => {
  const { calls, interaction } = fixture({ failSend: true }); const redeem = mockExchange(t, calls);
  const errors = t.mock.method(console, 'error', () => {});
  await handleGachaCoinButton(interaction);
  assert.equal(redeem.mock.callCount(), 1);
  assert.match(calls.at(-1)[1].content, /1枚受け取りました/);
  assert.equal(errors.mock.callCount(), 1);
});

test('別サーバーや通常チャンネルへ誤送信しない', async t => {
  t.mock.method(console, 'error', () => {});
  for (const options of [{ guildId: 'wrong' }, { thread: false }]) {
    const { calls, interaction } = fixture(options); mockExchange(t, calls);
    await handleGachaCoinButton(interaction);
    assert.equal(calls.filter(c => c[0] === 'send').length, 0);
  }
});

test('利用者への返信失敗時も交換ログは送信済み', async t => {
  const { calls, interaction } = fixture({ failReply: true }); mockExchange(t, calls);
  await assert.rejects(handleGachaCoinButton(interaction), /Reply unavailable/);
  assert.equal(calls.filter(c => c[0] === 'send').length, 1);
});
