const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { GachaCoinActivationService: activation } = require('../dist/service/market/gachaCoinActivationService');
const { GachaCoinService } = require('../dist/service/market/gachaCoinService');
const { MarketGachaService } = require('../dist/service/market/marketGachaService');
const { GACHA_COIN_ACTIVATION_EPOCH: boundary } = require('../dist/constant/market/gachaCoinActivation');
const { BOT_ID, ROLE_IDS } = require('../dist/constant/shared/id');
const ayame = '1548643376184823871';

test('ガチャコイン開始日時・過去分付与 MySQL統合テスト', { skip: !process.env.GACHA_COIN_TEST_SOCKET }, async t => {
  const database = `gacha_activation_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.GACHA_COIN_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z' };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 6 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  const tables = ['accounts', 'actions', 'market_gacha_draws', 'market_gacha_daily_locks', 'invite_point_balances', 'invite_point_transactions', 'gacha_coin_balances', 'gacha_coin_transactions', 'gacha_coin_rollouts'];
  for (const table of tables) await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`))[0]);
  for (let i = 0; i < 2; i++) for (const sql of fs.readFileSync('src/sql/20260921_gacha_coin_activation.sql', 'utf8').split(';').filter(s => s.trim())) await pool.query(sql);
  let now = boundary - 1;
  async function connectionAt(epoch = now) {
    const c = await pool.getConnection();
    await c.query('SET time_zone = "+00:00"');
    await c.query('SET timestamp = ?', [epoch]);
    return c;
  }
  t.mock.method(DbService, 'getConnection', () => connectionAt());
  async function reset() {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM ${table}`);
    await pool.execute("INSERT INTO gacha_coin_rollouts(rollout_key,activation_epoch) VALUES ('20260922',?)", [boundary]);
    for (const user of ['1001', '1002', ayame, BOT_ID]) await pool.execute('INSERT INTO accounts(user_id,user_name,wallet) VALUES (?,?,100000)', [user, `test-${user}`]);
    now = boundary - 1;
  }
  async function history(user, count, epoch = boundary - 1) {
    for (let i = 0; i < count; i++) await pool.execute("INSERT INTO market_gacha_draws(user_id,prize_key,prize_name,payment_source,created_at) VALUES (?,'event_proposal','test',?,FROM_UNIXTIME(?))", [user, i % 2 ? 'invite_point' : 'currency', epoch]);
  }
  async function state() {
    const [balances] = await pool.query('SELECT user_id,coins FROM gacha_coin_balances ORDER BY user_id');
    const [logs] = await pool.query('SELECT operation_id,user_id,transaction_type,amount,balance_after FROM gacha_coin_transactions ORDER BY operation_id');
    const [[rollout]] = await pool.query('SELECT status,historical_draw_count,credited_user_count,credited_coin_count FROM gacha_coin_rollouts');
    return { balances: balances.map(r => [String(r.user_id), Number(r.coins)]), logs, rollout };
  }
  async function beginDraw(user, epoch) {
    const c = await connectionAt(epoch);
    await c.beginTransaction();
    await activation.lockDrawGate(c);
    await c.execute('SELECT user_id FROM accounts WHERE user_id=? FOR UPDATE', [user]);
    const [draw] = await c.execute("INSERT INTO market_gacha_draws(user_id,prize_key,prize_name) VALUES (?,'event_proposal','test')", [user]);
    return { c, drawId: draw.insertId };
  }
  await t.test('開始は2026-09-22 00:00 JSTで、直前は付与も完了マークも変わらない', async () => {
    assert.equal(new Date(boundary * 1000).toISOString(), '2026-09-21T15:00:00.000Z');
    await reset(); await history('1001', 3); await history(ayame, 5);
    const before = await state();
    assert.equal((await activation.activateDueHistory()).activated, false);
    assert.deepEqual(await state(), before);
    const { c, drawId } = await beginDraw('1001', boundary - 1);
    assert.equal(await activation.grantForDraw(c, '1001', drawId), undefined);
    await c.commit(); c.release();
    assert.deepEqual(await state(), before);
  });
  await t.test('過去分は両支払方法を集計し、既存残高に加算、綾目の5回は30枚に置換する', async () => {
    await reset(); await history('1001', 3); await history(ayame, 5);
    await GachaCoinService.adjust('manual', '1001', 7, '1002', 'manual');
    await GachaCoinService.adjust('manual-ayame', ayame, 2, '1002', 'manual');
    now = boundary;
    const result = await activation.activateDueHistory();
    assert.deepEqual(result, { activated: true, status: 'completed', historicalDraws: 8, creditedUsers: 2, creditedCoins: 33 });
    assert.equal(await GachaCoinService.getBalance('1001'), 10);
    assert.equal(await GachaCoinService.getBalance(ayame), 32);
    assert.equal(await GachaCoinService.getBalance('1002'), 0);
  });
  await t.test('開始時刻ちょうどの抽選は新規1枚、過去分集計に含まれない', async () => {
    await reset(); await history('1001', 2); await history(ayame, 5);
    const { c, drawId } = await beginDraw('1001', boundary);
    assert.equal(await activation.grantForDraw(c, '1001', drawId), 1);
    assert.equal(await activation.grantForDraw(c, '1001', drawId), 1);
    await c.commit(); c.release();
    now = boundary;
    assert.equal((await activation.activateDueHistory()).historicalDraws, 7);
    assert.equal(await GachaCoinService.getBalance('1001'), 3);
    const before = await state();
    assert.equal((await activation.activateDueHistory()).activated, false);
    assert.deepEqual(await state(), before);
  });
  await t.test('複数の予約処理が同時に起動しても過去分付与は1回だけ', async () => {
    await reset(); await history('1001', 4); now = boundary;
    const results = await Promise.all([activation.activateDueHistory(), activation.activateDueHistory()]);
    assert.equal(results.filter(r => r.activated).length, 1);
    assert.equal(await GachaCoinService.getBalance('1001'), 4);
    assert.equal(await GachaCoinService.getBalance(ayame), 30);
  });
  await t.test('境界前に進行中の抽選が確定するまで過去分集計が待つ', async () => {
    await reset();
    const { c, drawId } = await beginDraw('1001', boundary - 1);
    assert.equal(await activation.grantForDraw(c, '1001', drawId), undefined);
    now = boundary; let finished = false;
    const pending = activation.activateDueHistory().then(r => { finished = true; return r; });
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(finished, false);
    await c.commit(); c.release();
    assert.equal((await pending).historicalDraws, 1);
    assert.equal(await GachaCoinService.getBalance('1001'), 1);
  });
  await t.test('一括付与途中の失敗は全ユーザーをロールバックし、再起動相当の再実行で1回だけ付与', async () => {
    await reset(); await history('1001', 2); await history('1002', 3); await history(ayame, 5);
    now = boundary;
    await pool.query(`CREATE TRIGGER reject_history BEFORE INSERT ON gacha_coin_transactions FOR EACH ROW
      BEGIN IF NEW.transaction_type='history' AND NEW.user_id=1002 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rejection'; END IF; END`);
    const before = await state();
    try { await assert.rejects(activation.activateDueHistory(), /test rejection/); assert.deepEqual(await state(), before); }
    finally { await pool.query('DROP TRIGGER reject_history'); }
    assert.equal((await activation.activateDueHistory()).creditedCoins, 35);
    const after = await state(); await activation.activateDueHistory(); assert.deepEqual(await state(), after);
  });
  await t.test('抽選を取り消すとコインと抽選履歴も同時にロールバックする', async () => {
    await reset(); const { c, drawId } = await beginDraw('1001', boundary);
    await activation.grantForDraw(c, '1001', drawId);
    await c.rollback(); c.release();
    assert.equal(await GachaCoinService.getBalance('1001'), 0);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM market_gacha_draws'))[0][0].n), 0);
  });
  await t.test('綾目の口座がない場合は他ユーザーも付与せず未完了を維持する', async () => {
    await reset(); await history('1001', 2); await pool.execute('DELETE FROM accounts WHERE user_id=?', [ayame]); now = boundary;
    await assert.rejects(activation.activateDueHistory(), /口座がありません/);
    assert.equal(await GachaCoinService.getBalance('1001'), 0);
    assert.equal((await state()).rollout.status, 'pending');
  });
  await t.test('コイン履歴保存に失敗すると本物のガチャ処理の支払い・抽選も全て戻す', async () => {
    await reset(); now = boundary;
    t.mock.method(Math, 'random', () => 0.999);
    t.mock.method(MarketGachaService, 'sendDrawLog', async () => {});
    await pool.query("CREATE TRIGGER reject_draw_coin BEFORE INSERT ON gacha_coin_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='coin log failure'");
    try {
      const interaction = { user: { id: '1001' }, guild: { members: { fetch: async () => ({ roles: { cache: new Set([ROLE_IDS.GIJUTU_LEADER]) } }) } }, editReply: async () => {} };
      await assert.rejects(MarketGachaService.draw(interaction, 'currency'), /coin log failure/);
      assert.equal(await GachaCoinService.getBalance('1001'), 0);
      assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM market_gacha_draws'))[0][0].n), 0);
      const [[user]] = await pool.query('SELECT wallet FROM accounts WHERE user_id=1001');
      const [[bot]] = await pool.execute('SELECT wallet FROM accounts WHERE user_id=?', [BOT_ID]);
      assert.equal(Number(user.wallet), 100000); assert.equal(Number(bot.wallet), 100000);
    } finally { await pool.query('DROP TRIGGER reject_draw_coin'); }
  });
  await t.test('本物のガチャ処理でLIA・招待ポイントともに1回1枚、支払失敗なら付与なし', async () => {
    t.mock.method(Math, 'random', () => 0.999);
    t.mock.method(MarketGachaService, 'sendDrawLog', async () => {});
    for (const paymentSource of ['currency', 'invite_point']) {
      await reset(); now = boundary;
      await pool.query('INSERT INTO invite_point_balances(user_id,points) VALUES (1001,2)');
      const replies = [];
      const interaction = { user: { id: '1001' }, guild: { members: { fetch: async () => ({ roles: { cache: new Set([ROLE_IDS.GIJUTU_LEADER]) } }) } }, editReply: async p => replies.push(p) };
      await MarketGachaService.draw(interaction, paymentSource);
      assert.equal(await GachaCoinService.getBalance('1001'), 1);
      assert.match(replies[0].content, /ガチャコイン：\+1枚／所持：1枚/);
      const [[wallet]] = await pool.query('SELECT wallet FROM accounts WHERE user_id=1001');
      assert.equal(Number(wallet.wallet), paymentSource === 'currency' ? 95000 : 100000);
      await pool.query('UPDATE accounts SET wallet=0 WHERE user_id=1001');
      await pool.query('UPDATE invite_point_balances SET points=0 WHERE user_id=1001');
      await assert.rejects(MarketGachaService.draw(interaction, paymentSource), /不足/);
      assert.equal(await GachaCoinService.getBalance('1001'), 1);
    }
  });
});
