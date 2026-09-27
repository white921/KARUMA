const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeMarkdown } = require('discord.js');
const { execute } = require('../dist/command/market/ticketGrant');
const { TicketGrantService } = require('../dist/service/inventory/ticketGrantService');
const { ROLE_IDS } = require('../dist/constant/shared/id');

function fixture({ failSend = false, failFetch = false, guildId = 'guild', thread = true, roles = [ROLE_IDS.KANRISYA], reason = 'イベント景品' } = {}) {
  const calls = [];
  const operator = { roles: { cache: new Set(roles) } };
  return { calls, interaction: {
    id: '1234567890123456789', guildId: 'guild', user: { id: 'operator' },
    guild: { members: { fetch: async ({ user }) => user === 'operator' ? operator : { user: { bot: false }, roles: { cache: new Set() } } } },
    options: {
      getUser: () => ({ id: 'target' }), getInteger: () => 5,
      getString: name => name === '種類' ? 'GAME_SHORT_FREE' : reason,
    },
    client: { channels: { fetch: async id => {
      calls.push(['fetch', id]);
      if (failFetch) throw new Error('Discord unavailable');
      return { guildId, isThread: () => thread, send: async payload => {
        calls.push(['send', payload]);
        if (failSend) throw new Error('Discord unavailable');
      } };
    } } },
    editReply: async payload => { calls.push(['reply', payload]); },
  } };
}

test('DB付与成功後、指定スレッドにチケット付与の詳細を送信する', async t => {
  const { calls, interaction } = fixture({ reason: '**景品** @everyone' });
  t.mock.method(TicketGrantService, 'grant', async (...args) => { calls.push(['grant', ...args]); return 10; });
  await execute(interaction);
  assert.deepEqual(calls.map(c => c[0]), ['grant', 'fetch', 'send', 'reply']);
  assert.deepEqual(calls[0], ['grant', interaction.id, 'target', 'GAME_SHORT_FREE', 5, 'operator', '**景品** @everyone']);
  assert.deepEqual(calls[1], ['fetch', '1553658899553452102']);
  const payload = calls[2][1]; const embed = payload.embeds[0].toJSON();
  assert.equal(embed.title, 'チケット付与');
  assert.deepEqual(embed.fields, [
    { name: '実行者', value: '<@operator>' },
    { name: '対象者', value: '<@target>' },
    { name: 'チケット', value: '遊戯チケット', inline: true },
    { name: '付与枚数', value: '5枚', inline: true },
    { name: '理由', value: escapeMarkdown('**景品** @everyone') },
  ]);
  assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(payload.nonce, interaction.id);
  assert.equal(payload.enforceNonce, true);
  assert.match(calls.at(-1)[1].content, /所持数：\*\*10枚/);
});

test('権限不足・付与失敗の場合は成功ログを送らない', async t => {
  const grant = t.mock.method(TicketGrantService, 'grant', async () => { throw new Error('付与失敗'); });
  const unauthorized = fixture({ roles: [] });
  await assert.rejects(execute(unauthorized.interaction), /のみ実行/);
  assert.equal(grant.mock.callCount(), 0);
  assert.deepEqual(unauthorized.calls, []);
  const failed = fixture();
  await assert.rejects(execute(failed.interaction), /付与失敗/);
  assert.deepEqual(failed.calls, []);
});

test('ログの取得・送信失敗でも付与を繰り返さず成功応答を返す', async t => {
  const errors = t.mock.method(console, 'error', () => {});
  for (const options of [{ failFetch: true }, { failSend: true }]) {
    const { calls, interaction } = fixture(options);
    const grant = t.mock.method(TicketGrantService, 'grant', async () => 10);
    await execute(interaction);
    assert.equal(grant.mock.callCount(), 1);
    assert.match(calls.at(-1)[1].content, /付与しました/);
  }
  assert.equal(errors.mock.callCount(), 2);
});

test('別サーバーや通常チャンネルにはログを送信しない', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(TicketGrantService, 'grant', async () => 10);
  for (const options of [{ guildId: 'wrong' }, { thread: false }]) {
    const { calls, interaction } = fixture(options);
    await execute(interaction);
    assert.equal(calls.filter(c => c[0] === 'send').length, 0);
    assert.match(calls.at(-1)[1].content, /付与しました/);
  }
});
