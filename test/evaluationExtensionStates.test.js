const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const dayjs = require('dayjs');
const { EvaluationService: service } = require('../dist/service/evaluation/evaluationService');

function makeThread(id, parentId, { archived = false, locked = false, fail, name = '旅人〜 09/24', author = 'bot' } = {}) {
  const calls = [];
  const thread = {
    id, parentId, guildId: 'guild', url: `https://discord.com/channels/guild/${id}`,
    name, archived, locked, archiveTimestamp: 2000, client: { user: { id: 'bot' } }, calls,
    fetch: async () => { calls.push('fetch'); return thread; },
    setArchived: async value => {
      calls.push(`archived:${value}`);
      if (fail === (value ? 'restore' : 'open')) throw new Error(fail);
      thread.archived = value; return thread;
    },
    setName: async value => { calls.push('name'); if (fail === 'name') throw new Error('name'); assert.equal(thread.archived, false); thread.name = value; return thread; },
    send: async payload => { calls.push('send'); if (fail === 'send') throw new Error('send'); assert.equal(thread.archived, false); thread.log = payload; },
  };
  thread.starter = {
    author: { id: author }, content: 'ユーザーID: 123\n終了日: 09/24\n',
    get editable() { return !thread.archived && author === 'bot'; },
    edit: async payload => { calls.push('body'); if (fail === 'body') throw new Error('body'); assert.equal(thread.archived, false); thread.starter.content = payload.content; },
  };
  thread.fetchStarterMessage = async () => { calls.push('starter'); return thread.starter; };
  return thread;
}

test('アクティブ・アーカイブ済み・ロック済みを全ページから集め重複を除く', async () => {
  const active = makeThread('active', 'forum');
  const lockedActive = makeThread('locked-active', 'forum', { locked: true });
  const closed = makeThread('closed', 'forum', { archived: true });
  const lockedClosed = makeThread('locked-closed', 'forum', { archived: true, locked: true });
  lockedClosed.archiveTimestamp = 1000;
  const wrongForum = makeThread('other', 'other-forum');
  const calls = [];
  const forum = { id: 'forum', threads: {
    fetchActive: async () => ({ threads: new Collection([active, lockedActive, wrongForum].map(t => [t.id, t])) }),
    fetchArchived: async options => {
      calls.push(options);
      return options.before
        ? { threads: new Collection([[lockedClosed.id, lockedClosed]]), hasMore: false }
        : { threads: new Collection([[active.id, active], [closed.id, closed]]), hasMore: true };
    },
  } };
  assert.deepEqual((await service.fetchAllEvaluationThreads(forum)).map(t => t.id), ['active', 'locked-active', 'closed', 'locked-closed']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].limit, 100);
  assert.equal(calls[0].type, 'public');
  assert.equal(calls[1].before.getTime(), 2000);
  assert.ok([active, lockedActive, closed, lockedClosed].every(t => !t.calls.length));
});

for (const archived of [false, true]) for (const locked of [false, true]) {
  test(`期限変更後に状態を維持: archived=${archived}, locked=${locked}`, async () => {
    const thread = makeThread('t', 'f', { archived, locked });
    await service.applyEvaluationExtension(thread, '旅人〜 09/25', '09/25', '延長ログ');
    assert.equal(thread.name, '旅人〜 09/25');
    assert.equal(thread.starter.content, 'ユーザーID: 123\n終了日: 09/25\n');
    assert.equal(thread.archived, archived);
    assert.equal(thread.locked, locked);
    assert.deepEqual(thread.log, { content: '延長ログ', allowedMentions: { parse: [] } });
    assert.deepEqual(thread.calls, archived ? ['starter', 'archived:false', 'name', 'body', 'send', 'archived:true'] : ['starter', 'name', 'body', 'send']);
  });
}

for (const fail of ['name', 'body', 'send', 'open']) {
  test(`${fail}失敗時も元のアーカイブとロックを維持する`, async () => {
    const thread = makeThread('t', 'f', { archived: true, locked: true, fail });
    await assert.rejects(service.applyEvaluationExtension(thread, '旅人〜 09/25', '09/25', 'ログ'), new RegExp(fail));
    assert.equal(thread.archived, true);
    assert.equal(thread.locked, true);
    assert.equal(thread.calls.at(-1), 'archived:true');
  });
}

test('元の状態に戻せなかった場合は成功扱いせず、期限更新済みかも報告する', async () => {
  const thread = makeThread('t', 'f', { archived: true, locked: true, fail: 'restore' });
  await assert.rejects(service.applyEvaluationExtension(thread, '旅人〜 09/25', '09/25', 'ログ'), /アーカイブ状態への復帰に失敗/);
  assert.equal(thread.name, '旅人〜 09/25');
  assert.equal(thread.locked, true);
});

test('本文や編集権限の事前確認に失敗した場合、タイトルも状態も変えない', async () => {
  for (const missing of [true, false]) {
    const thread = makeThread('t', 'f', { archived: true, author: missing ? 'bot' : 'human' });
    if (missing) thread.starter.content = '期限なし';
    await assert.rejects(service.applyEvaluationExtension(thread, '旅人〜 09/25', '09/25', 'ログ'));
    assert.equal(thread.name, '旅人〜 09/24');
    assert.deepEqual(thread.calls, ['starter']);
  }
});

test('日付の区切りの表記ゆれと年越しを扱い、不正日付を補正しない', () => {
  const today = dayjs('2026-12-31');
  for (const title of ['名前〜 01/01', '名前～1/1']) {
    assert.equal(service.parseTitleEndDate(title, today).endDate.format('YYYY-MM-DD'), '2027-01-01');
  }
  for (const title of ['名前〜 02/30', '名前〜 13/10', '名前〜 00/01', '名前〜 04/31']) {
    assert.equal(service.parseTitleEndDate(title, today), null);
  }
});

test('4フォーラムで全状態を処理し、全ページ取得完了前には書き込まない', async () => {
  const forums = service.getEvaluationForumIds();
  const all = [];
  const channels = new Map(forums.map((id, i) => {
    const active = makeThread(`a${i}`, id);
    const closed = makeThread(`c${i}`, id, { archived: true, locked: i % 2 === 0 });
    all.push(active, closed);
    let readAll = false;
    const original = active.setName;
    active.setName = async v => { assert.equal(readAll, true); return original(v); };
    return [id, { id, type: ChannelType.GuildForum, threads: {
      fetchActive: async () => ({ threads: new Collection([[active.id, active]]) }),
      fetchArchived: async () => { readAll = true; return { threads: new Collection([[closed.id, closed]]), hasMore: false }; },
    } }];
  }));
  const result = await service.extendAllEvaluationSheets({ channels: { fetch: async id => channels.get(id) } }, -1, '担当者');
  assert.equal(result.extendedCount, 8);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.skipped, []);
  assert.ok(all.every(t => t.name === '旅人〜 09/23'));
});

test('アーカイブの取得途中で失敗したフォーラムは部分更新しない', async t => {
  const active = makeThread('t', 'forum');
  t.mock.method(service, 'getEvaluationForumIds', () => ['forum']);
  const client = { channels: { fetch: async () => ({ id: 'forum', type: ChannelType.GuildForum, threads: {
    fetchActive: async () => ({ threads: new Collection([[active.id, active]]) }),
    fetchArchived: async () => { throw new Error('archive API failed'); },
  } }) } };
  const result = await service.extendAllEvaluationSheets(client, 1, '担当者');
  assert.equal(result.extendedCount, 0);
  assert.equal(result.failed.length, 1);
  assert.deepEqual(active.calls, []);
});

test('ユーザー指定でもアーカイブ済み・全角チルダの対象シートを変更する', async t => {
  t.mock.method(service, 'getEvaluationForumIds', () => ['forum']);
  const target = makeThread('target', 'forum', { archived: true, locked: true, name: '指定者～9/24' });
  const other = makeThread('other', 'forum', { archived: true, name: '他の人〜 09/24' });
  t.mock.method(service, 'fetchAllEvaluationThreads', async () => [target, other]);
  const client = { channels: { fetch: async () => ({ id: 'forum', type: ChannelType.GuildForum }) } };
  const result = await service.extendAllEvaluationSheets(client, 1, '担当者', { targetMember: { displayName: '指定者' } });
  assert.equal(result.extendedCount, 1);
  assert.equal(target.name, '指定者～09/25');
  assert.equal(other.name, '他の人〜 09/24');
  assert.deepEqual(other.calls, []);
});

test('個別指定と全員指定の重複実行を防ぎ、失敗後は実行可能に戻る', async t => {
  const { execute } = require('../dist/command/evaluation/extraExtend');
  const { ROLE_IDS } = require('../dist/constant/shared/id');
  const interaction = targeted => ({
    member: { roles: [ROLE_IDS.EVALUATION_LEADER], displayName: '担当者' },
    guild: { members: { fetch: async () => ({ id: '123', displayName: '旅人' }) } },
    options: { getInteger: () => 1, getUser: () => targeted ? { id: '123' } : null, getString: () => null },
    editReply: async () => {}, client: {},
  });
  let release, started;
  const entered = new Promise(resolve => started = resolve);
  t.mock.method(service, 'extendAllEvaluationSheets', async () => {
    started(); await new Promise(resolve => release = resolve); throw new Error('injected update failure');
  });
  const first = execute(interaction(true));
  const rejection = assert.rejects(first, /injected update failure/);
  await entered;
  await assert.rejects(execute(interaction(false)), /現在実行中/);
  await assert.rejects(execute(interaction(true)), /現在実行中/);
  release(); await rejection;
  service.extendAllEvaluationSheets.mock.mockImplementation(async () => ({ extendedCount: 4, skipped: [], failed: [] }));
  await execute(interaction(false));
});
