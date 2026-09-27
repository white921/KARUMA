const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionsBitField, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { MeetingVcService, buildMeetingOverwrites, canJoinMeeting } = require('../dist/service/vc/meetingVcService');
const { DbService } = require('../dist/service/system/dbService');
const { createMeetingPanel } = require('../dist/panel/vc/meetingPanelService');
const { MEETING_TEMPLATES, MEETING_CATEGORY_ID, MEETING_PANEL_CHANNEL_ID, MEETING_VC_TYPE } = require('../dist/constant/vc/meeting');
const { resolvePanelInstallTarget } = require('../dist/panel/panelInstallService');
const guild = { id: 'guild', ownerId: 'owner' };
const overwrite = (id, allow = 0n, deny = 0n, type = 0) => ({id, type, allow: new PermissionsBitField(allow), deny: new PermissionsBitField(deny)});
const channelWith = entries => ({guild, permissionOverwrites: {cache: new Collection(entries.map(p => [p.id, p]))}});
const member = (id, roles = [], permissions = P.ViewChannel | P.Connect) => ({id, guild, roles: {cache: new Set(roles)}, permissions: new PermissionsBitField(permissions)});
const category = channelWith([overwrite('guild', 0n, P.ViewChannel), overwrite('general', P.ViewChannel | P.Connect)]);

test('13 meeting choices and installation route', () => {
  const panel = createMeetingPanel();
  const select = panel.components[0].toJSON().components[0];
  assert.equal(select.options.length, 13);
  assert.equal(new Set(select.options.map(o => o.value)).size, 13);
  assert.equal(resolvePanelInstallTarget(MEETING_PANEL_CHANNEL_ID), 'meeting');
  assert.match(panel.embeds[0].data.description, /無料/);
});

test('general users can view but cannot join, including theater general connect grants', () => {
  const source = channelWith([overwrite('guild', 0n, P.ViewChannel), overwrite('general', P.ViewChannel | P.Connect), overwrite('staff', P.Connect | P.Speak)]);
  const permissions = buildMeetingOverwrites(source, category);
  assert.equal(canJoinMeeting(member('user', ['general']), permissions), false);
  assert.equal(canJoinMeeting(member('user', ['staff', 'general']), permissions), true);
  assert.equal(canJoinMeeting(member('user', ['staff']), permissions), true);
  assert.equal(canJoinMeeting(member('user'), permissions), false);
  assert.equal(permissions.find(p => p.id === 'general').allow & P.ViewChannel, P.ViewChannel);
  assert.equal(source.permissionOverwrites.cache.get('general').allow.has(P.Connect), true);
});

test('system meeting gets general visibility while preserving staff and leader access', () => {
  const permissions = buildMeetingOverwrites(channelWith([overwrite('guild', 0n, P.ViewChannel | P.Connect), overwrite('staff', P.Connect), overwrite('leader', P.Connect)]), category);
  assert.equal(permissions.find(p => p.id === 'general').allow & P.ViewChannel, P.ViewChannel);
  for (const role of ['staff', 'leader']) assert.equal(canJoinMeeting(member('user', [role]), permissions), true);
  assert.equal(canJoinMeeting(member('user', ['general']), permissions), false);
  assert.equal(canJoinMeeting(member('owner'), permissions), true);
  assert.equal(canJoinMeeting(member('admin', [], P.Administrator), permissions), true);
});

test('individual overwrite deny takes precedence and chat restrictions are preserved', () => {
  const permissions = buildMeetingOverwrites(channelWith([overwrite('staff', P.Connect), overwrite('general', P.ViewChannel, P.ReadMessageHistory), overwrite('user', 0n, P.Connect, 1)]), category);
  assert.equal(canJoinMeeting(member('user', ['staff', 'general']), permissions), false);
  assert.equal(permissions.find(p => p.id === 'general').deny & P.ReadMessageHistory, P.ReadMessageHistory);
});

function setup(t, { eligible = true, insertFails = false, tracked = true, rows = [] } = {}) {
  const previousGuild = process.env.GUILD_ID;
  process.env.GUILD_ID = guild.id;
  t.after(() => { if (previousGuild === undefined) delete process.env.GUILD_ID; else process.env.GUILD_ID = previousGuild; });
  const queries = [];
  const created = [];
  const deleted = [];
  const replies = [];
  const source = {...channelWith([overwrite('guild', 0n, P.ViewChannel), overwrite('staff', P.Connect)]), type: ChannelType.GuildVoice, parentId: MEETING_CATEGORY_ID, bitrate: 64000};
  const client = {isReady: () => true};
  const voice = { id: 'new-vc', guild, parentId: MEETING_CATEGORY_ID, type: ChannelType.GuildVoice, members: new Collection(), client, delete: async () => {deleted.push('new-vc');} };
  const g = {...guild, roles: {fetch: async () => {}}, members: {fetch: async () => member('creator', eligible ? ['staff', 'general'] : ['general'])}, channels: {
    fetch: async id => id === MEETING_CATEGORY_ID ? {...category, type: ChannelType.GuildCategory} : source,
    create: async options => { created.push(options); return voice; },
  }};
  client.channels = {fetch: async () => voice};
  t.mock.method(DbService, 'getConnection', async () => ({release() {}, execute: async (sql, params) => {
    queries.push({sql, params});
    if (sql.startsWith('INSERT') && insertFails) throw new Error('insert failure');
    if (sql.includes('created_at')) return [rows];
    if (sql.startsWith('SELECT')) return [tracked ? [{channel_id: voice.id}] : []];
    return [{}];
  }}));
  const interaction = { guild: g, channelId: MEETING_PANEL_CHANNEL_ID, values: [MEETING_TEMPLATES[0].id], user: {id: 'creator'},
    deferReply: async x => replies.push(['defer', x]), editReply: async x => replies.push(['edit', x]) };
  return {queries, created, deleted, replies, interaction, voice, client};
}

test('creation defers then creates a free tracked VC without hotel bonus cleanup', async t => {
  const s = setup(t);
  await MeetingVcService.create(s.interaction);
  assert.equal(s.created.length, 1);
  assert.equal(s.created[0].parent, MEETING_CATEGORY_ID);
  assert.equal(s.created[0].userLimit, 0);
  assert.deepEqual(s.queries[0].params, ['new-vc', 'creator', MEETING_VC_TYPE]);
  assert.match(s.queries[0].sql, /FALSE, FALSE, NULL/);
  assert.deepEqual(s.replies.map(r => r[0]), ['defer', 'edit']);
});

test('non-staff, invalid selection, and wrong panel cannot create', async t => {
  const s = setup(t, {eligible: false});
  await assert.rejects(MeetingVcService.create(s.interaction), /関係者のみ/);
  s.interaction.values = ['invalid'];
  await assert.rejects(MeetingVcService.create(s.interaction), /選び直し/);
  s.interaction.values = [MEETING_TEMPLATES[0].id];
  s.interaction.channelId = 'wrong';
  await assert.rejects(MeetingVcService.create(s.interaction), /選び直し/);
  assert.equal(s.created.length, 0);
  assert.equal(s.queries.length, 0);
});

test('DB registration failure removes the newly created channel', async t => {
  const s = setup(t, {insertFails: true});
  await assert.rejects(MeetingVcService.create(s.interaction), /insert failure/);
  assert.deepEqual(s.deleted, ['new-vc']);
});

test('occupied VCs including bot-only, templates, and untracked VCs are preserved', async t => {
  const s = setup(t, {tracked: false});
  s.voice.members.set('bot', {user: {bot: true}});
  assert.equal(await MeetingVcService.deleteIfEmpty(s.voice), false);
  s.voice.members.clear();
  assert.equal(await MeetingVcService.deleteIfEmpty({...s.voice, id: MEETING_TEMPLATES[0].id}), false);
  assert.equal(await MeetingVcService.deleteIfEmpty(s.voice), false);
  assert.equal(s.deleted.length, 0);
});

test('zero-member tracked meeting is deleted and deactivated', async t => {
  const s = setup(t);
  assert.equal(await MeetingVcService.deleteIfEmpty(s.voice), true);
  assert.equal(s.deleted.length, 1);
  assert.match(s.queries[1].sql, /UPDATE vcs SET is_active = FALSE/);
});

test('concurrent empty events delete only once', async t => {
  const s = setup(t);
  assert.deepEqual(await Promise.all([MeetingVcService.deleteIfEmpty(s.voice), MeetingVcService.deleteIfEmpty(s.voice)]), [true, false]);
  assert.equal(s.deleted.length, 1);
});

test('cleanup queries persisted meetings with initial five-minute grace', async t => {
  const s = setup(t, {rows: [{channel_id: 'new-vc'}]});
  await MeetingVcService.cleanup(s.client);
  assert.deepEqual(s.queries[0].params, [MEETING_VC_TYPE, 300]);
  assert.equal(s.deleted.length, 1);
});

test('cleanup retries transient REST errors without losing active records', async t => {
  const s = setup(t, {rows: [{channel_id: 'new-vc'}]});
  s.client.channels.fetch = async () => {throw new Error('network');};
  t.mock.method(console, 'error', () => {});
  await MeetingVcService.cleanup(s.client);
  assert.equal(s.queries.filter(q => q.sql.startsWith('UPDATE')).length, 0);
});

test('entry during database lookup prevents deletion', async t => {
  const s = setup(t);
  t.mock.method(DbService, 'getConnection', async () => ({release() {}, execute: async () => {
    s.voice.members.set('new-member', {});
    return [[{channel_id: s.voice.id}]];
  }}));
  assert.equal(await MeetingVcService.deleteIfEmpty(s.voice), false);
  assert.equal(s.deleted.length, 0);
});

test('parallel creation clicks do not create duplicate channels', async t => {
  const s = setup(t);
  const results = await Promise.allSettled([MeetingVcService.create(s.interaction), MeetingVcService.create(s.interaction)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(s.created.length, 1);
});
