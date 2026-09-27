// 本番: railway ssh -s karuma-bot -- node scripts/release-diary-panel.cjs --migrate / --install
// 引数なしは読み取りのみ。実際の日記作成・課金・削除は行わない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes, ChannelType } = require('discord.js');
const { DbService } = require('../dist/service/system/dbService');
const { THREAD_IDS } = require('../dist/constant/shared/id');
const { DIARY_PANEL_MESSAGES } = require('../dist/constant/panel/panel');
const { COLOR } = require('../dist/constant/shared/color');
const { createDiaryPanelActionRow } = require('../dist/panel/diary/diaryPanelService');
const timeout = setTimeout(() => process.exit(1), 60_000);
(async () => {
  if (process.argv.includes('--migrate')) {
    const connection = await DbService.getConnection();
    try {
      await connection.query(fs.readFileSync(path.join(__dirname, '../src/sql/20260927_diary_rebuilds.sql'), 'utf8'));
      const [rows] = await connection.execute('SHOW COLUMNS FROM diary_rebuilds');
      console.log(JSON.stringify({ migration: '20260927_diary_rebuilds.sql', columns: rows.map(r => r.Field) }));
    } finally { connection.release(); }
    return;
  }
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const threadId = THREAD_IDS.DIARY_PANEL_THREAD;
  const [thread, bot, messages] = await Promise.all([
    rest.get(Routes.channel(threadId)), rest.get(Routes.user('@me')),
    rest.get(Routes.channelMessages(threadId), { query: new URLSearchParams({ limit: '100' }) }),
  ]);
  assert.equal(thread.guild_id, process.env.GUILD_ID);
  assert.equal(thread.type, ChannelType.PublicThread);
  const panels = messages.filter(message => message.author.id === bot.id && message.embeds.some(embed => embed.title === DIARY_PANEL_MESSAGES.TITLE));
  assert.equal(panels.length, 1, 'Expected one existing diary panel; inspect before editing');
  let actual = panels[0];
  if (process.argv.includes('--install')) {
    assert(!thread.thread_metadata.archived && !thread.thread_metadata.locked, 'Panel thread must be open');
    const body = { embeds: [{ title: DIARY_PANEL_MESSAGES.TITLE, description: DIARY_PANEL_MESSAGES.DESCRIPTION, color: COLOR.PINK }],
      components: [createDiaryPanelActionRow().toJSON()], allowed_mentions: { parse: [] } };
    await rest.patch(Routes.channelMessage(threadId, actual.id), { body });
    actual = await rest.get(Routes.channelMessage(threadId, actual.id));
    const buttons = rows => rows.flatMap(row => row.components.map(button => ({
      custom_id: button.custom_id, label: button.label, style: button.style,
    })));
    assert.deepEqual(buttons(actual.components), buttons(body.components));
    assert.equal(actual.embeds[0].description, body.embeds[0].description);
  }
  console.log(JSON.stringify({ panelUrl: `https://discord.com/channels/${thread.guild_id}/${threadId}/${actual.id}`,
    embeds: actual.embeds, components: actual.components }, null, 2));
})().then(() => { clearTimeout(timeout); process.exit(0); }).catch(error => {
  console.error(error.message); clearTimeout(timeout); process.exit(1);
});
