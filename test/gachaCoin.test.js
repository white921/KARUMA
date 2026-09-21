const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageGachaCoins, GachaCoinService } = require('../dist/service/market/gachaCoinService');
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const { GACHA_COIN_REWARDS, GACHA_COIN_MAX } = require('../dist/constant/market/gachaCoin');
const { createGachaCoinPanelPayload } = require('../dist/panel/market/gachaCoinPanelService');
const { handleGachaCoinButton } = require('../dist/service/market/gachaCoinInteractionService');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { resolvePanelInstallTarget } = require('../dist/panel/panelInstallService');
const grant = require('../dist/command/market/gachaCoinGrant');
const deduct = require('../dist/command/market/gachaCoinDeduct');

test('ガチャコイン管理は指定5役職だけに許可する', () => {
  for (const role of [ROLE_IDS.SHOP_STAFF, ROLE_IDS.SHOP_LEADER, ROLE_IDS.GIJUTU_LEADER, ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI]) {
    assert.equal(canManageGachaCoins({ roles: [role] }), true);
    assert.equal(canManageGachaCoins({ roles: { cache: new Set([role]) } }), true);
  }
  for (const role of [ROLE_IDS.GINKOU_STAFF, ROLE_IDS.GINKOU_LEADER, ROLE_IDS.DARK_SHOP_LEADER, '1551125009664188416', 'unknown']) {
    assert.equal(canManageGachaCoins({ roles: [role] }), false);
  }
  assert.equal(canManageGachaCoins(null), false);
  assert.equal(canManageGachaCoins({ permissions: { administrator: true } }), false);
});

test('権限は最新のメンバーを取得し、権限のない操作では残高更新しない', async t => {
  const fetches = [];
  const interaction = { user: { id: '1001' }, guild: { members: { fetch: async opts => { fetches.push(opts); return { roles: [] }; } } },
    member: { roles: [ROLE_IDS.SHOP_STAFF] }, options: {} };
  const adjust = t.mock.method(GachaCoinService, 'adjust', async () => { throw new Error('must not execute'); });
  for (const command of [grant, deduct]) await assert.rejects(command.execute(interaction), /のみ実行/);
  assert.equal(adjust.mock.callCount(), 0);
  assert.deepEqual(fetches[0], { user: '1001', force: true });
});

test('コマンドは付与・減算を分け、正の整数と理由を受け付ける', async t => {
  t.mock.method(GachaCoinService, 'assertOperator', async () => {});
  const amounts = [];
  t.mock.method(GachaCoinService, 'adjust', async (...args) => { amounts.push(args); return 30; });
  for (const command of [grant, deduct]) {
    const json = command.data.toJSON();
    assert.equal(json.dm_permission, false);
    assert.equal(json.options[1].min_value, 1);
    assert.equal(json.options[1].max_value, GACHA_COIN_MAX);
    const replies = [];
    await command.execute({ id: 'request', user: { id: 'operator' }, options: { getUser: () => ({ id: 'target' }), getInteger: () => 10, getString: () => 'reason' }, editReply: async r => replies.push(r) });
    assert.match(replies[0].content, /30枚/);
  }
  assert.deepEqual(amounts.map(a => a[2]), [10, -10]);
});

test('不正な枚数はDBに接続せず拒否する', async () => {
  for (const amount of [0, NaN, Infinity, 1.5, GACHA_COIN_MAX + 1]) await assert.rejects(GachaCoinService.adjust('id', 'user', amount, 'op', ''), /枚数/);
});

test('パネルは3券種の時間とレート、手動交換の全景品、残高確認を表示する', () => {
  assert.deepEqual(GACHA_COIN_REWARDS.map(r => r.cost), [10, 20, 25]);
  const payload = createGachaCoinPanelPayload();
  const embed = payload.embeds[0].toJSON();
  assert.match(embed.fields[0].value, /遊戯24時間/);
  assert.match(embed.fields[0].value, /シクレ12時間/);
  assert.match(embed.fields[0].value, /フリーダム12時間/);
  for (const name of ['通行証', '評価延長3', '評価延長5', '再評価券', 'オリジナルロール']) assert.ok(embed.fields[1].value.includes(name));
  assert.deepEqual(payload.components.flatMap(row => row.components.map(button => button.data.custom_id)),
    ['gachaCoin:start', 'gachaCoin:balance', 'shopTicketView']);
  assert.equal(TEXT_CHANNEL_IDS.GACHA_COIN_PANEL, '1551480569232236625');
  assert.equal(resolvePanelInstallTarget(TEXT_CHANNEL_IDS.GACHA_COIN_PANEL), 'gacha_coin');
});

test('選択は確認画面だけを作り、確定・キャンセルは本人と確認IDを渡す', async t => {
  const calls = [];
  t.mock.method(GachaCoinService, 'getBalance', async () => 50);
  t.mock.method(GachaCoinService, 'createRequest', async (...args) => { calls.push(['request', ...args]); return 50; });
  t.mock.method(GachaCoinService, 'redeem', async (...args) => { calls.push(['redeem', ...args]); return { reward: GACHA_COIN_REWARDS[0], balance: 40, alreadyCompleted: false }; });
  t.mock.method(GachaCoinService, 'cancel', async (...args) => { calls.push(['cancel', ...args]); });
  const replies = [];
  const interaction = { id: '123456789012345678', user: { id: '1001' }, customId: 'gachaCoin:start', editReply: async p => replies.push(p) };
  await handleGachaCoinButton(interaction);
  assert.deepEqual(calls, []);
  assert.deepEqual(replies[0].components[0].components.map(button => button.data.custom_id),
    ['gachaCoin:select:game', 'gachaCoin:select:secret', 'gachaCoin:select:freedom']);
  assert.match(replies[0].embeds[0].data.description, /50枚/);
  assert.equal(shouldDeferButtonUpdate('gachaCoin:start'), false);
  replies.length = 0;
  interaction.customId = 'gachaCoin:select:game';
  await handleGachaCoinButton(interaction);
  assert.deepEqual(calls, [['request', interaction.id, '1001', 'game']]);
  assert.equal(replies[0].components[0].components[0].data.custom_id, `gachaCoin:confirm:${interaction.id}`);
  for (const action of ['confirm', 'cancel']) {
    interaction.customId = `gachaCoin:${action}:${interaction.id}`;
    assert.equal(shouldDeferButtonUpdate(interaction.customId), true);
    await handleGachaCoinButton(interaction);
    assert.deepEqual(replies.at(-1).components, []);
  }
  assert.equal(shouldDeferButtonUpdate('gachaCoin:select:game'), false);
  assert.deepEqual(calls.slice(1), [['redeem', interaction.id, '1001'], ['cancel', interaction.id, '1001']]);
});
