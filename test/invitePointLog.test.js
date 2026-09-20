const test = require('node:test');
const assert = require('node:assert/strict');
const { execute } = require('../dist/command/market/invitePointAdd');
const { InvitePointService } = require('../dist/service/market/invitePointService');

function fixture({ failSend = false, guildId = 'guild', thread = true, failReply = false } = {}) {
  const calls = [];
  return { calls, interaction: {
    id: '1234567890123456789', guildId: 'guild', user: { id: 'operator' },
    options: { getUser: () => ({ id: 'target' }), getInteger: () => 5 },
    client: { channels: { fetch: async id => {
      calls.push(['fetch', id]);
      return { guildId, isThread: () => thread, send: async payload => {
        calls.push(['send', payload]);
        if (failSend) throw new Error('Discord unavailable');
      } };
    } } },
    editReply: async payload => {
      calls.push(['reply', payload]);
      if (failReply) throw new Error('Reply unavailable');
    },
  } };
}

function mockGrant(t, calls) {
  t.mock.method(InvitePointService, 'assertOperator', async () => {});
  return t.mock.method(InvitePointService, 'grant', async (...args) => {
    calls.push(['grant', ...args]);
    return 12;
  });
}

test('付与確定後に指定スレッドへ付与者・対象者・ポイント・残高・日時を記録する', async t => {
  const { calls, interaction } = fixture();
  mockGrant(t, calls);
  await execute(interaction);
  assert.deepEqual(calls.map(([kind]) => kind), ['grant', 'fetch', 'send', 'reply']);
  assert.deepEqual(calls[0], ['grant', 'target', 5, 'operator']);
  assert.deepEqual(calls[1], ['fetch', '1551228490374971532']);
  const payload = calls[2][1];
  const embed = payload.embeds[0].toJSON();
  assert.deepEqual(embed.fields, [
    { name: '付与者', value: '<@operator>' },
    { name: '対象者', value: '<@target>' },
    { name: '付与ポイント', value: '5pt', inline: true },
    { name: '付与後残高', value: '12pt', inline: true },
  ]);
  assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(payload.nonce, interaction.id);
  assert.equal(payload.enforceNonce, true);
});

test('付与失敗時はDiscordログを送信しない', async t => {
  const { calls, interaction } = fixture();
  mockGrant(t, calls);
  t.mock.method(InvitePointService, 'grant', async () => { throw new Error('DB failure'); });
  await assert.rejects(execute(interaction), /DB failure/);
  assert.deepEqual(calls, []);
});

test('ログ送信失敗でも付与を再実行せず成功応答を返す', async t => {
  const { calls, interaction } = fixture({ failSend: true });
  const grant = mockGrant(t, calls);
  const errors = t.mock.method(console, 'error', () => {});
  await execute(interaction);
  assert.equal(grant.mock.callCount(), 1);
  assert.match(calls.at(-1)[1].content, /5pt 追加しました/);
  assert.equal(errors.mock.callCount(), 1);
});

test('別サーバーや通常チャンネルへ誤送信しない', async t => {
  t.mock.method(console, 'error', () => {});
  for (const options of [{ guildId: 'wrong' }, { thread: false }]) {
    const { calls, interaction } = fixture(options);
    mockGrant(t, calls);
    await execute(interaction);
    assert.equal(calls.filter(([kind]) => kind === 'send').length, 0);
  }
});

test('実行者への返信に失敗してもログは送信済み', async t => {
  const { calls, interaction } = fixture({ failReply: true });
  mockGrant(t, calls);
  await assert.rejects(execute(interaction), /Reply unavailable/);
  assert.equal(calls.filter(([kind]) => kind === 'send').length, 1);
});
