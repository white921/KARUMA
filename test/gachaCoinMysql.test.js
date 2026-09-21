const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { DbService } = require('../dist/service/system/dbService');
const { GachaCoinService: service } = require('../dist/service/market/gachaCoinService');
const { GACHA_COIN_REWARDS: rewards, GACHA_COIN_MAX } = require('../dist/constant/market/gachaCoin');

test('ガチャコイン MySQL統合テスト', { skip: !process.env.GACHA_COIN_TEST_SOCKET }, async t => {
  const database = `gacha_coin_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.GACHA_COIN_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 5 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  for (const table of ['accounts', 'items', 'item_users', 'gacha_coin_balances', 'gacha_coin_transactions', 'gacha_coin_exchange_requests']) {
    await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?;`))[0]);
  }
  for (let i = 0; i < 2; i++) for (const sql of fs.readFileSync('src/sql/20260921_gacha_coins.sql', 'utf8').split(';').filter(s => s.trim())) await pool.query(sql);
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  let sequence = 0;
  const id = () => String(123456789012345678n + BigInt(++sequence));
  async function reset(coins = 100) {
    for (const table of ['gacha_coin_transactions', 'gacha_coin_exchange_requests', 'gacha_coin_balances', 'item_users', 'items', 'accounts']) await pool.query(`DELETE FROM ${table}`);
    await pool.query("INSERT INTO accounts(user_id,user_name,wallet) VALUES (1001,'test',999), (1002,'other',888)");
    for (const reward of rewards) await pool.execute('INSERT INTO items(item_key,name) VALUES (?,?)', [reward.itemKey, reward.label]);
    if (coins) await service.adjust(id(), '1001', coins, '1002', 'test');
  }
  async function state() {
    const [items] = await pool.query('SELECT item_key,quantity FROM item_users JOIN items ON items.id=item_users.item_id WHERE user_id=1001 ORDER BY item_key');
    const [[log]] = await pool.query('SELECT COUNT(*) AS n FROM gacha_coin_transactions');
    const [[account]] = await pool.query('SELECT wallet FROM accounts WHERE user_id=1001');
    return { coins: await service.getBalance('1001'), items: items.map(r => ({ key: r.item_key, quantity: Number(r.quantity) })), logs: Number(log.n), wallet: Number(account.wallet) };
  }
  await t.test('残高未作成は0枚、付与・減算と履歴が保存される', async () => {
    await reset(0);
    assert.equal(await service.getBalance('1001'), 0);
    assert.equal(await service.adjust(id(), '1001', 30, '1002', 'grant'), 30);
    assert.equal(await service.adjust(id(), '1001', -10, '1002', 'deduct'), 20);
    const [[row]] = await pool.query("SELECT * FROM gacha_coin_transactions WHERE transaction_type='deduct'");
    assert.equal(row.reason, 'deduct'); assert.equal(String(row.operator_user_id), '1002');
    assert.equal((await state()).wallet, 999);
  });
  await t.test('同じ付与の並行再送は1回だけ加算する', async () => {
    await reset(0); const operation = id();
    assert.deepEqual(await Promise.all([service.adjust(operation, '1001', 50, '1002', ''), service.adjust(operation, '1001', 50, '1002', '')]), [50, 50]);
    assert.equal((await state()).logs, 1);
  });
  await t.test('3券種を正しいレートで付与し、確認だけでは残高を消費しない', async () => {
    for (const reward of rewards) {
      await reset(); const request = id(); const before = await state();
      await service.createRequest(request, '1001', reward.key);
      assert.deepEqual(await state(), before);
      await service.redeem(request, '1001');
      assert.deepEqual(await state(), { coins: 100 - reward.cost, items: [{ key: reward.itemKey, quantity: 1 }], logs: 2, wallet: 999 });
    }
  });
  await t.test('同じ交換の並行確定は1回だけ消費・付与する', async () => {
    await reset(); const request = id(); await service.createRequest(request, '1001', 'game');
    const result = await Promise.all([service.redeem(request, '1001'), service.redeem(request, '1001')]);
    assert.equal(result.filter(r => r.alreadyCompleted).length, 1);
    assert.equal((await state()).coins, 90); assert.equal((await state()).items[0].quantity, 1);
  });
  await t.test('残り10枚に別の交換が競合すると片方だけ成功する', async () => {
    await reset(10); const ids = [id(), id()];
    for (const request of ids) await service.createRequest(request, '1001', 'game');
    const result = await Promise.allSettled(ids.map(request => service.redeem(request, '1001')));
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await state()).coins, 0);
  });
  await t.test('減算と交換の競合でも残高は負にならない', async () => {
    await reset(10); const request = id(); await service.createRequest(request, '1001', 'game');
    const result = await Promise.allSettled([service.redeem(request, '1001'), service.adjust(id(), '1001', -10, '1002', '')]);
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await state()).coins, 0);
  });
  await t.test('他人の確認・取消・期限切れ・凍結・不足を拒否し資産を変更しない', async () => {
    for (const scenario of ['owner', 'cancel', 'expired', 'frozen', 'insufficient']) {
      await reset(); const request = id(); await service.createRequest(request, '1001', 'game');
      if (scenario === 'cancel') await service.cancel(request, '1001');
      if (scenario === 'expired') await pool.execute('UPDATE gacha_coin_exchange_requests SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE request_id=?', [request]);
      if (scenario === 'frozen') await pool.query('UPDATE accounts SET is_frozen=1 WHERE user_id=1001');
      if (scenario === 'insufficient') await service.adjust(id(), '1001', -100, '1002', '');
      const before = await state();
      await assert.rejects(service.redeem(request, scenario === 'owner' ? '1002' : '1001'));
      assert.deepEqual(await state(), before);
    }
  });
  await t.test('他人のキャンセルは拒否、交換済みの取消でも変更しない', async () => {
    await reset(); const request = id(); await service.createRequest(request, '1001', 'game');
    await assert.rejects(service.cancel(request, '1002'));
    await service.redeem(request, '1001'); const before = await state();
    await assert.rejects(service.cancel(request, '1001')); assert.deepEqual(await state(), before);
  });
  await t.test('口座なし・残高不足・上限超過・不正商品を拒否', async () => {
    await reset(0);
    await assert.rejects(service.adjust(id(), '9999', 1, '1002', ''), /口座/);
    await assert.rejects(service.adjust(id(), '1001', -1, '1002', ''), /不足/);
    await assert.rejects(service.createRequest(id(), '1001', 'game'), /不足/);
    await assert.rejects(service.createRequest(id(), '1001', 'invalid'), /不正/);
    await service.adjust(id(), '1001', GACHA_COIN_MAX, '1002', '');
    await assert.rejects(service.adjust(id(), '1001', 1, '1002', ''), /上限/);
  });
  await t.test('チケット付与エラー時はコイン消費をロールバックする', async () => {
    await reset(); const request = id(); await service.createRequest(request, '1001', 'game');
    await pool.execute('DELETE FROM items WHERE item_key=?', [rewards[0].itemKey]); const before = await state();
    await assert.rejects(service.redeem(request, '1001'), /未登録/);
    assert.deepEqual(await state(), before);
  });
  await t.test('履歴保存エラー時はコイン・チケット・確認状態を全て戻す', async () => {
    await reset(); const request = id(); await service.createRequest(request, '1001', 'game');
    await pool.query("CREATE TRIGGER reject_coin_log BEFORE INSERT ON gacha_coin_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test rejection'");
    const before = await state();
    try {
      await assert.rejects(service.redeem(request, '1001'), /test rejection/);
      assert.deepEqual(await state(), before);
      await assert.rejects(service.adjust(id(), '1001', 1, '1002', ''), /test rejection/);
      assert.deepEqual(await state(), before);
    } finally { await pool.query('DROP TRIGGER reject_coin_log'); }
    assert.equal((await service.redeem(request, '1001')).alreadyCompleted, false);
  });
});
