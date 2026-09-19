const test = require('node:test');
const assert = require('node:assert/strict');
const { TicketExchangeLogService } = require('../dist/service/inventory/ticketExchangeLogService');
const { TicketExchangeService } = require('../dist/service/inventory/ticketExchangeService');
const { handleTicketExchangeButton } = require('../dist/service/inventory/ticketExchangeInteractionService');
const { THREAD_IDS, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const result = { label: 'VIPホテル無料券（12時間）', quantity: 10, amount: 30000, afterWallet: 31000, afterQuantity: 2, alreadyCompleted: false };
const requestId = '1234567890123456789';
function fixture({ failSend = false, guildId = 'guild', thread = true } = {}) {
  const calls = [];
  const client = { channels: { fetch: async id => {
    calls.push(['fetch', id]);
    return { isThread: () => thread, guildId, send: async payload => {
      calls.push(['send', payload]);
      if (failSend) throw new Error('Discord unavailable');
    } };
  } } };
  return { client, calls };
}

test('指定スレッドに換金者・券種・枚数・受取額をメンション通知なしで記録する', async () => {
  const { client, calls } = fixture();
  await TicketExchangeLogService.send(client, 'guild', '1001', requestId, result);
  assert.equal(THREAD_IDS.TICKET_EXCHANGE_LOG_THREAD, '1550824492194857071');
  assert.deepEqual(calls[0], ['fetch', THREAD_IDS.TICKET_EXCHANGE_LOG_THREAD]);
  const payload = calls[1][1];
  assert.deepEqual(payload.embeds[0].toJSON().fields, [
    { name: '換金した人', value: '<@1001>' },
    { name: 'チケット', value: result.label },
    { name: '換金枚数', value: '10枚', inline: true },
    { name: '受取額', value: '30,000 LIA', inline: true },
  ]);
  assert.deepEqual(payload.allowedMentions, { parse: [] });
  assert.equal(payload.nonce, requestId);
  assert.equal(payload.enforceNonce, true);
});

test('換金済み確認の再実行ではログを重複させない', async () => {
  const { client, calls } = fixture();
  await TicketExchangeLogService.send(client, 'guild', '1001', requestId, { ...result, alreadyCompleted: true });
  assert.deepEqual(calls, []);
});

test('換金失敗・キャンセルでは換金ログを送信しない', async t => {
  const { client, calls } = fixture();
  t.mock.method(TicketExchangeService, 'redeem', async () => { throw new Error('不足'); });
  const base = { channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', user: { id: '1001' }, client, editReply: async () => {} };
  await assert.rejects(handleTicketExchangeButton({ ...base, customId: `ticketExchange:confirm:${requestId}` }), /不足/);
  t.mock.method(TicketExchangeService, 'cancel', async () => {});
  await handleTicketExchangeButton({ ...base, customId: `ticketExchange:cancel:${requestId}` });
  assert.deepEqual(calls, []);
});

test('Discord送信失敗でも入金済みの利用者には換金成功を返す', async t => {
  const { client } = fixture({ failSend: true });
  const errors = t.mock.method(console, 'error', () => {});
  t.mock.method(TicketExchangeService, 'redeem', async () => result);
  let response;
  await handleTicketExchangeButton({ channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', user: { id: '1001' }, client,
    customId: `ticketExchange:confirm:${requestId}`, editReply: async p => { response = p; } });
  assert.match(response.content, /チケットを換金しました/);
  assert.equal(errors.mock.callCount(), 1);
  assert.equal(errors.mock.calls[0].arguments[1].requestId, requestId);
});

test('別サーバー・通常チャンネルへ誤送信しない', async t => {
  t.mock.method(console, 'error', () => {});
  for (const options of [{ guildId: 'wrong' }, { thread: false }]) {
    const { client, calls } = fixture(options);
    await TicketExchangeLogService.send(client, 'guild', '1001', requestId, result);
    assert.equal(calls.filter(([op]) => op === 'send').length, 0);
  }
});

test('成功応答の送信に失敗しても換金ログは保存する', async t => {
  const { client, calls } = fixture();
  t.mock.method(TicketExchangeService, 'redeem', async () => result);
  await assert.rejects(handleTicketExchangeButton({ channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', user: { id: '1001' }, client,
    customId: `ticketExchange:confirm:${requestId}`, editReply: async () => { throw new Error('reply failure'); } }), /reply failure/);
  assert.equal(calls.filter(([op]) => op === 'send').length, 1);
});
