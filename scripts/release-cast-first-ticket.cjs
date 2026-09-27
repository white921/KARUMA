// node scripts/release-cast-first-ticket.cjs check|migrate|panels
// check is read-only. Does not redeem coins or consume user tickets.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
async function remote(mode, sql) {
  const assert = require('node:assert/strict');
  const { DbService } = require('./dist/service/system/dbService');
  const { BOT_ID, TEXT_CHANNEL_IDS } = require('./dist/constant/shared/id');
  const { REST, Routes } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  assert.equal((await rest.get(Routes.user('@me'))).id, BOT_ID);
  const connection = await DbService.getConnection();
  try {
    if (mode === 'migrate') await connection.query(sql);
    const [items] = await connection.execute('SELECT item_key,name,description FROM items WHERE item_key=?', ['CAST_TWOSHOT_FIRST_FREE']);
    if (mode !== 'check') assert.equal(items.length, 1);
    const [hours] = await connection.query("SHOW COLUMNS FROM cast_payments LIKE 'hours'");
    assert.equal(hours[0].Type, 'decimal(11,1)');
    console.log(JSON.stringify({ migration: mode === 'migrate', items, hoursType: hours[0].Type }));
  } finally { connection.release(); }
  if (mode === 'migrate') return;
  const { createGachaCoinPanelPayload } = require('./dist/panel/market/gachaCoinPanelService');
  const { createCastPaymentPanelPayload } = require('./dist/panel/cast/castPaymentPanelService');
  const targets = [
    { channel: TEXT_CHANNEL_IDS.GACHA_COIN_PANEL, payload: createGachaCoinPanelPayload() },
    { channel: TEXT_CHANNEL_IDS.CAST_PAYMENT_PANEL, payload: createCastPaymentPanelPayload() },
  ];
  for (const target of targets) {
    const channel = await rest.get(Routes.channel(target.channel));
    assert.equal(channel.guild_id, process.env.GUILD_ID);
    const messages = await rest.get(Routes.channelMessages(target.channel), { query: new URLSearchParams({ limit: '100' }) });
    const matches = messages.filter(m => m.author.id === BOT_ID && m.embeds.some(e => e.title === target.payload.embeds[0].data.title));
    assert.equal(matches.length, 1, `Expected one panel in ${target.channel}`);
    target.message = matches[0];
  }
  for (const target of targets) {
    const body = { embeds: target.payload.embeds.map(e => e.toJSON()), components: target.payload.components.map(r => r.toJSON()), allowed_mentions: { parse: [] } };
    if (mode === 'panels') {
      assert.match(JSON.stringify(body), /初回無料チケット/);
      await rest.patch(Routes.channelMessage(target.channel, target.message.id), { body });
    }
    const actual = await rest.get(Routes.channelMessage(target.channel, target.message.id));
    const controls = rows => rows.flatMap(r => r.components.map(b => [b.custom_id, b.label, b.style]));
    if (mode === 'panels') {
      assert.deepEqual(controls(actual.components), controls(body.components));
      for (const [index, embed] of body.embeds.entries()) {
        assert.equal(actual.embeds[index].description, embed.description);
        assert.deepEqual(actual.embeds[index].fields ?? [], embed.fields ?? []);
      }
    }
    console.log(JSON.stringify({ verified: mode === 'panels', panel: `https://discord.com/channels/${process.env.GUILD_ID}/${target.channel}/${actual.id}`, embeds: actual.embeds, controls: controls(actual.components) }));
  }
}
const mode = process.argv[2] || 'check';
if (!['check', 'migrate', 'panels'].includes(mode)) throw new Error('Expected check|migrate|panels');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'src/sql/20260927_cast_first_ticket.sql'), 'utf8');
const source = `(${remote.toString()})(${JSON.stringify(mode)},${JSON.stringify(sql)}).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})`;
const encoded = Buffer.from(source).toString('base64');
const result = spawnSync('railway', ['ssh', '--project', 'bb93e2f8-3d5c-4482-a4cc-271322ce0fba', '--environment', 'production', '--service', 'karuma-bot', '--', `node -e "eval(Buffer.from('${encoded}','base64').toString())"`], { cwd: root, stdio: 'inherit', timeout: 120000 });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
