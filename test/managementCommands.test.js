const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType, EmbedBuilder } = require('discord.js');
const { ROLE_IDS: R } = require('../dist/constant/shared/id');
const { COMMAND_NAMES: C } = require('../dist/constant/shared/command');
const { hasManagementPermission } = require('../dist/util/shared/managementPermission');
const { getEvaluationCommandHandlerTimeoutMs } = require('../dist/util/interaction/interactionHealth');
const { BalanceStatisticsService, calculateBalanceStatistics: stats } = require('../dist/service/currency/balanceStatisticsService');
const { VcCleanService, canCleanVc, shouldPreserveVcMessage } = require('../dist/service/vc/vcCleanService');
const { DbService } = require('../dist/service/system/dbService');
const { GuildMemberCacheService } = require('../dist/service/system/guildMemberCacheService');
const { AccountService } = require('../dist/service/account/accountService');
const { AdminOpenAccountService } = require('../dist/service/account/adminOpenAccountService');
const commands = ['currency/balanceStatistics', 'account/adminOpenAccount', 'currency/view', 'market/ticketGrant'].map(path => require(`../dist/command/${path}`));
const member = (roles = [], id = 'operator') => ({ id, roles: { cache: new Set(roles) }, user: { id, bot: false } });
function interaction(operator = member([R.KANRISYA])) {
  return { id: 'operation', user: { id: operator.id }, guild: { members: { fetch: async () => operator } }, options: { getUser: () => null, getRole: () => null }, editReply: async () => {} };
}

test('管理操作と他人の残高確認は英傑・皇帝・システム支配人だけを許可する', async () => {
  for (const role of [R.KANRISYA, R.SABANUSI, R.GIJUTU_LEADER]) assert.equal(hasManagementPermission(member([role])), true);
  for (const roles of [[], [R.CORE_MEMBER_ROLES.HONMEN], [R.GINKOU_STAFF], [R.GINKOU_LEADER], [R.SYSTEM_ASSISTANT]]) {
    assert.equal(hasManagementPermission(member(roles)), false);
    for (const command of commands) {
      const i = interaction(member(roles));
      i.options.getUser = () => ({ id: 'target' });
      await assert.rejects(command.execute(i), /英傑・皇帝・システム支配人/);
    }
  }
  for (const command of commands) await assert.rejects(command.execute({ guild: null }), /サーバー内/);
});

test('5コマンドの名前・任意指定・券種が登録される', () => {
  const definitions = [...commands, require('../dist/command/vc/vcClean')].map(c => c.data.toJSON());
  assert.deepEqual(definitions.map(d => d.name), ['残高統計', '口座発行', '残高確認', 'チケット付与', 'インチャ掃除']);
  assert.ok(definitions.every(d => d.dm_permission === false));
  assert.ok(definitions[1].options.every(o => !o.required));
  assert.equal(definitions[3].options.find(o => o.name === '種類').choices.length, 9);
  for (const command of [C.VC_CLEAN, C.ADMIN_OPEN_ACCOUNT, C.BALANCE_STATISTICS]) assert.ok(getEvaluationCommandHandlerTimeoutMs(command, false) > 120000);
});

test('統計は30,000のみ除外し、0・奇数・偶数・対象なしを正しく計算する', () => {
  assert.deepEqual(stats([30000, 0, 100, 200]), { count: 3, average: 100, median: 100 });
  assert.deepEqual(stats([30000, 1, 4]), { count: 2, average: 2.5, median: 2.5 });
  assert.deepEqual(stats([29999, 30001, 30000]), { count: 2, average: 30000, median: 30000 });
  assert.deepEqual(stats([30000]), { count: 0, average: null, median: null });
  assert.deepEqual(stats([]), { count: 0, average: null, median: null });
});

test('統計の対象は在籍するメイン口座でBot・サブロール・退会者を含めない', async t => {
  const members = new Collection([['main', member([], 'main')], ['initial', member([], 'initial')], ['bot', { ...member([], 'bot'), user: { bot: true } }], ['sub', member([R.SUB_ACCOUNT], 'sub')]]);
  t.mock.method(GuildMemberCacheService, 'getMembers', async () => members);
  let released = false;
  t.mock.method(DbService, 'getConnection', async () => ({
    execute: async sql => { assert.match(sql, /NOT EXISTS.*SELECT 1 FROM sub_accounts/s); return [[{ user_id: 'main', wallet: 100 }, { user_id: 'initial', wallet: 30000 }, { user_id: 'bot', wallet: 99999 }, { user_id: 'sub', wallet: 88888 }, { user_id: 'left', wallet: 0 }]]; },
    release: () => { released = true; },
  }));
  assert.deepEqual(await BalanceStatisticsService.get({}), { count: 1, average: 100, median: 100, excluded: 1 });
  assert.equal(released, true);
});

test('口座発行はユーザー・ロールの未指定と同時指定を拒否する', async () => {
  await assert.rejects(commands[1].execute(interaction()), /どちらか一方/);
  const i = interaction(); i.options = { getRole: () => ({ id: 'role' }), getUser: () => ({ id: 'user' }) };
  await assert.rejects(commands[1].execute(i), /どちらか一方/);
});

test('口座発行のユーザー指定はその1人だけ、ロール指定は一致メンバーだけに適用する', async t => {
  const target = { ...member(['target-role'], 'target'), displayName: '対象' };
  let targets; let reply;
  t.mock.method(AdminOpenAccountService, 'createAccountsForRole', async members => { targets = [...members.keys()]; return { openedMembers: [...members.values()], skippedMembers: [] }; });
  const i = interaction();
  i.guild.members.fetch = async ({ user }) => user === 'target' ? target : member([R.KANRISYA]);
  i.editReply = async value => { reply = value; };
  i.options.getUser = () => target.user;
  await commands[1].execute(i);
  assert.deepEqual(targets, ['target']); assert.match(reply.content, /対象|target/);
  i.options.getUser = () => null; i.options.getRole = () => ({ id: 'target-role' });
  i.guild.roles = { fetch: async () => ({ id: 'target-role', name: '対象ロール' }) };
  t.mock.method(GuildMemberCacheService, 'getMembers', async () => new Collection([['target', target], ['other', member([], 'other')]]));
  await commands[1].execute(i); assert.deepEqual(targets, ['target']);
});

test('残高確認の対象指定と省略時の自分が実際の口座参照に反映される', async t => {
  t.mock.method(AccountService, 'hasAccount', async () => true);
  const reads = [];
  t.mock.method(AccountService, 'getAccountByUserId', async userId => { reads.push(userId); return [{ wallet: 123 }]; });
  const i = interaction(); let reply; i.editReply = async value => { reply = value; };
  i.options.getUser = () => ({ id: 'target' });
  await commands[2].execute(i); assert.deepEqual(reads, ['target']); assert.match(reply.content, /target/);
  i.options.getUser = () => null;
  await commands[2].execute(i); assert.deepEqual(reads, ['target', 'operator']);
});

test('自分の残高はロールなしでも確認でき、自分を明示指定した場合も口座だけを検証する', async t => {
  const reads = [];
  t.mock.method(AccountService, 'hasAccount', async userId => { assert.equal(userId, 'operator'); return true; });
  t.mock.method(AccountService, 'getAccountByUserId', async userId => { reads.push(userId); return [{ wallet: 123 }]; });
  const i = interaction(member());
  i.guild.members.fetch = async () => { throw new Error('自分の確認では管理ロールの取得は不要'); };
  let reply; i.editReply = async value => { reply = value; };
  await commands[2].execute(i);
  i.options.getUser = () => ({ id: 'operator' });
  await commands[2].execute(i);
  assert.deepEqual(reads, ['operator', 'operator']);
  assert.match(reply.content, /123/);
});

test('口座がない本人の残高確認と、権限のない他人の残高確認は口座内容を返さない', async t => {
  const read = t.mock.method(AccountService, 'getAccountByUserId', async () => { throw new Error('残高を取得してはいけない'); });
  t.mock.method(AccountService, 'hasAccount', async () => false);
  const i = interaction(member());
  await assert.rejects(commands[2].execute(i), /口座が見つかりません/);
  i.options.getUser = () => ({ id: 'target' });
  await assert.rejects(commands[2].execute(i), /英傑・皇帝・システム支配人/);
  assert.equal(read.mock.callCount(), 0);
});

test('掃除権限は共用では貴族以上、Bot作成の部屋では部屋主または管理3ロール', () => {
  assert.equal(canCleanVc(member(), 'user'), false);
  assert.equal(canCleanVc(member([R.CORE_MEMBER_ROLES.HONMEN]), 'user'), true);
  assert.equal(canCleanVc(member(), 'owner', 'owner'), true);
  assert.equal(canCleanVc(member([R.CORE_MEMBER_ROLES.HONMEN]), 'guest', 'owner'), false);
  for (const role of [R.KANRISYA, R.SABANUSI, R.GIJUTU_LEADER]) assert.equal(canCleanVc(member([role]), 'admin', 'owner'), true);
});

function message(id, patch = {}) {
  return { id, pinned: false, author: { bot: false }, components: [], content: '会話', embeds: [], createdTimestamp: Date.now(), ...patch };
}
test('ピン留め・Botパネル・本文やEmbedの期限案内を残し、通常の発言を消す', () => {
  assert.equal(shouldPreserveVcMessage(message('1')), false);
  assert.equal(shouldPreserveVcMessage(message('1', { pinned: true })), true);
  assert.equal(shouldPreserveVcMessage(message('1', { author: { bot: true }, components: [{}] })), true);
  assert.equal(shouldPreserveVcMessage(message('1', { author: { bot: true }, content: '期限時刻: 明日' })), true);
  assert.equal(shouldPreserveVcMessage(message('1', { author: { bot: true }, embeds: [new EmbedBuilder().setDescription('有効期限: 明日')] })), true);
  assert.equal(shouldPreserveVcMessage(message('1', { content: '期限という単語の入った会話' })), false);
});

test('掃除は100件を超えて取得し、14日以上前も削除しつつ新着と保護メッセージを除外する', async t => {
  const deleted = []; const fetches = [];
  const pages = [new Collection(Array.from({ length: 100 }, (_, n) => [String(500 - n), message(String(500 - n))])), new Collection()];
  pages[0].set('500', message('500', { pinned: true }));
  pages[1].set('400', message('400', { author: { bot: true }, content: '期限時刻: 明日' }));
  pages[1].set('399', message('399', { createdTimestamp: 0, delete: async () => deleted.push('399') }));
  const channel = { id: 'vc', type: ChannelType.GuildVoice, permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async options => { fetches.push(options); return pages.shift(); } },
    bulkDelete: async values => { deleted.push(...values.keys()); return values; },
  };
  const operator = { ...member([R.CORE_MEMBER_ROLES.HONMEN]), voice: { channelId: 'vc' } };
  const i = interaction(operator); i.id = '600'; i.channel = channel; i.guild.members.fetchMe = async () => ({});
  t.mock.method(DbService, 'getConnection', async () => ({ execute: async () => [[]], release() {} }));
  assert.deepEqual(await VcCleanService.clean(i), { deleted: 100, preserved: 2, complete: true });
  assert.deepEqual(fetches.map(f => f.before), ['600', '401']);
  assert.equal(deleted.includes('500'), false); assert.equal(deleted.includes('400'), false); assert.equal(deleted.includes('399'), true);
  operator.voice.channelId = 'other';
  await assert.rejects(VcCleanService.clean(i), /参加/);
});
