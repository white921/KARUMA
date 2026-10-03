const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createPool } = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { HighLowDailyService } = require('../dist/service/currency/highLowDailyService');
const { HistoryService } = require('../dist/service/currency/historyService');
const { latestReportDay } = require('../dist/service/currency/highLowDailyReport');
const mysqlUrl = process.env.TEST_HIGH_LOW_DAILY_MYSQL_URL;
const users = ['123456789012345678', '223456789012345678', '323456789012345678', '423456789012345678', '523456789012345678'];

test('daily history reconciles with the real ledger without sending DMs or changing money', { skip: !mysqlUrl }, async t => {
  const url = new URL(mysqlUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Disposable local database only');
  assert.match(url.pathname, /^\/levelia_.*test$/);
  const pool = createPool({ uri: mysqlUrl, multipleStatements: true, supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z' });
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const migration = await readFile(path.join(__dirname, '../src/sql/20261003_high_low_daily_reports.sql'), 'utf8');
  try {
    await pool.query(`DROP TABLE IF EXISTS levelia_game_high_low_daily_reports, levelia_game_high_low_daily_state,
      levelia_game_high_low_ledger, levelia_game_high_low_virtual_ledger, accounts, actions;
      CREATE TABLE accounts (user_id BIGINT PRIMARY KEY, wallet INT);
      CREATE TABLE actions (id INT PRIMARY KEY, command_name VARCHAR(32), amount INT, from_user_id BIGINT,
        to_user_id BIGINT, from_after_wallet INT, to_after_wallet INT, comment VARCHAR(255), created_at DATETIME(3));
      CREATE TABLE levelia_game_high_low_ledger (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT,
        kind VARCHAR(24), amount INT, supply_delta INT, created_at DATETIME(3));
      CREATE TABLE levelia_game_high_low_virtual_ledger LIKE levelia_game_high_low_ledger;`);
    for (const user of users) await pool.execute('INSERT INTO accounts VALUES (?, 20000)', [user]);
    const event = async (user, kind, amount, created) => pool.execute(
      'INSERT INTO levelia_game_high_low_ledger (user_id,kind,amount,supply_delta,created_at) VALUES (?,?,?,?,?)',
      [user, kind, amount, kind === 'wager_debit' ? -amount : amount, created]);
    await event(users[0], 'wager_debit', 100, '2026-10-01 14:59:59.999');
    await event(users[0], 'wager_debit', 100, '2026-10-01 15:00:00.000');
    await event(users[0], 'payout_credit', 150, '2026-10-02 14:59:59.999');
    await event(users[0], 'wager_debit', 200, '2026-10-02 15:00:00.000');
    await event(users[0], 'auto_payout_credit', 300, '2026-10-02 15:10:00.000');
    await event(users[1], 'wager_debit', 100, '2026-10-02 10:00:00.000');
    await event(users[1], 'payout_credit', 100, '2026-10-02 10:01:00.000');
    await event(users[2], 'auto_payout_credit', 700, '2026-10-02 11:00:00.000');
    await event(users[3], 'wager_debit', 100, '2026-10-02 11:00:00.000');
    await pool.execute("INSERT INTO levelia_game_high_low_virtual_ledger (user_id,kind,amount,supply_delta,created_at) VALUES (?, 'payout_credit',9999,9999,'2026-10-02 10:00:00')", [users[4]]);
    await pool.execute("INSERT INTO actions VALUES (1,'transfer',500,?,?,19500,20500,'other transfer','2026-10-02 12:00:00'), (2,'high_low_bet',100,?,?,19900,0,'internal only','2026-10-02 13:00:00')", [users[1], users[0], users[0], users[1]]);
    const snapshot = async () => {
      const result = {};
      for (const table of ['accounts', 'actions', 'levelia_game_high_low_ledger', 'levelia_game_high_low_virtual_ledger']) result[table] = (await pool.query(`SELECT * FROM ${table}`))[0];
      return result;
    };
    const moneyBefore = await snapshot();
    await pool.query(migration);
    await pool.query("UPDATE levelia_game_high_low_daily_state SET notify_from_date='2026-10-02' WHERE id=1");
    const state = async () => (await pool.query("SELECT DATE_FORMAT(next_report_date,'%Y-%m-%d') AS day, DATE_FORMAT(notify_from_date,'%Y-%m-%d') AS notify_from FROM levelia_game_high_low_daily_state"))[0][0];
    const reports = async () => (await pool.query("SELECT *, DATE_FORMAT(report_date,'%Y-%m-%d') AS day FROM levelia_game_high_low_daily_reports ORDER BY report_date,user_id"))[0];

    await t.test('before 01:00 only earlier days are backfilled', async () => {
      await HighLowDailyService.runScheduled(new Date('2026-10-02T15:59:59.999Z'));
      const rows = await reports();
      assert.equal(rows.length, 1); assert.equal(rows[0].day, '2026-10-01');
      assert.equal(rows[0].dm_state, 'skipped'); assert.equal(Number(rows[0].net_amount), -100);
      assert.equal((await state()).day, '2026-10-02');
    });
    await t.test('01:00 inclusive day boundary and replica concurrency create one report per user', async () => {
      const cutoff = latestReportDay(new Date('2026-10-02T16:00:00.000Z'));
      const completed = await Promise.all([HighLowDailyService.aggregateNextDay(cutoff), HighLowDailyService.aggregateNextDay(cutoff)]);
      assert.deepEqual(completed.sort(), [false, true]);
      const rows = (await reports()).filter(r => r.day === '2026-10-02');
      assert.equal(rows.length, 4);
      assert.deepEqual(rows.map(r => Number(r.net_amount)), [50, 0, 700, -100]);
      assert.deepEqual(rows.map(r => Number(r.wager_total)), [100, 100, 0, 100]);
      assert.ok(!rows.some(r => String(r.user_id) === users[4]), 'virtual-only activity creates no real report');
      assert.ok(rows.every(r => r.dm_state === 'skipped'));
      const cursor = await state(); await pool.query(migration); assert.deepEqual(await state(), cursor);
    });
    await t.test('legacy pending deliveries are disabled while daily history remains', async () => {
      await pool.query("UPDATE levelia_game_high_low_daily_reports SET dm_state = IF(user_id = ?, 'pending', 'sending') WHERE report_date='2026-10-02'", [users[0]]);
      await HighLowDailyService.runScheduled(new Date('2026-10-02T17:00:00Z'));
      const rows = (await reports()).filter(r => r.day === '2026-10-02');
      assert.ok(rows.every(r => r.dm_state === 'skipped'));
      assert.ok(rows.every(r => r.dm_error === 'dm_disabled'));
    });
    await t.test('history shows one daily result with no individual records', async () => {
      const history = await HistoryService.getActionsByUserId(users[0]);
      assert.equal(history.filter(r => r.highLowDaily).length, 2);
      assert.ok(history.some(r => r.command_name === 'transfer'));
      assert.ok(!history.some(r => r.comment === 'internal only'));
      const loss = await HistoryService.getActionsByUserId(users[3]);
      assert.equal(loss.length, 1); assert.equal(loss[0].highLowDaily.net, -100);
      assert.match(HistoryService.createHistoryString(loss[0], users[3]), /残高増減：-100 LIA/);
    });
    await t.test('aggregation failure rolls back reports and cursor; restart catches up and empty days produce no row', async () => {
      const before = await reports(), cursor = await state();
      await pool.query("CREATE TRIGGER reject_daily BEFORE INSERT ON levelia_game_high_low_daily_reports FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='report rollback'");
      try { await assert.rejects(HighLowDailyService.aggregateNextDay('2026-10-03'), /report rollback/); }
      finally { await pool.query('DROP TRIGGER reject_daily'); }
      assert.deepEqual(await reports(), before); assert.deepEqual(await state(), cursor);
      await HighLowDailyService.aggregateNextDay('2026-10-03');
      const third = (await reports()).find(r => r.day === '2026-10-03');
      assert.equal(Number(third.net_amount), 100);
      assert.equal(Number(third.payout_total), 300);
      await HighLowDailyService.aggregateNextDay('2026-10-04');
      assert.equal((await state()).day, '2026-10-05');
      assert.ok(!(await reports()).some(r => r.day === '2026-10-04'));
    });
    assert.deepEqual(await snapshot(), moneyBefore);
  } finally { await pool.end(); }
});
