const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { TicketGrantService: service } = require('../dist/service/inventory/ticketGrantService');
const { ITEM_DEFINITIONS } = require('../dist/constant/inventory/item');
const { MAX_TICKET_QUANTITY: MAX } = require('../dist/constant/inventory/ticketGrant');

test('チケット付与 MySQL統合テスト', { skip: !process.env.TICKET_GRANT_TEST_SOCKET }, async t => {
  const database = `ticket_grant_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.TICKET_GRANT_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 5 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  for (const table of ['accounts', 'sub_accounts', 'items', 'item_users', 'ticket_grants']) {
    await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`))[0]);
  }
  for (let n = 0; n < 2; n++) await pool.query(fs.readFileSync('src/sql/20260927_ticket_grants.sql', 'utf8'));
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  await pool.query("INSERT INTO accounts(user_id,user_name,wallet) VALUES (1001,'target',500), (1002,'operator',600)");
  for (const item of ITEM_DEFINITIONS) await pool.execute('INSERT INTO items(item_key,name) VALUES (?,?)', [item.key, item.name]);
  const key = ITEM_DEFINITIONS[0].key;
  async function state() {
    const [items] = await pool.query('SELECT item_key,quantity FROM item_users JOIN items ON items.id=item_users.item_id ORDER BY item_key');
    const [[log]] = await pool.query('SELECT COUNT(*) n FROM ticket_grants');
    const [accounts] = await pool.query('SELECT wallet FROM accounts ORDER BY user_id');
    return { items, logs: Number(log.n), accounts };
  }
  await t.test('8種類を付与し、残高を変えず操作者・理由・付与後所持数を記録する', async () => {
    for (const [n, item] of ITEM_DEFINITIONS.entries()) assert.equal(await service.grant(`grant-${n}`, '1001', item.key, 2, '1002', '景品'), 2);
    const result = await state(); assert.equal(result.logs, 8); assert.ok(result.items.every(row => row.quantity === 2));
    assert.deepEqual(result.accounts.map(r => r.wallet), [500, 600]);
    const [[row]] = await pool.query("SELECT * FROM ticket_grants WHERE operation_id='grant-0'");
    assert.equal(String(row.operator_user_id), '1002'); assert.equal(row.reason, '景品'); assert.equal(row.quantity_after, 2);
  });
  await t.test('同じ操作の同時再送でも付与は1回だけ', async () => {
    assert.deepEqual(await Promise.all([service.grant('duplicate', '1001', key, 3, '1002', '再送'), service.grant('duplicate', '1001', key, 3, '1002', '再送')]), [5, 5]);
    const [[row]] = await pool.query("SELECT COUNT(*) n FROM ticket_grants WHERE operation_id='duplicate'"); assert.equal(Number(row.n), 1);
    const before = await state();
    await assert.rejects(service.grant('duplicate', '1001', key, 4, '1002', '再送'), /操作ID/);
    await assert.rejects(service.grant('duplicate', '1001', key, 3, '1002', '別理由'), /操作ID/);
    assert.deepEqual(await state(), before);
  });
  await t.test('別の操作が同時に付与されても加算を失わない', async () => {
    const results = await Promise.all([service.grant('parallel-1', '1001', key, 1, '1002', '並行'), service.grant('parallel-2', '1001', key, 1, '1002', '並行')]);
    assert.deepEqual(results.sort((a, b) => a - b), [6, 7]);
  });
  await t.test('口座なし・不正種類・不正枚数・上限超過・空理由は副作用なく拒否', async () => {
    const before = await state();
    for (const amount of [0, -1, 1.5, MAX + 1]) await assert.rejects(service.grant('invalid', '1001', key, amount, '1002', 'test'));
    await assert.rejects(service.grant('missing', '9999', key, 1, '1002', 'test'), /口座/);
    await assert.rejects(service.grant('bad-key', '1001', 'NO_SUCH_TICKET', 1, '1002', 'test'), /種類/);
    await assert.rejects(service.grant('overflow', '1001', key, MAX, '1002', 'test'), /上限/);
    await assert.rejects(service.grant('reason', '1001', key, 1, '1002', '  '), /理由/);
    assert.deepEqual(await state(), before);
  });
  await t.test('DB上のサブ垢も付与対象外', async () => {
    await pool.query('INSERT INTO sub_accounts(main_user_id,sub_user_id) VALUES (1002,1001)');
    const before = await state();
    await assert.rejects(service.grant('sub', '1001', key, 1, '1002', 'test'), /サブ垢/);
    assert.deepEqual(await state(), before);
    await pool.query('DELETE FROM sub_accounts');
  });
  await t.test('履歴保存に失敗したら在庫付与もロールバック', async () => {
    const before = await state();
    t.mock.method(DbService, 'getConnection', async () => {
      const connection = await pool.getConnection(); const execute = connection.execute.bind(connection);
      connection.execute = async (sql, args) => { if (sql.includes('INSERT INTO ticket_grants')) throw new Error('log failed'); return execute(sql, args); };
      const release = connection.release.bind(connection); connection.release = () => { connection.execute = execute; release(); };
      return connection;
    });
    await assert.rejects(service.grant('rollback', '1001', key, 10, '1002', 'test'), /log failed/);
    assert.deepEqual(await state(), before);
  });
});
