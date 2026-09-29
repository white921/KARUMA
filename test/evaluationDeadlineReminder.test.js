const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const {
  EvaluationDeadlineReminderService: service, EVALUATION_REMINDER_LEVELS,
  EVALUATION_REMINDER_SHEETS_PREFIX, reminderDate, selectReminderTargets, buildReminderPages,
  buildSheetLinkResponsePages, visibleEvaluationLevels,
} = require('../dist/service/evaluation/evaluationDeadlineReminderService');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { EVALUATION_SHEET_FORUM_IDS: forums } = require('../dist/constant/evaluation/evaluationSheet');
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
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
    content: `<@&${ROLE_IDS.EVALUATION_JUDGE}>\n<@&${ROLE_IDS.EVALUATION_SUPPORT}>\n9月22日 期限直前旅人一覧\n\n2日前\n<@111>\n\n1日前\n<@222>`,
    users: ['111', '222'], roles: [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT],
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
  assert.deepEqual(pages.flatMap(p => p.roles), [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT]);
  assert.ok(pages.every(p => /[12]日前/.test(p.content)));
});

test('通知本文を長くせず、各ユーザーの4階級スレッドを非表示データとして保持する', () => {
  const links = {
    '111': { upper: 'u1', middle: 'm1', lower: 'l1', beginner: 'b1' },
    '222': { upper: 'u2', middle: 'm2', lower: 'l2', beginner: 'b2' },
  };
  const pages = buildReminderPages('2026-09-22', { twoDays: ['111'], oneDay: ['222'] }, links);
  assert.doesNotMatch(pages[0].content, /<#/);
  assert.deepEqual(pages[0].sheetLinks, links);
});

test('階級ロールは該当階級だけ、統括・侍従・管理系ロールは4階級を表示する', () => {
  const member = (...roleIds) => ({ roles: { cache: new Collection(roleIds.map(id => [id, {}])) } });
  assert.deepEqual(visibleEvaluationLevels(member(ROLE_IDS.EVALUATION_1KYUU)).map(level => level.label), ['上級']);
  assert.deepEqual(visibleEvaluationLevels(member(ROLE_IDS.EVALUATION_2KYUU)).map(level => level.label), ['中級']);
  assert.deepEqual(visibleEvaluationLevels(member(ROLE_IDS.EVALUATION_3KYUU)).map(level => level.label), ['下級']);
  assert.deepEqual(visibleEvaluationLevels(member(ROLE_IDS.EVALUATION_BUIGINNER)).map(level => level.label), ['見習い']);
  assert.deepEqual(visibleEvaluationLevels(member(
    ROLE_IDS.EVALUATION_2KYUU, ROLE_IDS.EVALUATION_3KYUU,
  )).map(level => level.label), ['中級']);
  for (const roleId of [ROLE_IDS.EVALUATION_LEADER, ROLE_IDS.EVALUATION_SUPPORT,
    ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI, ROLE_IDS.GIJUTU_LEADER]) {
    assert.deepEqual(visibleEvaluationLevels(member(roleId)).map(level => level.label), ['上級', '中級', '下級', '見習い']);
  }
  assert.deepEqual(visibleEvaluationLevels(member(ROLE_IDS.EVALUATION_JUDGE)), []);
});

test('管理系向けの全リンクも2000文字以下に分割する', () => {
  const users = Array.from({ length: 100 }, (_, i) => String(100000000000000000n + BigInt(i)));
  const sheetLinks = Object.fromEntries(users.map((userId, i) => [userId, {
    upper: `u${i}`, middle: `m${i}`, lower: `l${i}`, beginner: `b${i}`,
  }]));
  const responses = buildSheetLinkResponsePages({ content: '', users, roles: [], sheetLinks }, EVALUATION_REMINDER_LEVELS);
  assert.ok(responses.length > 1);
  assert.ok(responses.every(content => content.length <= 2000));
  assert.equal(responses.join('\n').match(/→ <#/g).length, 400);
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

test('評価期限通知は指定スレッドを取得し、スレッド送信権限を確認する', async () => {
  process.env.GUILD_ID = 'guild';
  const fetched = [];
  const guild = {
    roles: {
      fetch: async () => {},
      cache: new Collection([
        [ROLE_IDS.EVALUATION_JUDGE, { mentionable: true }],
        [ROLE_IDS.EVALUATION_SUPPORT, { mentionable: true }],
      ]),
    },
    members: { fetchMe: async () => ({ id: 'bot' }) },
  };
  const permissions = new PermissionsBitField([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessagesInThreads,
    PermissionFlagsBits.ReadMessageHistory,
  ]);
  const thread = {
    guildId: 'guild', guild,
    isThread: () => true,
    permissionsFor: () => permissions,
  };
  const client = { channels: { fetch: async id => { fetched.push(id); return thread; } } };

  assert.equal(await service.getDestination(client), thread);
  assert.deepEqual(fetched, [TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD]);
  assert.equal(TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD, '1554425817893830686');
});

test('前日分と一致するBot自身の通知だけを削除する', async () => {
  const deleted = [];
  const message = (id, authorId, content, created) => ({
    id, author: { id: authorId }, content, createdTimestamp: Date.parse(created),
    delete: async () => deleted.push(id),
  });
  const messages = new Collection([
    ['current', message('current', 'bot', 'previous notice', '2026-09-22T14:00:00Z')],
    ['previous', message('previous', 'bot', 'previous notice', '2026-09-21T14:00:00Z')],
    ['other-author', message('other-author', 'other', 'previous notice', '2026-09-21T15:00:00Z')],
    ['other-content', message('other-content', 'bot', 'chat', '2026-09-21T15:00:00Z')],
  ]);
  const channel = {
    client: { user: { id: 'bot' } },
    messages: { fetch: async () => messages },
  };

  assert.equal(await service.deletePreviousReminderMessages(
    channel, '2026-09-22', [{ content: 'previous notice', users: [], roles: [] }],
  ), 1);
  assert.deepEqual(deleted, ['previous']);
});

function deliveryFixture(t, { row = null, previousRow = null, failSaveOnce = false, locked = true, failSendAt = -1, pages } = {}) {
  process.env.GUILD_ID = 'guild';
  let stored = row, released = false, unlocked = false, sends = 0;
  const published = [];
  const connection = { release: () => released = true, execute: async (sql, values) => {
    if (sql.includes('GET_LOCK')) return [[{ acquired: locked ? 1 : 0 }]];
    if (sql.includes('RELEASE_LOCK')) { unlocked = true; return [[]]; }
    if (sql.startsWith('SELECT pages FROM')) return [previousRow ? [structuredClone(previousRow)] : []];
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
  assert.deepEqual(f.published[0].payload.allowedMentions, {
    parse: [], users: ['111', '222'], roles: [ROLE_IDS.EVALUATION_JUDGE, ROLE_IDS.EVALUATION_SUPPORT],
  });
  assert.equal(f.published[0].payload.enforceNonce, true);
  assert.ok(f.published[0].payload.nonce.length <= 25);
});

test('評価シート情報がある通知には非公開表示ボタンを付ける', async t => {
  const pages = [{
    content: 'notice', users: ['111'], roles: [],
    sheetLinks: { '111': { upper: 'upper-thread' } },
  }];
  const f = deliveryFixture(t, { pages });
  await f.run();
  const component = f.published[0].payload.components[0].toJSON().components[0];
  assert.equal(component.label, '評価シートを表示');
  assert.equal(component.custom_id, `${EVALUATION_REMINDER_SHEETS_PREFIX}:2026-09-22:0`);
});

test('ボタンを押した上級判定官には上級リンクだけを本人向けに返す', async t => {
  process.env.GUILD_ID = 'guild';
  const row = {
    pages: [{ content: 'notice', users: ['111'], roles: [], sheetLinks: {
      '111': { upper: 'upper-thread', middle: 'middle-thread', lower: 'lower-thread', beginner: 'beginner-thread' },
    } }],
    message_ids: ['message'], completed: 1,
  };
  const connection = { execute: async () => [[row]], release: () => {} };
  t.mock.method(DbService, 'getConnection', async () => connection);
  const replies = [];
  await service.showSheetLinks({
    customId: `${EVALUATION_REMINDER_SHEETS_PREFIX}:2026-09-22:0`,
    guildId: 'guild', channelId: TEXT_CHANNEL_IDS.EVALUATION_DEADLINE_NOTICE_THREAD,
    guild: { members: { fetch: async () => ({ roles: { cache: new Collection([[ROLE_IDS.EVALUATION_1KYUU, {}]]) } }) } },
    user: { id: 'judge' }, message: { id: 'message' },
    editReply: async payload => replies.push(payload), followUp: async payload => replies.push(payload),
  });
  assert.equal(replies.length, 1);
  assert.match(replies[0].content, /上級評価シート/);
  assert.match(replies[0].content, /<#upper-thread>/);
  assert.doesNotMatch(replies[0].content, /middle-thread|lower-thread|beginner-thread/);
  assert.deepEqual(replies[0].allowedMentions, { parse: [] });
});

test('評価シート表示ボタンは口座確認より先に専用処理へ渡す', async t => {
  const handled = t.mock.method(service, 'showSheetLinks', async () => {});
  await handlePanelButton({ customId: `${EVALUATION_REMINDER_SHEETS_PREFIX}:2026-09-22:0`, user: { id: 'judge' } });
  assert.equal(handled.mock.callCount(), 1);
});

test('当日分の送信前にDBへ保存された前日分を削除する', async t => {
  const previousPages = [{ content: 'previous notice', users: ['333'], roles: [] }];
  const f = deliveryFixture(t, { previousRow: { pages: previousPages } });
  const cleanup = t.mock.method(service, 'deletePreviousReminderMessages', async () => 1);
  await f.run();
  assert.equal(cleanup.mock.callCount(), 1);
  assert.equal(cleanup.mock.calls[0].arguments[1], '2026-09-22');
  assert.deepEqual(cleanup.mock.calls[0].arguments[2], previousPages);
  assert.equal(f.state().sends, 1);
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
