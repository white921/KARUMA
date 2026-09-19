const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, ChannelType, OverwriteType, PermissionsBitField } = require('discord.js');
const { createSecretHotelPermissionOverwrites, SECRET_HOTEL_HIDDEN_ROLE_IDS } = require('../dist/util/vc/secretHotelPermissions.js');
const { HotelVcService } = require('../dist/service/hotel/hotelVcService.js');
const { AccountService } = require('../dist/service/account/accountService.js');
const { DbService } = require('../dist/service/system/dbService.js');
const { ROLE_IDS, BOT_ID } = require('../dist/constant/shared/id.js');
const { HOTEL_TYPE_NAMES } = require('../dist/constant/hotel/hotel.js');
const P = PermissionsBitField.Flags;
const guildId = '100000000000000001';
const owner = '100000000000000002';
const guest = '100000000000000003';
const sub1 = '100000000000000004';
const sub2 = '100000000000000005';
const otherRole = '100000000000000006';
const outsider = '100000000000000007';

function source() {
  return [
    { id: guildId, type: OverwriteType.Role, allow: P.ViewChannel, deny: P.UseExternalEmojis },
    { id: otherRole, type: OverwriteType.Role, allow: P.ViewChannel | P.Connect, deny: P.SendTTSMessages },
    { id: outsider, type: OverwriteType.Member, allow: P.ViewChannel | P.ManageMessages, deny: 0n },
    { id: owner, type: OverwriteType.Member, allow: 0n, deny: P.ViewChannel | P.Connect },
  ];
}

function fixture(overwrites) {
  const client = new Client({ intents: [] });
  const guild = client.guilds._add({ id: guildId, name: 'test', owner_id: '100000000000000099', roles: [
    { id: guildId, name: '@everyone', permissions: String(P.ViewChannel | P.Connect) },
    ...[...SECRET_HOTEL_HIDDEN_ROLE_IDS, otherRole].map(id => ({ id, name: id, permissions: String(P.ViewChannel | P.Connect) })),
  ] });
  const channel = client.channels._add({ id: '100000000000000010', guild_id: guildId, name: 'secret', type: ChannelType.GuildVoice,
    permission_overwrites: overwrites.map(x => ({ ...x, allow: String(x.allow), deny: String(x.deny) })),
  }, guild);
  const member = (id, roles = []) => guild.members._add({ user: { id, username: id }, roles });
  return { channel, member };
}

test('all seven roles are explicitly denied viewing; participants override their role denials', () => {
  assert.deepEqual(SECRET_HOTEL_HIDDEN_ROLE_IDS, [
    ROLE_IDS.CORE_MEMBER_ROLES.HONMEN, ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
    ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN, ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN,
    ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN, ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI,
    ROLE_IDS.DETENTION_ROLES.SUMMONED_CRIME,
  ]);
  const overwrites = createSecretHotelPermissionOverwrites(guildId, BOT_ID, [owner, guest, sub1, sub2, sub1], source());
  assert.equal(new Set(overwrites.map(x => x.id)).size, overwrites.length);
  const { channel, member } = fixture(overwrites);
  for (const [i, roleId] of SECRET_HOTEL_HIDDEN_ROLE_IDS.entries()) {
    const overwrite = overwrites.find(x => x.id === roleId);
    assert.equal(overwrite.allow & P.ViewChannel, 0n);
    assert.equal(overwrite.deny & P.ViewChannel, P.ViewChannel);
    assert.equal(channel.permissionsFor(member(`10000000000000002${i}`, [roleId, otherRole])).has(P.ViewChannel), false);
  }
  for (const id of [owner, guest, sub1, sub2]) {
    const permissions = channel.permissionsFor(member(id, [...SECRET_HOTEL_HIDDEN_ROLE_IDS, otherRole]));
    assert.equal(permissions.has(P.ViewChannel), true);
    assert.equal(permissions.has(P.Connect), true);
    assert.equal(permissions.has(P.SendMessages), true);
    assert.equal(permissions.has(P.UseExternalEmojis), false);
  }
  assert.equal(channel.permissionsFor(member(outsider, [otherRole])).has(P.ViewChannel), false);
  assert.equal(channel.permissionsFor(member('100000000000000050')).has(P.ViewChannel), false);
  assert.equal(channel.permissionsFor(member(BOT_ID)).has(P.ViewChannel), true);
  assert.equal(overwrites.find(x => x.id === otherRole).allow & P.Connect, P.Connect);
  assert.equal(overwrites.find(x => x.id === otherRole).deny & P.SendTTSMessages, P.SendTTSMessages);
});

test('reapplying the permission policy is idempotent', () => {
  const first = createSecretHotelPermissionOverwrites(guildId, BOT_ID, [owner, guest], source());
  assert.deepEqual(createSecretHotelPermissionOverwrites(guildId, BOT_ID, [owner, guest], first), first);
});

for (const name of [HOTEL_TYPE_NAMES.SECRET, HOTEL_TYPE_NAMES.SECRETLONG]) {
  test(`${name} grants both parties and all registered present subaccounts, not inherited viewers`, async t => {
    const created = [];
    t.mock.method(AccountService, 'getSubUserIdsByMainUserIds', async ids => {
      assert.deepEqual(ids, [owner, guest]); return [sub1, sub2, '100000000000000090'];
    });
    const legacyLookup = t.mock.method(AccountService, 'getSubUserIdByMainUserId', async () => { throw new Error('single-sub lookup must not run for secret hotels'); });
    const categoryOverwrites = new Map(source().map(x => [x.id, { ...x, allow: new PermissionsBitField(x.allow), deny: new PermissionsBitField(x.deny) }]));
    const i = {
      guild: { id: guildId, channels: {
        fetch: async () => ({ permissionOverwrites: { cache: categoryOverwrites } }),
        create: async options => { created.push(options); return { id: 'vc', send: async () => {} }; },
      }, members: { fetch: async id => {
        if (id === '100000000000000090') throw Object.assign(new Error('Unknown member'), { code: 10007 });
        return { id, displayName: id };
      } } },
      member: { id: owner, displayName: 'creator' }, user: { id: owner }, client: { user: { id: BOT_ID } },
      channel: { parentId: 'category' }, deferred: true, editReply: async () => {},
    };
    await HotelVcService.createHotelVc(i, name, false, guest, false);
    assert.equal(created.length, 1);
    const memberAllows = created[0].permissionOverwrites.filter(x => x.type === OverwriteType.Member && (x.allow & P.ViewChannel));
    assert.deepEqual(memberAllows.map(x => x.id).sort(), [owner, guest, sub1, sub2, BOT_ID].sort());
    assert.equal(legacyLookup.mock.callCount(), 0);
  });
}

test('subaccount lookup reads all matches and preserves snowflakes as strings', async t => {
  let released = false;
  t.mock.method(DbService, 'getConnection', async () => ({
    execute: async (sql, args) => {
      assert.match(sql, /CAST\(sub_user_id AS CHAR\)/);
      assert.doesNotMatch(sql, /LIMIT 1/);
      assert.deepEqual(args, [owner, guest]);
      return [[{ sub_user_id: sub1 }, { sub_user_id: sub2 }]];
    }, release: () => { released = true; },
  }));
  assert.deepEqual(await AccountService.getSubUserIdsByMainUserIds([owner, guest]), [sub1, sub2]);
  assert.equal(released, true);
});
