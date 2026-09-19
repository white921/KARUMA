const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { TicketExchangeService } = require('../dist/service/inventory/ticketExchangeService');
const { TICKET_EXCHANGE_RATES } = require('../dist/constant/inventory/ticketExchange');
const { BOT_ID } = require('../dist/constant/shared/id');

// 専用のローカルMySQLソケットに限定し、テストごとの一時DBを作成・削除する。
test('チケット換金 MySQLトランザクション統合テスト', { skip: !process.env.TICKET_EXCHANGE_TEST_SOCKET }, async t => {
  const database = `ticket_exchange_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.TICKET_EXCHANGE_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 4 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  for (const name of ['accounts', 'actions', 'items', 'item_users', 'ticket_exchange_requests']) {
    const sql = ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?;`))[0];
    await pool.query(sql);
  }
  // マイグレーション再適用も成功すること。
  await pool.query(fs.readFileSync('src/sql/20260919_ticket_exchange.sql', 'utf8'));
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  const key = TICKET_EXCHANGE_RATES[0].itemKey;
  let sequence = 0;
  async function reset(quantity = 20, wallet = 1000) {
    for (const table of ['ticket_exchange_requests', 'actions', 'item_users', 'items', 'accounts']) await pool.query(`DELETE FROM ${table}`);
    await pool.execute('INSERT INTO accounts (user_id,user_name,wallet) VALUES (?,?,?), (?,?,?), (?,?,?)', ['1001', 'test', wallet, BOT_ID, 'bot', 12345, '1002', 'other', 0]);
    for (const rate of TICKET_EXCHANGE_RATES) {
      const [item] = await pool.execute('INSERT INTO items(item_key,name) VALUES (?,?)', [rate.itemKey, rate.label]);
      await pool.execute('INSERT INTO item_users(user_id,item_id,quantity) VALUES (?,?,?)', ['1001', item.insertId, quantity]);
    }
  }
  async function request(itemKey = key, quantity = 5) {
    const id = String(1234567890123456789n + BigInt(++sequence));
    await TicketExchangeService.createRequest(id, '1001', itemKey, quantity);
    return id;
  }
  async function state(itemKey = key) {
    const [[a]] = await pool.query("SELECT wallet FROM accounts WHERE user_id = '1001'");
    const [[i]] = await pool.execute("SELECT quantity FROM item_users JOIN items ON items.id=item_users.item_id WHERE user_id='1001' AND item_key=?", [itemKey]);
    const [[logs]] = await pool.query('SELECT COUNT(*) AS n FROM actions');
    return { wallet: Number(a.wallet), quantity: Number(i.quantity), logs: Number(logs.n) };
  }
  await t.test('全券種の10枚換金・残数・入金・取引履歴を同時に保存する', async () => {
    for (const rate of TICKET_EXCHANGE_RATES) {
      await reset(13);
      const result = await TicketExchangeService.redeem(await request(rate.itemKey, 10), '1001');
      assert.deepEqual(await state(rate.itemKey), { wallet: 1000 + rate.unitPrice * 10, quantity: 3, logs: 1 });
      assert.equal(result.afterQuantity, 3);
      const [[bot]] = await pool.execute('SELECT wallet FROM accounts WHERE user_id=?', [BOT_ID]);
      assert.equal(Number(bot.wallet), 12345);
    }
  });
  await t.test('同じ確認を同時に2回実行しても一度だけ換金する', async () => {
    await reset();
    const id = await request();
    const result = await Promise.all([TicketExchangeService.redeem(id, '1001'), TicketExchangeService.redeem(id, '1001')]);
    assert.equal(result.filter(r => r.alreadyCompleted).length, 1);
    assert.deepEqual(await state(), { wallet: 16000, quantity: 15, logs: 1 });
  });
  await t.test('残り5枚に別の確認が競合した場合、片方だけが成功する', async () => {
    await reset(5);
    const ids = [await request(), await request()];
    const result = await Promise.allSettled(ids.map(id => TicketExchangeService.redeem(id, '1001')));
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
    assert.deepEqual(await state(), { wallet: 16000, quantity: 0, logs: 1 });
  });
  await t.test('別ユーザー・キャンセル・期限切れ・凍結・残高上限では変更しない', async () => {
    for (const scenario of ['owner', 'cancel', 'expired', 'frozen', 'overflow']) {
      await reset(20, scenario === 'overflow' ? 2147483640 : 1000);
      const id = await request();
      if (scenario === 'cancel') await TicketExchangeService.cancel(id, '1001');
      if (scenario === 'expired') await pool.execute('UPDATE ticket_exchange_requests SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE request_id=?', [id]);
      if (scenario === 'frozen') await pool.query("UPDATE accounts SET is_frozen=1 WHERE user_id='1001'");
      const before = await state();
      await assert.rejects(TicketExchangeService.redeem(id, scenario === 'owner' ? '1002' : '1001'));
      assert.deepEqual(await state(), before);
    }
  });
  await t.test('履歴保存が失敗したら、チケット消費と入金もロールバックする', async () => {
    await reset();
    const id = await request();
    await pool.query("CREATE TRIGGER fail_exchange_action BEFORE INSERT ON actions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test failure'");
    await assert.rejects(TicketExchangeService.redeem(id, '1001'), /test failure/);
    assert.deepEqual(await state(), { wallet: 1000, quantity: 20, logs: 0 });
    const [[r]] = await pool.execute('SELECT status FROM ticket_exchange_requests WHERE request_id=?', [id]);
    assert.equal(r.status, 'pending');
    await pool.query('DROP TRIGGER fail_exchange_action');
    await TicketExchangeService.redeem(id, '1001');
    assert.deepEqual(await state(), { wallet: 16000, quantity: 15, logs: 1 });
  });
  await t.test('所持数不足・不正な券種・5枚単位以外は確認作成を拒否する', async () => {
    await reset(4);
    await assert.rejects(request(), /不足/);
    await assert.rejects(request('bad'), /換金できない/);
    for (const q of [0, -5, 6, 5.5, Infinity, 100005]) await assert.rejects(request(key, q));
    const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM ticket_exchange_requests');
    assert.equal(Number(r.n), 0);
  });
});
