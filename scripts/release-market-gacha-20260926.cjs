// 手動/予約実行用。スケジューラーを作らず、時刻・レビュー確認後の本番反映を補助する。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const RELEASE_AT = Date.parse('2026-09-25T15:00:00Z');

function assertReleaseTime(now = Date.now()) {
  if (!Number.isFinite(now) || now < RELEASE_AT) throw new Error('日本時間2026-09-26 00:00までは本番を変更できません。');
}

function assertReviewedCode(root, review) {
  if (!/^REVIEW: PASS$/m.test(review)) throw new Error('Code review is not marked PASS.');
  const reviewed = review.match(/^REVIEWED_CODE_COMMIT: ([a-f0-9]{40})$/m)?.[1];
  if (!reviewed) throw new Error('Reviewed code commit is missing.');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git(['merge-base', '--is-ancestor', reviewed, 'HEAD']);
  const changed = git(['diff', '--name-only', reviewed, 'HEAD']).split('\n').filter(Boolean);
  if (changed.some(file => file !== 'docs/market-gacha-20260926-release.md')) throw new Error('Code changed after review. Review the current commit before releasing.');
  if (git(['status', '--porcelain'])) throw new Error('Use a clean checkout of the reviewed commit before releasing.');
}

async function remote(mode, sql, releaseAt) {
  const assert = require('node:assert/strict');
  const { REST, Routes } = require('discord.js');
  const { BOT_ID, TEXT_CHANNEL_IDS } = require('./dist/constant/shared/id');
  if (Date.now() < releaseAt) throw new Error('Release time has not arrived.');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const me = await rest.get(Routes.user('@me'));
  assert.equal(me.id, BOT_ID);
  if (mode === 'migrate') {
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE, port: Number(process.env.MYSQL_PORT || 3306),
      supportBigNumbers: true, bigNumberStrings: true, multipleStatements: true,
    });
    try {
      const [bot] = await db.execute('SELECT user_id FROM accounts WHERE user_id = ?', [BOT_ID]);
      assert.equal(bot.length, 1);
      await db.query(sql);
      const [items] = await db.query("SELECT item_key, name FROM items WHERE item_key IN ('HOTEL_NORMAL_FREE','HAZAMA_FREE','SOLITARY_CELL_FREE')");
      assert.equal(items.length, 3);
      const [columns] = await db.query("SHOW COLUMNS FROM market_gacha_draws LIKE 'bonus_draws_awarded'");
      assert.equal(columns.length, 1);
      console.log(JSON.stringify({ migrationApplied: true, items, bonusColumn: columns[0].Field }));
    } finally { await db.end(); }
    return;
  }
  const { MARKET_GACHA_PRIZES } = require('./dist/constant/market/marketGacha');
  const { SHOP_PANEL_MESSAGES: shop, HOTEL_VC_PANEL_MESSAGES: hotel } = require('./dist/constant/panel/panel');
  const { createShopPanelActionRow } = require('./dist/panel/market/shopPanelService');
  const { createHotelVcPanelActionRows } = require('./dist/panel/hotel/hotelPanelService');
  assert.equal(MARKET_GACHA_PRIZES.length, 22);
  assert.equal(MARKET_GACHA_PRIZES.find(p => p.key === 'gacha_coin_6').coins, 6);
  const targets = [
    { channel: TEXT_CHANNEL_IDS.SHOP_PANEL, copy: shop, components: [createShopPanelActionRow().toJSON()] },
    { channel: TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL, copy: hotel, components: createHotelVcPanelActionRows().map(r => r.toJSON()) },
  ];
  // 両方の対象を確認してから編集し、既存メッセージ・色・画像を保持する。
  for (const target of targets) {
    const messages = await rest.get(Routes.channelMessages(target.channel), { query: new URLSearchParams({ limit: '100' }) });
    const matches = messages.filter(m => m.author.id === BOT_ID && m.embeds.some(e => e.title === target.copy.TITLE));
    assert.equal(matches.length, 1, `Expected one panel in ${target.channel}`);
    target.message = matches[0];
  }
  for (const target of targets) {
    const embeds = target.message.embeds.map(e => ({
      title: e.title, description: e.title === target.copy.TITLE ? target.copy.DESCRIPTION : e.description,
      color: e.color, ...(e.thumbnail ? { thumbnail: { url: e.thumbnail.url } } : {}),
    }));
    await rest.patch(Routes.channelMessage(target.channel, target.message.id), {
      body: { embeds, components: target.components, allowed_mentions: { parse: [] } },
    });
    const actual = await rest.get(Routes.channelMessage(target.channel, target.message.id));
    assert.equal(actual.embeds.find(e => e.title === target.copy.TITLE).description, target.copy.DESCRIPTION);
    const controls = rows => rows.flatMap(r => r.components.map(b => [b.custom_id, b.label, b.style]));
    assert.deepEqual(controls(actual.components), controls(target.components));
    console.log(JSON.stringify({ panelVerified: true, channel: target.channel, message: actual.id, controls: controls(actual.components) }));
  }
}

function main() {
  const mode = process.argv[2];
  if (!['migrate', 'panels'].includes(mode)) throw new Error('Usage: node scripts/release-market-gacha-20260926.cjs migrate|panels');
  assertReleaseTime();
  const root = path.resolve(__dirname, '..');
  const review = fs.readFileSync(path.join(root, 'docs/market-gacha-20260926-release.md'), 'utf8');
  assertReviewedCode(root, review);
  const sql = mode === 'migrate' ? fs.readFileSync(path.join(root, 'src/sql/20260926_market_gacha.sql'), 'utf8') : '';
  const source = `(${remote.toString()})(${JSON.stringify(mode)},${JSON.stringify(sql)},${RELEASE_AT}).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})`;
  const encoded = Buffer.from(source).toString('base64');
  const js = `eval(Buffer.from('${encoded}','base64').toString())`;
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const result = spawnSync('railway', ['ssh', '--project', 'bb93e2f8-3d5c-4482-a4cc-271322ce0fba', '--environment', 'production', '--service', 'karuma-bot', '--', `node -e ${quote(js)}`], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { assertReleaseTime, assertReviewedCode, RELEASE_AT };
