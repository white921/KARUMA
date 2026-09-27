const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, Collection } = require('discord.js');
const { execute } = require('../dist/command/evaluation/checkName');
const { ROLE_IDS, CATEGORY_IDS } = require('../dist/constant/shared/id');
const { GuildMemberCacheService } = require('../dist/service/system/guildMemberCacheService');

function fixture(roles) {
  const target = {
    id: 'target', displayName: '山田太郎', user: { bot: false },
    roles: { cache: new Set([ROLE_IDS.CORE_MEMBER_ROLES.MENSETUMATI]) },
  };
  const guild = { members: { fetch: async () => operator } };
  const operator = {
    id: 'operator', guild, roles: { cache: new Set(roles) },
    voice: { channel: { type: ChannelType.GuildVoice, members: new Collection([['target', target]]) } },
  };
  const replies = [];
  return { replies, interaction: {
    member: operator, user: { id: 'operator' }, guild,
    channel: { parentId: CATEGORY_IDS.INTERVIEW },
    editReply: async reply => { replies.push(reply); },
  } };
}

test('名前チェックは案内官系・管理3ロールそれぞれで入口と内部の権限チェックを通る', async t => {
  t.mock.method(GuildMemberCacheService, 'getMembers', async () => new Collection());
  for (const role of [ROLE_IDS.MENSTU_BUIGINNER, ROLE_IDS.MENSTUKAN, ROLE_IDS.MENSETU_LEADER,
    ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI, ROLE_IDS.GIJUTU_LEADER]) {
    const { replies, interaction } = fixture([role]);
    await execute(interaction);
    assert.equal(replies.length, 1);
    assert.match(replies[0].content, /成功: 1人/);
    assert.match(replies[0].content, /山田太郎/);
  }
});

test('名前チェックは一般メンバー・貴族・財務員を拒否する', async t => {
  const members = t.mock.method(GuildMemberCacheService, 'getMembers', async () => { throw new Error('権限不足時は対象を取得しない'); });
  for (const roles of [[], [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN], [ROLE_IDS.GINKOU_STAFF]]) {
    const { replies, interaction } = fixture(roles);
    await assert.rejects(execute(interaction), /権限がありません/);
    assert.equal(replies.length, 0);
  }
  assert.equal(members.mock.callCount(), 0);
});
