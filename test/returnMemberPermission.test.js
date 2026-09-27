const test = require('node:test');
const assert = require('node:assert/strict');
const { execute } = require('../dist/command/account/returnMember');
const { ReturnMemberService } = require('../dist/service/account/returnMemberService');
const { ROLE_IDS } = require('../dist/constant/shared/id');

function fixture(roles) {
  const calls = [];
  return { calls, interaction: {
    user: { id: 'operator' },
    guild: { members: { fetch: async input => {
      calls.push(input);
      return typeof input === 'string' ? { id: input } : { roles: { cache: new Set(roles) } };
    } } },
    options: { getUser: () => ({ id: 'target' }) },
    editReply: async payload => { calls.push(payload); },
  } };
}

test('出戻りは管理3ロールそれぞれで対象者の情報を確認できる', async t => {
  const embed = { title: '出戻り情報' };
  t.mock.method(ReturnMemberService, 'createReturnMemberEmbed', async member => {
    assert.equal(member.id, 'target'); return embed;
  });
  for (const role of [ROLE_IDS.KANRISYA, ROLE_IDS.SABANUSI, ROLE_IDS.GIJUTU_LEADER]) {
    const { calls, interaction } = fixture([role]);
    await execute(interaction);
    assert.deepEqual(calls[0], { user: 'operator', force: true });
    assert.equal(calls[1], 'target');
    assert.deepEqual(calls[2], { embeds: [embed] });
  }
});

test('一般メンバー・貴族・財務員は対象者の情報を取得する前に拒否する', async t => {
  const read = t.mock.method(ReturnMemberService, 'createReturnMemberEmbed', async () => { throw new Error('情報を取得してはいけない'); });
  for (const roles of [[], [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN], [ROLE_IDS.GINKOU_STAFF]]) {
    const { calls, interaction } = fixture(roles);
    await assert.rejects(execute(interaction), /英傑・皇帝・システム支配人/);
    assert.equal(calls.length, 1);
  }
  await assert.rejects(execute({ guild: null }), /サーバー内/);
  assert.equal(read.mock.callCount(), 0);
});
