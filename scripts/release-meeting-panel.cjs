// Railway SSH上で実行: node scripts/release-meeting-panel.cjs --smoke / --install
// 公開パネルの設置と、Bot自身を作成者にした一時VCでの本番スモークテスト。
const assert = require('node:assert/strict');
const { Client, GatewayIntentBits, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { MeetingPanelService } = require('../dist/panel/vc/meetingPanelService');
const { MeetingVcService, resolveMeetingSettings, canJoinMeeting } = require('../dist/service/vc/meetingVcService');
const { DbService } = require('../dist/service/system/dbService');
const { MEETING_CATEGORY_ID, MEETING_PANEL_CHANNEL_ID, MEETING_TEMPLATES } = require('../dist/constant/vc/meeting');

const timeout = setTimeout(() => { console.error('Meeting release timed out'); process.exit(1); }, 60_000);
(async () => {
  assert(process.argv.includes('--smoke') || process.argv.includes('--install'), 'Choose --smoke or --install');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  const ready = new Promise(resolve => client.once('clientReady', resolve));
  let createdId;
  try {
    await client.login(process.env.DISCORD_TOKEN);
    await ready;
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const category = await guild.channels.fetch(MEETING_CATEGORY_ID);
    const roles = await guild.roles.fetch();
    for (const template of MEETING_TEMPLATES) {
      const { permissionOverwrites: overwrites } = await resolveMeetingSettings(guild, template, category);
      for (const entry of category.permissionOverwrites.cache.values()) {
        if (!entry.allow.has(PermissionFlagsBits.ViewChannel)) continue;
        const member = { id: 'audit', guild, permissions: new PermissionsBitField(roles.get(guild.id).permissions.bitfield | roles.get(entry.id).permissions.bitfield), roles: { cache: new Set([entry.id]) } };
        assert(!canJoinMeeting(member, overwrites), `${template.label}: general role can connect`);
        assert(overwrites.find(p => p.id === entry.id).allow & PermissionFlagsBits.ViewChannel);
      }
      const allowed = overwrites.filter(entry => entry.allow & PermissionFlagsBits.Connect);
      assert(allowed.length > 0, `${template.label}: no staff roles`);
      for (const entry of allowed) {
        assert(roles.has(entry.id), `${template.label}: missing role ${entry.id}`);
        const member = { id: 'audit', guild, permissions: new PermissionsBitField(roles.get(guild.id).permissions.bitfield | roles.get(entry.id).permissions.bitfield), roles: { cache: new Set([entry.id]) } };
        assert(canJoinMeeting(member, overwrites), `${template.label}: staff cannot connect`);
      }
      if (template.roleIds) assert.deepEqual(allowed.map(p => p.id).sort(), [...template.roleIds].sort());
      console.log(JSON.stringify({template: template.label, allowedRoles: allowed.map(entry => roles.get(entry.id)?.name ?? entry.id)}));
    }
    if (process.argv.includes('--smoke')) {
      const selectedTemplate = MEETING_TEMPLATES.find(t => t.label === "お屋敷喫茶");
      await MeetingVcService.create({
        guild, channelId: MEETING_PANEL_CHANNEL_ID, values: [selectedTemplate.id],
        user: client.user, deferReply: async () => {},
        editReply: async ({content}) => { createdId = content.match(/<#(\d+)>/)[1]; },
      });
      const channel = await guild.channels.fetch(createdId, {force: true});
      const expected = await resolveMeetingSettings(guild, selectedTemplate, category);
      const normalized = entries => entries.map(p => ({id: p.id, type: p.type, allow: (p.allow.bitfield ?? p.allow).toString(), deny: (p.deny.bitfield ?? p.deny).toString()})).sort((a,b) => a.id.localeCompare(b.id));
      assert.deepEqual(normalized([...channel.permissionOverwrites.cache.values()]), normalized(expected.permissionOverwrites));
      assert.equal(channel.parentId, MEETING_CATEGORY_ID);
      assert.equal(channel.members.size, 0);
      assert(await MeetingVcService.deleteIfEmpty(channel));
      const connection = await DbService.getConnection();
      try {
        const [rows] = await connection.execute('SELECT type, is_active, is_bonus, expire_at FROM vcs WHERE channel_id = ?', [createdId]);
        assert.equal(rows[0].type, 'MEETING');
        assert.equal(rows[0].is_active, 0);
        assert.equal(rows[0].is_bonus, 0);
        assert.equal(rows[0].expire_at, null);
      } finally { connection.release(); }
      await assert.rejects(client.rest.get(`/channels/${createdId}`), error => error.code === 10003);
      console.log(JSON.stringify({smoke: 'PASS', channelId: createdId, permissions: 'verified', deleted: true, database: 'inactive'}));
      createdId = undefined;
    }
    if (process.argv.includes('--install')) {
      const message = await MeetingPanelService.createPanel(client);
      const actual = await message.fetch();
      assert.equal(actual.components[0].components[0].options.length, 14);
      console.log(JSON.stringify({panelUrl: actual.url, embed: actual.embeds[0].toJSON(), components: actual.components.map(c => c.toJSON())}));
    }
  } finally {
    if (createdId) {
      const channel = await guildChannel(client, createdId);
      if (channel && channel.members.size === 0) await MeetingVcService.deleteIfEmpty(channel);
    }
    client.destroy();
    clearTimeout(timeout);
  }
})().then(() => process.exit(0)).catch(error => {console.error(error.message); process.exit(1);});
async function guildChannel(client, id) { return client.channels.fetch(id).catch(() => null); }
