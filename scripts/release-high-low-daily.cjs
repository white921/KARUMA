// Production release helper. check/verify are read-only; migrate only adds report tables/state.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'check';
if (!['check', 'migrate', 'verify'].includes(mode)) throw new Error('Expected check|migrate|verify');
const sql = readFileSync(path.join(root, 'src/sql/20261003_high_low_daily_reports.sql'), 'utf8');
const files = ['dist/service/currency/highLowDailyReport.js', 'dist/service/currency/highLowDailyService.js',
  'dist/service/currency/historyService.js', 'dist/handler/system/scheduleHandler.js'];
const hashes = mode === 'verify' ? Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])) : {};

async function remote(mode, sql, hashes) {
  const assert = require('node:assert/strict');
  const { readFileSync } = require('node:fs');
  const { createHash } = require('node:crypto');
  const { DbService } = require('./dist/service/system/dbService');
  const connection = await DbService.getConnection();
  const names = ['levelia_game_high_low_daily_reports', 'levelia_game_high_low_daily_state'];
  try {
    const [[time]] = await connection.query("SELECT UTC_TIMESTAMP() AS utc_now, DATE_FORMAT(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR), '%Y-%m-%d') AS today_jst, @@session.time_zone AS session_timezone");
    const [[ledger]] = await connection.query(`SELECT COUNT(*) AS entries, COUNT(DISTINCT user_id) AS players,
      MIN(created_at) AS first_entry_utc, MAX(created_at) AS last_entry_utc,
      SUM(supply_delta) AS net,
      SUM(supply_delta <> CASE WHEN kind='wager_debit' THEN -amount ELSE amount END) AS inconsistent_entries
      FROM levelia_game_high_low_ledger`);
    assert.equal(Number(ledger.inconsistent_entries), 0);
    if (mode === 'migrate') {
      const [[lock]] = await connection.query("SELECT GET_LOCK('levelia_high_low_daily_migration', 30) AS acquired");
      assert.equal(Number(lock.acquired), 1);
      try {
        const statements = sql.split(';').map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean);
        assert.equal(statements.length, 3);
        assert.match(statements[0], /^CREATE TABLE IF NOT EXISTS levelia_game_high_low_daily_reports/);
        assert.match(statements[1], /^CREATE TABLE IF NOT EXISTS levelia_game_high_low_daily_state/);
        assert.match(statements[2], /^INSERT IGNORE INTO levelia_game_high_low_daily_state/);
        for (const statement of statements) await connection.query(statement);
      } finally { await connection.query("SELECT RELEASE_LOCK('levelia_high_low_daily_migration')"); }
    }
    const [tables] = await connection.execute(`SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?, ?)`, names);
    let state = null, reports = [];
    if (tables.length === 2) {
      const [states] = await connection.query(`SELECT DATE_FORMAT(next_report_date,'%Y-%m-%d') AS next_report_date,
        DATE_FORMAT(notify_from_date,'%Y-%m-%d') AS notify_from_date FROM levelia_game_high_low_daily_state WHERE id=1`);
      state = states[0];
      [reports] = await connection.query(`SELECT DATE_FORMAT(report_date,'%Y-%m-%d') AS day, dm_state,
        COUNT(*) AS recipients, SUM(net_amount) AS net FROM levelia_game_high_low_daily_reports GROUP BY report_date,dm_state ORDER BY report_date`);
    }
    console.log(JSON.stringify({ mode, time, ledger, tables, state, reports }));
    if (mode === 'migrate') { assert.equal(tables.length, 2); assert.ok(state); }
    if (mode !== 'verify') return;
    for (const [file, expected] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), expected, `Deployed file differs: ${file}`);
    }
    assert.equal(tables.length, 2); assert.ok(state);
    const { latestReportDay } = require('./dist/service/currency/highLowDailyReport');
    assert.ok(state.next_report_date > latestReportDay(), 'Startup backfill is not finished');
    const [[mismatch]] = await connection.query(`SELECT COUNT(*) AS count FROM levelia_game_high_low_daily_reports d
      LEFT JOIN (SELECT user_id, DATE(DATE_ADD(created_at,INTERVAL 9 HOUR)) AS day,
        SUM(CASE WHEN kind='wager_debit' THEN amount ELSE 0 END) AS wager,
        SUM(CASE WHEN kind IN ('payout_credit','auto_payout_credit') THEN amount ELSE 0 END) AS payout,
        SUM(supply_delta) AS net FROM levelia_game_high_low_ledger GROUP BY user_id,day) l
      ON l.user_id=d.user_id AND l.day=d.report_date
      WHERE l.user_id IS NULL OR d.wager_total<>l.wager OR d.payout_total<>l.payout OR d.net_amount<>l.net`);
    assert.equal(Number(mismatch.count), 0, 'Daily history does not reconcile with ledger');
    const [[missing]] = await connection.query(`SELECT COUNT(*) AS count FROM
      (SELECT user_id, DATE(DATE_ADD(created_at,INTERVAL 9 HOUR)) AS day
       FROM levelia_game_high_low_ledger GROUP BY user_id,day) l
      LEFT JOIN levelia_game_high_low_daily_reports d ON d.user_id=l.user_id AND d.report_date=l.day
      WHERE l.day < ? AND d.id IS NULL`, [state.next_report_date]);
    assert.equal(Number(missing.count), 0, 'Backfill omitted report recipients');
    const [[sample]] = await connection.query('SELECT user_id FROM levelia_game_high_low_daily_reports ORDER BY id DESC LIMIT 1');
    if (sample) {
      const { HistoryService } = require('./dist/service/currency/historyService');
      const userId = String(sample.user_id);
      const rows = await HistoryService.getActionsByUserId(userId);
      const daily = rows.filter(row => row.highLowDaily);
      assert.ok(daily.length);
      assert.ok(!rows.some(row => ['high_low_bet','high_low_payout'].includes(row.command_name) && !row.highLowDaily));
      const historyText = HistoryService.createHistoryString(daily[0], userId);
      assert.match(historyText, /ハイ＆ロー収支/);
      let payload;
      await HistoryService.viewHistory({ user: { id: userId }, editReply: async result => { payload = result; } });
      assert.equal(payload.components[3].components.length, 3);
      assert.ok(!JSON.stringify(payload.components).includes('個別明細'));
      console.log(JSON.stringify({ deployedHashesMatched: true, ledgerMismatches: 0, missingReports: 0,
        sampleDailyRows: daily.length, historyRenderingVerified: true, detailSwitch: false }));
    } else console.log(JSON.stringify({ deployedHashesMatched: true, ledgerMismatches: 0, missingReports: 0, sampleDailyRows: 0 }));
  } finally { connection.release(); }
}
const source = `(${remote.toString()})(${JSON.stringify(mode)},${JSON.stringify(sql)},${JSON.stringify(hashes)}).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})`;
const encoded = Buffer.from(source).toString('base64');
const result = spawnSync('railway', ['ssh', '--project', 'bb93e2f8-3d5c-4482-a4cc-271322ce0fba',
  '--environment', 'production', '--service', 'karuma-bot', '--',
  `node -e "eval(Buffer.from('${encoded}','base64').toString())"`], { cwd: root, stdio: 'inherit', timeout: 60000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
