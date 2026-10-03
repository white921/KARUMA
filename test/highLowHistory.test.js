const test = require('node:test');
const assert = require('node:assert/strict');
const { dailyReportAction, dailyReportText, withoutIndividualHighLow, utcDayBounds, latestReportDay, parseDailyReport } = require('../dist/service/currency/highLowDailyReport');
const { HighLowDailyService } = require('../dist/service/currency/highLowDailyService');
const { HistoryService } = require('../dist/service/currency/historyService');
const { DbService } = require('../dist/service/system/dbService');
const { AccountService } = require('../dist/service/account/accountService');
const { emptyHistoryFilters } = require('../dist/service/currency/historyFilter');
const user = '123456789012345678', game = '1552246348756025344', other = '223456789012345678';
const report = (patch = {}) => ({ id: '1', day: '2026-10-02', userId: user, wager: 20000, payout: 23200, net: 3200, ...patch });
const raw = (id, type = 'transfer') => ({ id, command_name: type, amount: 100, from_user_id: user,
  to_user_id: other, from_after_wallet: 1000, to_after_wallet: 1100, comment: '', created_at: new Date('2026-10-02T12:00:00Z') });

test('01:00 JST cutoff and calendar day bounds are independent of machine timezone', () => {
  assert.equal(latestReportDay(new Date('2026-10-02T15:59:59.999Z')), '2026-10-01');
  assert.equal(latestReportDay(new Date('2026-10-02T16:00:00.000Z')), '2026-10-02');
  assert.equal(latestReportDay(new Date('2026-12-31T16:00:00.000Z')), '2026-12-31');
  const day = utcDayBounds('2026-10-02');
  assert.equal(day.start, '2026-10-01 15:00:00'); assert.equal(day.end, '2026-10-02 15:00:00');
  assert.equal(day.nextDay, '2026-10-03');
  assert.equal(utcDayBounds('2028-02-29').nextDay, '2028-03-01');
  for (const invalid of ['2026-02-29', '2026-13-01', 'not-a-date']) assert.throws(() => utcDayBounds(invalid));
});

test('daily totals have exact signs, reject corrupt amounts and preserve zero days', () => {
  assert.match(dailyReportText(report()), /残高増減：\+3,200 LIA/);
  assert.match(dailyReportText(report({ wager: 100, payout: 0, net: -100 })), /残高増減：-100 LIA/);
  assert.match(dailyReportText(report({ wager: 100, payout: 100, net: 0 })), /残高増減：0 LIA/);
  const db = { id: '1', day: '2026-10-02', user_id: user, wager_total: '3000000000', payout_total: '3000000001', net_amount: '1' };
  assert.equal(parseDailyReport(db).net, 1);
  assert.throws(() => parseDailyReport({ ...db, net_amount: 2 }));
  assert.throws(() => parseDailyReport({ ...db, wager_total: '9007199254740993' }));
});

test('only daily high-low rows remain visible and income/expense works on net', () => {
  const rows = [raw(1, 'high_low_bet'), raw(2, 'high_low_payout'), raw(3), dailyReportAction(report()),
    dailyReportAction(report({ id: '2', day: '2026-10-01', wager: 100, payout: 0, net: -100 })),
    dailyReportAction(report({ id: '3', day: '2026-09-30', wager: 100, payout: 100, net: 0 }))];
  const visible = withoutIndividualHighLow(rows);
  assert.equal(visible.length, 4);
  const filters = patch => ({ ...emptyHistoryFilters(), ...patch });
  assert.equal(HistoryService.filterActions(visible, user, filters({ direction: 'income' })).length, 1);
  assert.equal(HistoryService.filterActions(visible, user, filters({ direction: 'expense' })).length, 2);
  const text = HistoryService.createHistoryString(visible[1], user);
  assert.match(text, /2026\/10\/02 ハイ＆ロー収支/);
  assert.match(text, /賭け金合計：20,000 LIA/);
  assert.doesNotMatch(text, /残高:|暫定|詳細|利用中/);
  assert.equal(HistoryService.createHistoryString(visible[1], other), null);
});

test('daily summary is positioned on its report day, keeping other history chronological', () => {
  const ordinary = raw(99), newer = { ...raw(100), created_at: new Date('2026-10-03T01:00:00Z') };
  const daily = dailyReportAction(report());
  assert.deepEqual(HistoryService.filterActions([ordinary, newer, daily], user).map(a => a.id), [100, 0, 99]);
});

test('history adds no detail switch and never shows raw game rows even from legacy callers', async t => {
  t.mock.method(AccountService, 'hasAccount', async () => true);
  t.mock.method(HistoryService, 'getActionsByUserId', async () => [raw(1), raw(2, 'high_low_bet'), raw(3, 'high_low_payout'), dailyReportAction(report())]);
  const interaction = { user: { id: user }, async editReply(payload) { this.payload = payload; } };
  await HistoryService.viewHistory(interaction);
  assert.match(interaction.payload.embeds[0].data.description, /該当2件/);
  const controls = interaction.payload.components.flatMap(row => row.toJSON().components);
  assert.ok(!controls.some(control => /明細|まとめる|詳細/.test(control.label ?? '')));
  assert.equal(interaction.payload.components[3].components.length, 3);
});

test('DB history excludes financial game rows, appends reports and handles missing migration without a raw fallback', async t => {
  let released = 0;
  const connection = { async execute(sql, args) {
    assert.match(sql, /NOT IN \('high_low_bet', 'high_low_payout'\)/);
    assert.deepEqual(args, [user, user]); return [[raw(1)]];
  }, release() { released++; } };
  t.mock.method(DbService, 'getConnection', async () => connection);
  const reader = t.mock.method(HighLowDailyService, 'readHistory', async (c, id) => {
    assert.equal(c, connection); assert.equal(id, user); return [report()];
  });
  assert.equal((await HistoryService.getActionsByUserId(user)).length, 2);
  reader.mock.mockImplementation(async () => { throw { code: 'ER_NO_SUCH_TABLE' }; });
  assert.deepEqual(await HistoryService.getActionsByUserId(user), [raw(1)]);
  reader.mock.mockImplementation(async () => { throw { code: 'ECONNRESET' }; });
  await assert.rejects(HistoryService.getActionsByUserId(user), { code: 'ECONNRESET' });
  assert.equal(released, 3);
});

test('scheduler is single-flight, catches failures and has an explicit work bound', async t => {
  let finish;
  let days = 0;
  t.mock.method(HighLowDailyService, 'disablePendingDeliveries', async () => {});
  t.mock.method(HighLowDailyService, 'aggregateNextDay', async () => { days++; return days === 1 ? new Promise(resolve => { finish = resolve; }) : true; });
  const first = HighLowDailyService.runScheduled(new Date('2026-10-02T16:00:00Z'));
  assert.equal(HighLowDailyService.runScheduled(), first);
  await new Promise(resolve => setImmediate(resolve));
  finish(true); await first;
  assert.equal(days, 31);
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  HighLowDailyService.aggregateNextDay = async () => { throw { code: 'ER_NO_SUCH_TABLE' }; };
  await HighLowDailyService.runScheduled(); await HighLowDailyService.runScheduled();
  assert.equal(warnings.length, 1);
});
