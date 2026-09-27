const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const mysql = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { CastPaymentService } = require('../dist/service/cast/castPaymentService');
const { ItemService } = require('../dist/service/inventory/itemService');
const { ITEM_KEY } = require('../dist/constant/inventory/item');
const { BOT_ID } = require('../dist/constant/shared/id');

test('ツーショ初回無料券 MySQL統合テスト', { skip: !process.env.CAST_TICKET_TEST_SOCKET }, async t => {
  const database = `cast_ticket_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.CAST_TICKET_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 5 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  for (const table of ['accounts', 'items', 'item_users', 'cast_payments', 'actions']) {
    await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`))[0]);
  }
  for (let n = 0; n < 2; n++) await pool.query(fs.readFileSync('src/sql/20260927_cast_first_ticket.sql', 'utf8'));
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  const session = () => ({ id: randomUUID(), userId: '1001', menu: 'twoshot', castIds: ['1002'], hours: 0.5, amount: 0, option: '', useTicket: true });
  async function reset(quantity = 1) {
    for (const table of ['cast_payments', 'actions', 'item_users', 'accounts']) await pool.query(`DELETE FROM ${table}`);
    await pool.execute("INSERT INTO accounts(user_id,user_name,wallet) VALUES (1001,'payer',0), (?,'bot',100)", [BOT_ID]);
    const conn = await pool.getConnection();
    try { await ItemService.grant(conn, '1001', ITEM_KEY.CAST_TWOSHOT_FIRST_FREE, quantity); } finally { conn.release(); }
  }
  async function state() {
    const [payments] = await pool.query('SELECT id, hours, amount, option_text FROM cast_payments ORDER BY id');
    const [accounts] = await pool.query('SELECT user_id,wallet FROM accounts ORDER BY user_id');
    const [[actions]] = await pool.query('SELECT COUNT(*) AS n FROM actions');
    return { quantity: (await ItemService.getQuantities('1001', [ITEM_KEY.CAST_TWOSHOT_FIRST_FREE])).get(ITEM_KEY.CAST_TWOSHOT_FIRST_FREE) ?? 0, payments, accounts, actions: Number(actions.n) };
  }
  await t.test('0LIAでも30分利用でき、チケットだけ減らして利用履歴を保存する', async () => {
    await reset(); const before = await state();
    assert.equal(await CastPaymentService.transfer(session()), true);
    const after = await state();
    assert.equal(after.quantity, 0); assert.deepEqual(after.accounts, before.accounts); assert.equal(after.actions, 0);
    assert.equal(Number(after.payments[0].hours), 0.5); assert.equal(after.payments[0].amount, 0);
    assert.match(after.payments[0].option_text, /初回無料チケット使用/);
  });
  await t.test('同じ決済を並行再送しても1枚だけ消費する', async () => {
    await reset(2); const s = session();
    assert.deepEqual(await Promise.all([CastPaymentService.transfer(s), CastPaymentService.transfer(s)]), [true, false]);
    assert.equal((await state()).quantity, 1); assert.equal((await state()).payments.length, 1);
  });
  await t.test('別画面から最後の1枚を並行利用すると1件だけ成功する', async () => {
    await reset();
    const results = await Promise.allSettled([CastPaymentService.transfer(session()), CastPaymentService.transfer(session())]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.match(results.find(r => r.status === 'rejected').reason.message, /所持していません/);
    assert.equal((await state()).quantity, 0); assert.equal((await state()).payments.length, 1);
  });
  await t.test('確認後の所持数減少・口座凍結・不正時間では利用しない', async () => {
    for (const scenario of ['empty', 'frozen', 'duration']) {
      await reset(scenario === 'empty' ? 0 : 1); const s = session();
      if (scenario === 'frozen') await pool.query('UPDATE accounts SET is_frozen=1 WHERE user_id=1001');
      if (scenario === 'duration') s.hours = 1;
      const before = await state(); await assert.rejects(CastPaymentService.transfer(s));
      assert.deepEqual(await state(), before);
    }
  });
  await t.test('履歴保存失敗時はチケットを戻し、再実行できる', async () => {
    await reset(); const s = session(); const before = await state();
    await pool.query("CREATE TRIGGER reject_cast BEFORE INSERT ON cast_payments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rejection'");
    try { await assert.rejects(CastPaymentService.transfer(s), /test rejection/); assert.deepEqual(await state(), before); }
    finally { await pool.query('DROP TRIGGER reject_cast'); }
    assert.equal(await CastPaymentService.transfer(s), true);
  });
});
