const { GachaCoinExchangeLogService } = require('../dist/service/market/gachaCoinExchangeLogService');
const test = require('node:test');
const assert = require('node:assert/strict');
const grant = require('../dist/command/market/gachaCoinGrant');
const deduct = require('../dist/command/market/gachaCoinDeduct');
const { GachaCoinService } = require('../dist/service/market/gachaCoinService');
const { GachaCoinLogService } = require('../dist/service/market/gachaCoinLogService');
const { handleGachaCoinButton } = require('../dist/service/market/gachaCoinInteractionService');

function fixture({ failSend = false, guildId = 'guild', thread = true } = {}) {
  const calls = [];
  return { calls, interaction: {
    id: '1234567890123456789', guildId: 'guild', user: { id: 'operator' },
    options: { getUser: () => ({ id: 'target' }), getInteger: () => 5, getString: () => '交換対応' },
    client: { channels: { fetch: async id => {
      calls.push(['fetch', id]);
      return { guildId, isThread: () => thread, send: async payload => {
        calls.push(['send', payload]);
        if (failSend) throw new Error('Discord unavailable');
      } };
    } } },
    editReply: async payload => { calls.push(['reply', payload]); },
  } };
}

function mockAdjust(t, calls) {
  t.mock.method(GachaCoinService, 'assertOperator', async () => {});
  return t.mock.method(GachaCoinService, 'adjust', async (...args) => {
    calls.push(['adjust', ...args]); return 30;
  });
}

test('付与・減算の確定後に実行者・対象者・符号付き枚数・理由・日時を記録し残高は表示しない', async t => {
  for (const [command, sign, title] of [[grant, 1, 'ガチャコイン付与'], [deduct, -1, 'ガチャコイン減算']]) {
    const { calls, interaction } = fixture(); mockAdjust(t, calls);
    await command.execute(interaction);
    assert.deepEqual(calls.map(c => c[0]), ['adjust', 'fetch', 'send', 'reply']);
    assert.deepEqual(calls[0], ['adjust', interaction.id, 'target', 5 * sign, 'operator', '交換対応']);
    assert.deepEqual(calls[1], ['fetch', '1551487122236506183']);
    const payload = calls[2][1]; const embed = payload.embeds[0].toJSON();
    assert.equal(embed.title, title);
    assert.deepEqual(embed.fields, [
      { name: '実行者', value: '<@operator>' }, { name: '対象者', value: '<@target>' },
      { name: '増減枚数', value: sign > 0 ? '+5枚' : '-5枚', inline: true },
      { name: '理由', value: '交換対応' },
    ]);
    assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    assert.equal(payload.nonce, interaction.id); assert.equal(payload.enforceNonce, true);
  }
});

test('権限不足・残高不足など増減失敗時は成功ログを残さない', async t => {
  for (const command of [grant, deduct]) {
    for (const method of ['assertOperator', 'adjust']) {
      const { calls, interaction } = fixture(); mockAdjust(t, calls);
      t.mock.method(GachaCoinService, method, async () => { throw new Error('rejected'); });
      await assert.rejects(command.execute(interaction), /rejected/);
      assert.deepEqual(calls, []);
    }
  }
});

test('ログ送信失敗でもコインを再操作せず成功応答を返す', async t => {
  t.mock.method(console, 'error', () => {});
  for (const command of [grant, deduct]) {
    const { calls, interaction } = fixture({ failSend: true }); const adjust = mockAdjust(t, calls);
    await command.execute(interaction);
    assert.equal(adjust.mock.callCount(), 1);
    assert.match(calls.at(-1)[1].content, /残高: \*\*30枚/);
  }
});

test('別サーバーや通常チャンネルにはログを送信しない', async t => {
  t.mock.method(console, 'error', () => {});
  for (const options of [{ guildId: 'wrong' }, { thread: false }]) {
    const { calls, interaction } = fixture(options); mockAdjust(t, calls);
    await grant.execute(interaction);
    assert.equal(calls.filter(c => c[0] === 'send').length, 0);
  }
});

test('パネル交換ではコマンド用の増減ログを送信しない', async t => {
  t.mock.method(GachaCoinExchangeLogService, 'send', async () => {});
  const log = t.mock.method(GachaCoinLogService, 'send', async () => {});
  t.mock.method(GachaCoinService, 'redeem', async () => ({ reward: { label: '遊戯24時間チケット' }, balance: 20, alreadyCompleted: false }));
  await handleGachaCoinButton({ customId: 'gachaCoin:confirm:123', user: { id: 'target' }, editReply: async () => {} });
  assert.equal(log.mock.callCount(), 0);
});
