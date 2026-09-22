const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const {
  EvaluationDeadlineReminderService: service, reminderDate, selectReminderTargets, buildReminderPages,
} = require('../dist/service/evaluation/evaluationDeadlineReminderService');
const { EVALUATION_SHEET_FORUM_IDS: forums } = require('../dist/constant/evaluation/evaluationSheet');
const { ROLE_IDS } = require('../dist/constant/shared/id');
const { DbService } = require('../dist/service/system/dbService');

function sheetsFor(userId, deadline, { archived = false, created = '2026-09-10T00:00:00Z' } = {}) {
  const sheets = forums.map(forumId => ({ userId, forumId, threadId: `${userId}-${forumId}` }));
  const threads = new Map(sheets.map(s => [s.threadId, {
    id: s.threadId, parentId: s.forumId, name: `同じ名前〜 ${deadline}`, archived,
    createdTimestamp: Date.parse(created),
  }]));
  return { sheets, threads };
}

test('日本時間23時台のみ実行する（UTCの境界と日付）', () => {
  assert.equal(reminderDate(new Date('2026-09-22T13:59:59Z')), null);
  assert.equal(reminderDate(new Date('2026-09-22T14:00:00Z')), '2026-09-22');
  assert.equal(reminderDate(new Date('2026-09-22T14:59:59Z')), '2026-09-22');
  assert.equal(reminderDate(new Date('2026-09-22T15:00:00Z')), null);
});

test('アーカイブ済みを含む4枚を1人にまとめ、同名の別ユーザーは残す', () => {
  const a = sheetsFor('a', '09/24', { archived: true });
  const b = sheetsFor('b', '9/23');
  const result = selectReminderTargets('2026-09-22', [...a.sheets, ...b.sheets], new Map([...a.threads, ...b.threads]), new Set(['a', 'b']));
  assert.deepEqual(result, { twoDays: ['a'], oneDay: ['b'], issues: [] });
});

test('手動作成シートの全角チルダとゼロ埋めなし日付も同じ期限として判定する', () => {
  const a = sheetsFor('a', '09/24', { archived: true });
  a.threads.values().next().value.name = '名前～9/24';
  assert.deepEqual(selectReminderTargets('2026-09-22', a.sheets, a.threads, new Set(['a'])), {
    twoDays: ['a'], oneDay: [], issues: [],
  });
});

test('退会・旅人以外、当日・期限切れ・3日後は含めない', () => {
  for (const deadline of ['09/21', '09/22', '09/25']) {
    const a = sheetsFor('a', deadline);
    assert.deepEqual(selectReminderTargets('2026-09-22', a.sheets, a.threads, new Set(['a'])).twoDays, []);
    assert.deepEqual(selectReminderTargets('2026-09-22', a.sheets, a.threads, new Set(['a'])).oneDay, []);
  }
  const a = sheetsFor('left', '09/24');
  assert.deepEqual(selectReminderTargets('2026-09-22', a.sheets, a.threads, new Set()), { twoDays: [], oneDay: [], issues: [] });
});

test('年越し・月末・うるう年の1日後と2日後を判定する', () => {
  for (const [date, deadline, bucket, created] of [
    ['2026-12-30', '01/01', 'twoDays', '2026-12-20'],
    ['2026-12-31', '01/01', 'oneDay', '2026-12-20'],
    ['2026-09-30', '10/02', 'twoDays', '2026-09-20'],
    ['2028-02-28', '02/29', 'oneDay', '2028-02-20'],
    ['2027-02-28', '03/01', 'oneDay', '2027-02-20'],
  ]) {
    const a = sheetsFor('a', deadline, { created });
    assert.deepEqual(selectReminderTargets(date, a.sheets, a.threads, new Set(['a']))[bucket], ['a']);
  }
});

test('4枚の期限不一致・欠落・親フォーラム相違・古いシートを推測しない', () => {
  for (const alter of [
    a => a.threads.values().next().value.name = '名前〜 09/23',
    a => a.threads.delete(a.sheets[0].threadId),
    a => a.sheets.pop(),
    a => a.threads.values().next().value.parentId = 'wrong',
    a => a.threads.values().next().value.name = '期限なし',
    a => a.threads.values().next().value.createdTimestamp = Date.parse('2025-09-01'),
  ]) {
    const a = sheetsFor('a', '09/24'); alter(a);
    const result = selectReminderTargets('2026-09-22', a.sheets, a.threads, new Set(['a']));
    assert.equal(result.issues.length, 1);
    assert.deepEqual(result.twoDays, []);
    assert.deepEqual(result.oneDay, []);
  }
});

test('指定の本文・実メンション、片方0人・両方0人', () => {
  assert.deepEqual(buildReminderPages('2026-09-22', { twoDays: ['111'], oneDay: ['222'] }), [{
    content: `<@&${ROLE_IDS.EVALUATION_JUDGE}>\n9月22日 期限直前旅人一覧\n\n2日前\n<@111>\n\n1日前\n<@222>`,
    users: ['111', '222'], roles: [ROLE_IDS.EVALUATION_JUDGE],
  }]);
  assert.match(buildReminderPages('2026-09-22', { twoDays: [], oneDay: ['222'] })[0].content, /2日前\n該当者なし/);
  assert.deepEqual(buildReminderPages('2026-09-22', { twoDays: [], oneDay: [] }), []);
});

test('2000文字を超えた場合も全員を1回だけ掲載し、ロール通知は1回だけ', () => {
  const users = Array.from({ length: 250 }, (_, i) => String(100000000000000000n + BigInt(i)));
  const pages = buildReminderPages('2026-09-22', { twoDays: users.slice(0, 180), oneDay: users.slice(180) });
  assert.ok(pages.length > 1);
  assert.ok(pages.every(p => p.content.length <= 2000 && p.users.length <= 100));
  assert.deepEqual(pages.flatMap(p => p.users), users);
  assert.equal(pages.flatMap(p => p.roles).length, 1);
  assert.ok(pages.every(p => /[12]日前/.test(p.content)));
});

test('アーカイブ一覧をページ送りし、2ページ目も対象にできる', async () => {
  const calls = [];
  const guild = {
    channels: {
      fetchActiveThreads: async () => ({ threads: new Collection([['active', { id: 'active' }]]) }),
      fetch: async id => ({ type: ChannelType.GuildForum, threads: {
        fetchArchived: async options => {
          calls.push([id, options.before]);
          const tail = options.before ? 'old' : 'recent';
          return { threads: new Collection([[id + tail, { id: id + tail, archiveTimestamp: options.before ? 1000 : 2000 }]]), hasMore: !options.before };
        },
      } }),
    },
  };
  const threads = await service.fetchThreads(guild);
  assert.equal(threads.size, 9);
  assert.equal(calls.length, 8);
  assert.ok(forums.every(f => threads.has(f + 'old')));
});

function deliveryFixture(t, { row = null, failSaveOnce = false, locked = true, failSendAt = -1, pages } = {}) {
  process.env.GUILD_ID = 'guild';
  let stored = row, released = false, unlocked = false, sends = 0;
  const published = [];
  const connection = { release: () => released = true, execute: async (sql, values) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired: locked ? 1 : 0 }]];
    if (sql.includes('RELEASE_LOCK')) { unlocked = true; return [[]]; }
    if (sql.startsWith('SELECT pages')) return [stored ? [structuredClone(stored)] : []];
    if (sql.startsWith('INSERT')) { stored = { pages: JSON.parse(values[2]), message_ids: [], completed: 0 }; return [{}]; }
    if (sql.includes('SET message_ids')) {
      if (failSaveOnce) { failSaveOnce = false; throw new Error('DB unavailable after send'); }
      stored.message_ids = JSON.parse(values[0]); return [{}];
    }
    if (sql.includes('SET completed')) { stored.completed = 1; return [{}]; }
    throw new Error(sql);
  } };
  t.mock.method(DbService, 'getConnection', async () => connection);
  const channel = { client: { user: { id: 'bot' } }, messages: { fetch: async () => new Collection(published.map(m => [m.id, m])) },
    send: async payload => {
      const n = sends++;
      if (n === failSendAt) throw new Error('Discord unavailable');
      const message = { id: String(n + 1), author: { id: 'bot' }, content: payload.content, createdTimestamp: Date.parse('2026-09-22T14:00:01Z'), payload };
      published.unshift(message); return message;
    },
  };
  const destination = t.mock.method(service, 'getDestination', async () => channel);
  const preview = t.mock.method(service, 'preview', async () => ({ issues: [], pages: pages ?? buildReminderPages('2026-09-22', { twoDays: ['111'], oneDay: ['222'] }) }));
  return { run: () => service.run({}, new Date('2026-09-22T14:00:00Z')), state: () => ({ stored, released, unlocked, sends }), published, destination, preview };
}

test('送信記録により再実行・再起動しても当日の通知は1回だけ', async t => {
  const f = deliveryFixture(t);
  await f.run(); await f.run();
  assert.equal(f.state().sends, 1);
  assert.equal(f.state().stored.completed, 1);
  assert.ok(f.state().released && f.state().unlocked);
  assert.deepEqual(f.published[0].payload.allowedMentions, { parse: [], users: ['111', '222'], roles: [ROLE_IDS.EVALUATION_JUDGE] });
  assert.equal(f.published[0].payload.enforceNonce, true);
  assert.ok(f.published[0].payload.nonce.length <= 25);
});

test('送信成功・DB更新失敗からの再試行は投稿を読み戻し、二重メンションしない', async t => {
  const f = deliveryFixture(t, { failSaveOnce: true });
  await assert.rejects(f.run(), /DB unavailable/);
  assert.equal(f.state().stored.completed, 0);
  await f.run();
  assert.equal(f.state().sends, 1);
  assert.deepEqual(f.state().stored.message_ids, ['1']);
  assert.equal(f.state().stored.completed, 1);
});

test('分割投稿の途中で失敗しても送信済みページは繰り返さない', async t => {
  const pages = [
    { content: 'first', users: ['111'], roles: [ROLE_IDS.EVALUATION_JUDGE] },
    { content: 'second', users: ['222'], roles: [] },
  ];
  const f = deliveryFixture(t, { pages, failSendAt: 1 });
  await assert.rejects(f.run(), /Discord unavailable/);
  assert.deepEqual(f.state().stored.message_ids, ['1']);
  await f.run();
  assert.deepEqual(f.published.map(m => m.content), ['second', 'first']);
  assert.equal(f.state().stored.completed, 1);
  assert.equal(f.preview.mock.callCount(), 1);
});

test('両方0人の日は何も投稿せず、完了記録だけ残す', async t => {
  const f = deliveryFixture(t, { pages: [] }); await f.run();
  assert.equal(f.state().sends, 0);
  assert.equal(f.state().stored.completed, 1);
});

test('別プロセスが実行中なら処理・送信しない', async t => {
  const f = deliveryFixture(t, { locked: false }); await f.run();
  assert.equal(f.destination.mock.callCount(), 0);
  assert.equal(f.state().sends, 0);
  assert.ok(f.state().released);
});

test('取得失敗時は未完了状態を維持し、次回に対象者を再取得する', async t => {
  const f = deliveryFixture(t);
  f.preview.mock.mockImplementationOnce(async () => { throw new Error('source API unavailable'); });
  await assert.rejects(f.run(), /source API unavailable/);
  assert.equal(f.state().stored, null);
  assert.ok(f.state().released && f.state().unlocked);
  await f.run();
  assert.equal(f.state().sends, 1);
});

test('履歴が100件以上あっても当日の送信済み投稿を発見する', async () => {
  const pages = [{ content: 'notice', users: [], roles: [] }];
  const recent = new Collection(Array.from({ length: 100 }, (_, i) => [String(i), {
    id: String(i), author: { id: 'other' }, content: 'chat', createdTimestamp: Date.parse('2026-09-22T14:30:00Z'),
  }]));
  const channel = { client: { user: { id: 'bot' } }, messages: { fetch: async ({ before }) => !before ? recent : new Collection([
    ['notice', { id: 'notice', author: { id: 'bot' }, content: 'notice', createdTimestamp: Date.parse('2026-09-22T14:00:00Z') }],
    ['old', { id: 'old', author: { id: 'bot' }, content: 'notice', createdTimestamp: Date.parse('2026-09-22T13:59:00Z') }],
  ]) } };
  assert.equal((await service.findDeliveredPages(channel, '2026-09-22', pages)).get(0), 'notice');
});
