const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { ButtonInteraction, ChannelType } = require('discord.js');
const { DbService } = require('../dist/service/system/dbService');
const { AccountService } = require('../dist/service/account/accountService');
const { handlePanelButton } = require('../dist/handler/interaction/panelButtonHandler');
const { shouldDeferButtonUpdate } = require('../dist/util/interaction/interactionAck');
const { PANEL_COMMAND_NAMES: C } = require('../dist/constant/shared/command');
const { BOT_ID, ROLE_IDS: R } = require('../dist/constant/shared/id');
const { TicketViewService } = require('../dist/service/inventory/ticketViewService');

// 実運用DBには接続しない。専用のローカルMySQLソケットで一時DBを作成する。
test('狭間・独房無料券 MySQLトランザクション統合テスト', { skip: !process.env.VC_TICKET_TEST_SOCKET }, async t => {
  const database = `vc_ticket_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.VC_TICKET_TEST_SOCKET, user: 'root', supportBigNumbers: true, bigNumberStrings: true };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 6 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/createTable.sql', 'utf8');
  for (const name of ['accounts', 'actions', 'items', 'item_users', 'vcs', 'role_management_logs']) {
    await pool.query(ddl.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?;`))[0]);
  }
  const migration = fs.readFileSync('src/sql/20260925_vc_free_tickets.sql', 'utf8');
  await pool.query(migration);
  await pool.query(migration);
  const [[count]] = await pool.query('SELECT COUNT(*) n FROM items');
  assert.equal(Number(count.n), 2);
  t.mock.method(DbService, 'getConnection', () => pool.getConnection());
  t.mock.method(AccountService, 'hasAccount', async () => true);
  let roles, failures, channels, deleted, replies, logs;
  let nextChannel = 9000;
  async function reset(tickets = 1, wallet = 10000, roleIds = [R.DETENTION_ROLES.SUMMONED_CRIME]) {
    for (const table of ['actions', 'item_users', 'vcs', 'role_management_logs', 'accounts']) await pool.query(`DELETE FROM ${table}`);
    await pool.execute('INSERT INTO accounts(user_id,user_name,wallet) VALUES (?,?,?),(?,?,?)', ['1001', 'test', wallet, BOT_ID, 'bot', 10000]);
    await pool.execute('INSERT INTO item_users(user_id,item_id,quantity) SELECT ?, id, ? FROM items', ['1001', tickets]);
    roles = new Set(roleIds); failures = {}; channels = []; deleted = []; replies = []; logs = [];
  }
  const member = () => ({ displayName: 'test', roles: {
    cache: roles,
    add: async role => { if (failures.role) throw new Error('role failed'); roles.add(role); },
    remove: async role => { roles.delete(role); },
  }});
  function interaction(customId) {
    return {
      customId, user: { id: '1001' }, guildId: '2001', channelId: '3001', member: member(), deferred: true, replied: false,
      reply: ButtonInteraction.prototype.reply, update: ButtonInteraction.prototype.update,
      editReply: async payload => {
        if (failures.reply && (payload.content?.includes('取得しました') || payload.content?.startsWith('✅'))) throw new Error('reply failed');
        replies.push(payload);
      },
      guild: {
        members: { fetch: async () => member() },
        channels: {
          fetch: async () => ({id: '4001', type: ChannelType.GuildCategory, permissionOverwrites: { cache: { map: () => [] } } }),
          create: async () => {
            if (failures.channel) throw new Error('channel failed');
            const id = String(++nextChannel); channels.push(id);
            return {id, send: async () => {}, delete: async () => { deleted.push(id); }};
          },
        },
      },
      client: { channels: {fetch: async () => ({isTextBased: () => true, send: async p => { logs.push(p); }})} },
    };
  }
  async function show(kind) {
    await handlePanelButton(interaction(kind === 'hazama' ? C.HAZAMA_ACCESS : C.SOLITARY_CELL_CREATE));
    const buttons = replies.at(-1).components[0].toJSON().components;
    assert.equal(shouldDeferButtonUpdate(buttons[1].custom_id), true);
    return { confirm: interaction(buttons[1].custom_id), cancel: interaction(buttons[0].custom_id) };
  }
  async function state(kind) {
    const key = kind === 'hazama' ? 'HAZAMA_FREE' : 'SOLITARY_CELL_FREE';
    const [[a]] = await pool.query("SELECT wallet FROM accounts WHERE user_id='1001'");
    const [[i]] = await pool.execute("SELECT quantity FROM item_users JOIN items ON items.id=item_users.item_id WHERE user_id='1001' AND item_key=?", [key]);
    const [actions] = await pool.query('SELECT * FROM actions');
    const [vcs] = await pool.query('SELECT * FROM vcs');
    const [access] = await pool.query('SELECT * FROM role_management_logs');
    return {wallet: a.wallet, quantity: i.quantity, actions, vcs, access};
  }
  for (const kind of ['hazama', 'solitary']) {
    await t.test(`${kind}: 残高0で1枚だけ消費、履歴と12時間の利用を保存`, async () => {
      await reset(2, 0);
      const f = await show(kind);
      assert.match(replies.at(-1).embeds[0].toJSON().description, /無料券1枚/);
      await handlePanelButton(f.confirm);
      const s = await state(kind);
      assert.equal(s.wallet, 0); assert.equal(s.quantity, 1);
      assert.equal(s.actions.length, 1); assert.equal(s.actions[0].amount, 0);
      const record = kind === 'hazama' ? s.access[0] : s.vcs[0];
      assert.ok(Math.abs(record.expire_at.getTime() - Date.now() - 12 * 3600000) < 5000);
      if (kind === 'solitary') assert.equal(record.is_ticket, 1);
      else assert.ok(roles.has(R.HAZAMA_ACCESS));
      await assert.rejects(handlePanelButton(f.confirm), /処理済み/);
      assert.equal((await state(kind)).quantity, 1);
    });
    await t.test(`${kind}: 券なしなら従来料金`, async () => {
      await reset(0);
      await handlePanelButton((await show(kind)).confirm);
      const s = await state(kind);
      assert.equal(s.wallet, kind === 'hazama' ? 9000 : 0);
      assert.equal(s.quantity, 0); assert.equal(s.actions.length, 1);
    });
    await t.test(`${kind}: 2つの確認画面が最後の1枚を同時に使っても一度だけ`, async () => {
      await reset(1);
      const a = await show(kind), b = await show(kind);
      const result = await Promise.allSettled([handlePanelButton(a.confirm), handlePanelButton(b.confirm)]);
      const s = await state(kind);
      assert.equal(s.quantity, 0); assert.equal(s.wallet, 10000); assert.equal(s.actions.length, 1);
      assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
      if (kind === 'solitary') assert.equal(channels.length - deleted.length, 1);
    });
    await t.test(`${kind}: キャンセル・別人・別チャンネル・別サーバーで消費しない`, async () => {
      await reset();
      const f = await show(kind);
      for (const overrides of [{user: {id: '1002'}}, {channelId: 'other'}, {guildId: 'other'}]) {
        await assert.rejects(handlePanelButton({...f.confirm, ...overrides}), /操作できません/);
      }
      await handlePanelButton(f.cancel);
      await assert.rejects(handlePanelButton(f.confirm), /処理済み/);
      assert.equal((await state(kind)).quantity, 1);
    });
    await t.test(`${kind}: 権限付与やVC作成失敗時は消費しない`, async () => {
      await reset();
      failures[kind === 'hazama' ? 'role' : 'channel'] = true;
      await assert.rejects(handlePanelButton((await show(kind)).confirm), /failed/);
      const s = await state(kind);
      assert.equal(s.quantity, 1); assert.equal(s.wallet, 10000);
      assert.equal(s.actions.length, 0); assert.equal(s.vcs.length, 0); assert.equal(s.access.length, 0);
    });
    await t.test(`${kind}: 履歴保存失敗は在庫と課金もロールバック`, async () => {
      await reset();
      await pool.query("CREATE TRIGGER fail_action BEFORE INSERT ON actions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test failure'");
      try {
        await assert.rejects(handlePanelButton((await show(kind)).confirm), /test failure/);
        const s = await state(kind);
        assert.equal(s.quantity, 1); assert.equal(s.wallet, 10000); assert.equal(s.actions.length, 0);
        assert.equal(s.access.length, 0); assert.equal(s.vcs.length, 0);
      } finally { await pool.query('DROP TRIGGER fail_action'); }
    });
    await t.test(`${kind}: 確認後の在庫変化で勝手に支払方法を変更しない`, async () => {
      for (const from of [0, 1]) {
        await reset(from);
        const f = await show(kind);
        await pool.query(`UPDATE item_users SET quantity=${1 - from}`);
        await handlePanelButton(f.confirm).catch(error => assert.match(error.message, /所持状況/));
        const s = await state(kind);
        assert.equal(s.wallet, 10000); assert.equal(s.quantity, 1 - from); assert.equal(s.actions.length, 0);
      }
    });
    await t.test(`${kind}: 結果返信失敗でも確定済みの利用と消費を保持`, async () => {
      await reset(); failures.reply = true;
      const f = await show(kind);
      await assert.rejects(handlePanelButton(f.confirm), /reply failed/);
      await assert.rejects(handlePanelButton(f.confirm), /処理済み/);
      assert.equal((await state(kind)).quantity, 0); assert.equal((await state(kind)).actions.length, 1);
    });
  }
  await t.test('狭間従業員は確認入口と確定時のどちらでも無料、チケットを消費しない', async () => {
    await reset(1, 0, [R.HAZAMA_STAFF]);
    await handlePanelButton(interaction(C.HAZAMA_ACCESS));
    assert.match(replies.at(-1).content, /無料/);
    assert.equal((await state('hazama')).quantity, 1);
    await reset(); const f = await show('hazama'); roles.add(R.HAZAMA_LEADER);
    await handlePanelButton(f.confirm);
    assert.equal((await state('hazama')).quantity, 1); assert.equal((await state('hazama')).actions.length, 0);
  });
  await t.test('既存の有効な狭間許可証がある場合は消費しない', async () => {
    await reset(); const f = await show('hazama');
    await pool.execute('INSERT INTO role_management_logs(user_id,role_id,expire_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 1 HOUR))', ['1001', R.HAZAMA_ACCESS]);
    await assert.rejects(handlePanelButton(f.confirm), /既に/);
    assert.equal((await state('hazama')).quantity, 1);
  });
  await t.test('期限切れ・旧形式の狭間確認は実行しない', async () => {
    await reset(); const f = await show('hazama');
    const now = Date.now(); const clock = t.mock.method(Date, 'now', () => now + 600001);
    try { await assert.rejects(handlePanelButton(f.confirm), /期限切れ/); } finally { clock.mock.restore(); }
    await assert.rejects(handlePanelButton(interaction(`${C.HAZAMA_ACCESS}_hazama_confirm`)), /期限切れ/);
    assert.equal((await state('hazama')).quantity, 1);
  });
  await t.test('実DBの一覧でも0枚は非表示', async () => {
    await reset(0);
    assert.match(await TicketViewService.createTicketMessage('1001'), /所持しているチケットはありません/);
    await pool.query("UPDATE item_users JOIN items ON items.id=item_users.item_id SET quantity=3 WHERE item_key='HAZAMA_FREE'");
    const text = await TicketViewService.createTicketMessage('1001');
    assert.match(text, /辺境の狭間（12時間）: 3枚/); assert.doesNotMatch(text, /独房（|0枚/);
  });
});
