const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { DiaryRebuildService: Service } = require('../dist/service/diary/diaryRebuildService');
const { DbService } = require('../dist/service/system/dbService');
const { withDiaryMutation } = require('../dist/service/diary/diaryMutationGuard');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { FORUM_IDS, ROLE_IDS } = require('../dist/constant/shared/id');
const originalConnection = DbService.getConnection;
const originalGuild = process.env.GUILD_ID;
afterEach(() => { DbService.getConnection = originalConnection; process.env.GUILD_ID = originalGuild; Service.drafts.clear(); });

function fixture(options = {}) {
  process.env.GUILD_ID = 'guild';
  let state = { wallet: 10000, frozen: false, diary: { thread_id: 'old', type: 'diaryPublic', is_private: 0, creator_user_id: 'user', is_active: 1 }, jobs: {}, actions: [] };
  let transaction;
  const events = [];
  const draft = { id: 'operation', userId: 'user', guildId: 'guild', channelId: 'panel', messageId: 'message', oldThreadId: 'old', type: 'diaryPublic', isPrivate: 0, title: 'new title', body: 'body', expiresAt: Date.now() + 60000 };
  const threads = new Map();
  function makeThread(id) {
    return { id, parentId: FORUM_IDS.DIARY, isThread: () => true,
      permissionsFor: () => ({ has: bit => bit === PermissionFlagsBits.ManageThreads }),
      async delete() {
        if (id === 'old' && options.deleteFails) throw new Error('delete failure');
        events.push(`delete:${id}`); threads.delete(id);
      } };
  }
  threads.set('old', makeThread('old'));
  const forum = { type: ChannelType.GuildForum, guildId: 'guild', guild: { members: { fetchMe: async () => ({}) } }, threads: {
    async create() {
      events.push('create');
      if (options.createFails) throw Object.assign(new Error('creation failed'), { status: 403 });
      if (options.createUnknown) throw new Error('network unavailable');
      threads.set('new', makeThread('new'));
      if (options.afterCreate) options.afterCreate(state);
      return threads.get('new');
    }
  } };
  const connection = {
    release() {}, destroy() {},
    async beginTransaction() { transaction = structuredClone(state); },
    async rollback() { if (transaction) state = transaction; transaction = undefined; },
    async commit() {
      if (options.commitRollback) throw new Error('commit not received');
      transaction = undefined; events.push('commit');
      if (options.commitUnknown) throw new Error('commit response lost');
    },
    async execute(sql, values = []) {
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('RELEASE_LOCK')) return [[{}]];
      if (sql.startsWith('SELECT * FROM diaries')) return [[state.diary].filter(Boolean)];
      if (sql.startsWith('SELECT wallet')) return [[{ wallet: state.wallet, is_frozen: state.frozen }]];
      if (sql.startsWith('SELECT id FROM diary_rebuilds')) return [Object.values(state.jobs).filter(j => !['failed', 'complete'].includes(j.status))];
      if (sql.startsWith('SELECT * FROM diary_rebuilds WHERE id')) return [[state.jobs[values[0]]].filter(Boolean)];
      if (sql.startsWith('SELECT * FROM diary_rebuilds WHERE status')) return [Object.values(state.jobs).filter(j => ['pending_delete', 'prepared', 'creating'].includes(j.status))];
      if (sql.startsWith('INSERT INTO diary_rebuilds')) {
        state.jobs[values[0]] = { id: values[0], user_id: values[1], old_thread_id: values[2], new_thread_id: null, status: 'creating' }; return [{}];
      }
      if (sql.startsWith('UPDATE accounts')) { state.wallet -= values[0]; return [{}]; }
      if (sql.startsWith('UPDATE diaries')) { state.diary.thread_id = values[0]; state.diary.is_active = 1; return [{}]; }
      if (sql.startsWith('INSERT INTO actions')) {
        if (options.ledgerFails) throw new Error('ledger failed');
        state.actions.push(values); return [{}];
      }
      if (sql.startsWith('UPDATE diary_rebuilds SET new_thread_id')) { Object.assign(state.jobs[values[1]], { new_thread_id: values[0], status: 'prepared' }); return [{}]; }
      if (sql.startsWith('UPDATE diary_rebuilds SET status = ?')) { state.jobs[values[1]].status = values[0]; return [{}]; }
      if (sql.startsWith('UPDATE diary_rebuilds SET status')) {
        state.jobs[values[0]].status = sql.match(/status = '([^']+)'/)[1]; return [{}];
      }
      throw new Error(`Unmocked SQL: ${sql}`);
    }
  };
  DbService.getConnection = async () => connection;
  const replies = [];
  const interaction = {
    client: { channels: { fetch: async id => id === FORUM_IDS.DIARY ? forum : threads.get(id) || null } },
    user: { id: 'user' }, guildId: 'guild', channelId: 'panel', message: { id: 'message' },
    guild: { members: { fetch: async () => ({ roles: { cache: new Set(options.sub ? [ROLE_IDS.SUB_ACCOUNT] : []) } }) } },
    customId: 'diaryRebuild:confirm:operation',
    async editReply(data) { replies.push(data); return { id: 'message' }; },
    async deferReply() {}, async followUp(data) { replies.push(data); }
  };
  return { get state() { return state; }, draft, interaction, options, threads, events, replies,
    execute: () => Service.execute(interaction, draft) };
}

test('rebuild commits one 5000 LIA charge and registry swap before deleting the old thread', async () => {
  const f = fixture();
  assert.deepEqual(await f.execute(), { threadId: 'new', deleted: true });
  assert.equal(f.state.wallet, 5000); assert.equal(f.state.actions.length, 1);
  assert.equal(f.state.actions[0][0], 'diary_rebuild'); assert.equal(f.state.diary.thread_id, 'new');
  assert.deepEqual(f.events, ['create', 'commit', 'delete:old']);
  assert.equal(f.state.jobs.operation.status, 'complete');
  await assert.rejects(f.execute(), /日記が変更/);
  assert.equal(f.state.actions.length, 1);
});

test('insufficient wallet, frozen account, sub account, or changed diary prevent creation and payment', async () => {
  for (const kind of ['wallet', 'frozen', 'sub', 'changed']) {
    const f = fixture({ sub: kind === 'sub' });
    if (kind === 'wallet') f.state.wallet = 4999;
    if (kind === 'frozen') f.state.frozen = true;
    if (kind === 'changed') f.state.diary.thread_id = 'another';
    await assert.rejects(f.execute()); assert.deepEqual(f.events, []); assert.equal(f.state.actions.length, 0);
  }
});

test('wallet is rechecked after thread creation; failed settlement preserves original and removes replacement', async () => {
  const f = fixture({ afterCreate: state => { state.wallet = 100; } });
  await assert.rejects(f.execute(), /支払い・元の日記の削除は行っていません/);
  assert.equal(f.state.wallet, 100); assert.equal(f.state.diary.thread_id, 'old');
  assert.equal(f.state.actions.length, 0); assert.deepEqual(f.events, ['create', 'delete:new']);
});

test('creation failure does not charge or delete; definite failure permits another attempt', async () => {
  const f = fixture({ createFails: true });
  await assert.rejects(f.execute(), /作成できません/);
  assert.equal(f.state.wallet, 10000); assert.ok(f.threads.has('old')); assert.equal(f.state.jobs.operation.status, 'failed');
});

test('ambiguous creation is blocked for review without charging or deleting old diary', async () => {
  const f = fixture({ createUnknown: true }); await assert.rejects(f.execute());
  assert.equal(f.state.jobs.operation.status, 'needs_review'); await assert.rejects(f.execute(), /確認中/);
  assert.equal(f.state.wallet, 10000); assert.ok(f.threads.has('old'));
});

test('failed action insert rolls back charge and registry swap together', async () => {
  const f = fixture({ ledgerFails: true }); await assert.rejects(f.execute());
  assert.equal(f.state.wallet, 10000); assert.equal(f.state.diary.thread_id, 'old');
  assert.equal(f.state.actions.length, 0); assert.ok(f.threads.has('old')); assert.ok(!f.threads.has('new'));
});

test('deletion failure is durable and recovery deletes without another charge', async () => {
  const f = fixture({ deleteFails: true });
  assert.equal((await f.execute()).deleted, false); assert.equal(f.state.jobs.operation.status, 'pending_delete');
  await assert.rejects(f.execute(), /確認中/);
  f.options.deleteFails = false; await Service.recover(f.interaction.client);
  assert.equal(f.state.jobs.operation.status, 'complete'); assert.equal(f.state.wallet, 5000);
  assert.equal(f.state.actions.length, 1); assert.ok(!f.threads.has('old'));
});

test('lost COMMIT response never deletes paid replacement; recovery reads committed status', async () => {
  const f = fixture({ commitUnknown: true }); await assert.rejects(f.execute(), /支払い結果を確認中/);
  assert.ok(f.threads.has('old')); assert.ok(f.threads.has('new')); assert.equal(f.state.wallet, 5000);
  await Service.recover(f.interaction.client);
  assert.equal(f.state.jobs.operation.status, 'complete'); assert.equal(f.state.actions.length, 1);
  assert.ok(f.threads.has('new')); assert.ok(!f.threads.has('old'));
});

test('uncommitted payment leaves a prepared cleanup job and never removes original', async () => {
  const f = fixture({ commitRollback: true }); await assert.rejects(f.execute());
  await Service.recover(f.interaction.client);
  assert.equal(f.state.wallet, 10000); assert.equal(f.state.diary.thread_id, 'old');
  assert.ok(f.threads.has('old')); assert.ok(!f.threads.has('new')); assert.equal(f.state.jobs.operation.status, 'failed');
});

test('recovery preserves original if paid replacement is missing', async () => {
  const f = fixture({ deleteFails: true }); await f.execute();
  f.threads.delete('new'); f.options.deleteFails = false;
  await Service.recover(f.interaction.client);
  assert.ok(f.threads.has('old')); assert.equal(f.state.jobs.operation.status, 'needs_review');
});

test('confirmation is owner/message-bound and cancellation or expiry never pays', async () => {
  for (const kind of ['user', 'message', 'cancel', 'expired']) {
    const f = fixture(); Service.drafts.set(f.draft.id, f.draft);
    if (kind === 'user') f.interaction.user.id = 'other';
    if (kind === 'message') f.interaction.message.id = 'other';
    if (kind === 'cancel') f.interaction.customId = 'diaryRebuild:cancel:operation';
    if (kind === 'expired') f.draft.expiresAt = 0;
    await Service.handleButton(f.interaction);
    assert.equal(f.state.wallet, 10000); assert.deepEqual(f.events, []);
  }
});

test('double confirmation settles only once', async () => {
  const f = fixture(); Service.drafts.set(f.draft.id, f.draft);
  await Promise.all([Service.handleButton(f.interaction), Service.handleButton(f.interaction)]);
  assert.equal(f.state.wallet, 5000); assert.equal(f.state.actions.length, 1);
});

test('confirmation copy includes old diary, fixed price, irreversible deletion and preserved type', async () => {
  const f = fixture(); f.state.diary.type = 'diaryPrivate'; f.state.diary.is_private = 1;
  await Service.showConfirmation(f.interaction, 'new name', 'hello');
  const data = f.replies[0]; const embed = data.embeds[0].toJSON();
  assert.match(embed.description, /5,000 LIA/); assert.match(embed.description, /<#old>/);
  assert.match(embed.description, /元に戻せません/); assert.equal(embed.fields[0].value, '🔒 new name');
  assert.equal(embed.fields[1].value, '通常日記');
  assert.equal(data.components[0].toJSON().components.length, 2);
});

test('diary mutation guard rejects concurrent legacy/rebuild changes and releases after failure', async () => {
  await withDiaryMutation('user', async () => {
    await assert.rejects(withDiaryMutation('user', async () => {}), /処理中/);
  });
  await assert.rejects(withDiaryMutation('user', async () => { throw new Error('test'); }));
  await withDiaryMutation('user', async () => {});
  assert.equal(shouldDeferButtonUpdate('diaryRebuild:confirm:id'), true);
  assert.equal(shouldDeferButtonUpdate('diaryRebuild:cancel:id'), true);
  assert.equal(shouldDeferButtonUpdate('diaryRebuild'), false);
});
