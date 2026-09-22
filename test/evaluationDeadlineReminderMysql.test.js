const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const { Collection } = require('discord.js');
const { DbService } = require('../dist/service/system/dbService');
const { EvaluationDeadlineReminderService: service, buildReminderPages } = require('../dist/service/evaluation/evaluationDeadlineReminderService');

test('評価期限通知 MySQL統合: 排他・再起動・送信後DB失敗・再実行可能DDL', {
  skip: !process.env.EVALUATION_REMINDER_TEST_SOCKET,
}, async t => {
  const database = `evaluation_reminder_test_${process.pid}_${Date.now()}`;
  const config = { socketPath: process.env.EVALUATION_REMINDER_TEST_SOCKET, user: 'root' };
  const admin = await mysql.createConnection(config);
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 4 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); });
  const ddl = fs.readFileSync('src/sql/20260922_evaluation_deadline_reminders.sql', 'utf8');
  await pool.query(ddl); await pool.query(ddl);
  const fromCreate = fs.readFileSync('src/sql/createTable.sql', 'utf8').match(/CREATE TABLE IF NOT EXISTS evaluation_deadline_reminders \([\s\S]*?;/)[0];
  await pool.query(fromCreate);
  const priorGuild = process.env.GUILD_ID;
  process.env.GUILD_ID = '1534636292153807039';
  t.after(() => { if (priorGuild === undefined) delete process.env.GUILD_ID; else process.env.GUILD_ID = priorGuild; });
  let failSave = true;
  t.mock.method(DbService, 'getConnection', async () => {
    const c = await pool.getConnection();
    return { release: () => c.release(), execute: async (sql, args) => {
      if (failSave && sql.includes('SET message_ids')) { failSave = false; throw new Error('injected DB failure after Discord send'); }
      return c.execute(sql, args);
    } };
  });
  const published = new Collection();
  let sendCount = 0;
  const channel = {
    client: { user: { id: 'bot' } },
    messages: { fetch: async () => published.clone() },
    send: async payload => {
      sendCount++;
      const message = { id: String(sendCount), author: { id: 'bot' }, content: payload.content, createdTimestamp: Date.parse('2026-09-22T14:00:01Z') };
      published.set(message.id, message); return message;
    },
  };
  t.mock.method(service, 'getDestination', async () => channel);
  let previews = 0;
  t.mock.method(service, 'preview', async () => {
    previews++;
    await new Promise(resolve => setTimeout(resolve, 30));
    return { issues: [], pages: buildReminderPages('2026-09-22', { twoDays: ['111'], oneDay: ['222'] }) };
  });
  const run = () => service.run({}, new Date('2026-09-22T14:00:00Z'));
  const first = await Promise.allSettled([run(), run()]);
  assert.equal(first.filter(r => r.status === 'rejected').length, 1);
  assert.equal(previews, 1);
  assert.equal(sendCount, 1);
  let [[row]] = await pool.query('SELECT pages, message_ids, completed FROM evaluation_deadline_reminders');
  assert.equal(row.completed, 0);
  assert.deepEqual(row.message_ids, []);
  assert.equal(row.pages.length, 1);
  await run(); await run();
  [[row]] = await pool.query('SELECT message_ids, completed FROM evaluation_deadline_reminders');
  assert.equal(row.completed, 1);
  assert.deepEqual(row.message_ids, ['1']);
  assert.equal(sendCount, 1);
  assert.equal(previews, 1);
});
