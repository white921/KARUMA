const test = require('node:test');
const assert = require('node:assert/strict');
const { ReceiptDmService } = require('../dist/service/currency/receiptDmService');
const { RECEIPT_DM_TEST_RECIPIENT_ID: target } = require('../dist/constant/currency/receiptDm');
const { ACTION_TYPES: A } = require('../dist/constant/currency/action');
const { PANEL_COMMAND_NAMES: P, COMMAND_NAMES: C } = require('../dist/constant/shared/command');
const { BOT_ID, TEXT_CHANNEL_IDS } = require('../dist/constant/shared/id');
const { ActionService } = require('../dist/service/currency/actionService');
const { AccountService } = require('../dist/service/account/accountService');
const { DbService } = require('../dist/service/system/dbService');
const { AdminMintService } = require('../dist/service/currency/adminMintService');
const { AdminBurnService } = require('../dist/service/currency/adminBurnService');
const { SalaryService } = require('../dist/service/currency/salaryService');
const { RouletteService } = require('../dist/service/casino/rouletteService');
const { TicketExchangeService } = require('../dist/service/inventory/ticketExchangeService');
const { TicketExchangeLogService } = require('../dist/service/inventory/ticketExchangeLogService');
const { handleTicketExchangeButton } = require('../dist/service/inventory/ticketExchangeInteractionService');

function context() {
  const messages = [], fetched = [];
  const avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';
  const botAvatar = 'https://cdn.discordapp.com/embed/avatars/1.png';
  const operator = { id: 'operator', displayName: '実行者', displayAvatarURL: () => avatar };
  const ctx = { user: operator, guild: { members: { fetch: async () => ({ user: operator, displayName: '送金者名', displayAvatarURL: () => avatar }) } },
    client: { user: { id: BOT_ID, displayAvatarURL: () => botAvatar }, users: { fetch: async id => {
      fetched.push(id); return { ...operator, id, send: async p => messages.push({ id, embed: p.embeds[0].toJSON() }) };
    } } }, reply: async () => {}, editReply: async () => {} };
  return { ctx, messages, fetched, avatar, botAvatar };
}
const patterns = [
  [A.TRANSFER, /送金/, true], [A.CASINO_GF, /GF/, true], [A.CASINO_MAHJONG, /麻雀/, true],
  [A.CASINO_OTHER, /その他/, true], [A.SUPERCHAT, /スパチャ/, true],
  [A.ADMIN_MINT, /付与/], [A.ADMIN_BURN, /剥奪/], [A.ROLE_BASED_GRANT, /付与/],
  [A.SALARY_PAYMENT, /給料/], [A.SERVER_BOOST_REWARD, /ブースト/],
  [A.ROULETTE_PAYOUT, /配当/], [A.ROULETTE_BONUS, /参加ボーナス/],
  [A.OMIKUJI_DRAW, /おみくじ/], [A.TICKET_EXCHANGE, /換金/],
];
for (const [actionType, title, human] of patterns) {
  test(`${actionType}: 通知対象・名前・アイコン・金額を正しく分ける`, async () => {
    const f = context();
    const receipt = { actionType, recipientId: target, senderId: 'operator', amount: 1000, afterWallet: 21000 };
    await ReceiptDmService.send(f.ctx, { ...receipt, recipientId: 'other' });
    assert.deepEqual(f.fetched, []);
    await ReceiptDmService.send(f.ctx, receipt);
    assert.equal(f.messages.length, 1);
    const { id, embed } = f.messages[0];
    assert.equal(id, target);
    assert.match(embed.title, title);
    assert.equal(embed.author.name, human ? '送金者名' : 'LEVELIA BOT');
    assert.equal(embed.author.icon_url, human ? f.avatar : f.botAvatar);
    assert.match(embed.description, /1,000 LIA/);
    if (human) assert.match(embed.description, /^送金者名 さんから /);
    assert.match(embed.footer.text, /21,000 LIA/);
    if (!human) assert.doesNotMatch(JSON.stringify(embed), /operator|実行者|送金者名/);
  });
}

test('紋章代金・購入・ベット・ガチャ消費・未知の操作は通知しない', async () => {
  const f = context();
  for (const actionType of [A.CREATOR_EMBLEM_PAYMENT, A.SHOP_PURCHASE, A.ROULETTE_BET, A.MARKET_GACHA_DRAW, 'unknown']) {
    await ReceiptDmService.send(f.ctx, { actionType, recipientId: target, amount: 1, afterWallet: 2 });
  }
  assert.deepEqual(f.fetched, []);
});

test('凶は実際の減額だけ表示し、残高ゼロの場合も報酬と表示しない', async () => {
  const f = context();
  for (const amount of [-1000, 0]) {
    await ReceiptDmService.send(f.ctx, { actionType: A.OMIKUJI_DRAW, recipientId: target, amount, afterWallet: 0, comment: '凶' });
    const e = f.messages.at(-1).embed;
    assert.match(e.title, /減額/);
    assert.match(e.description, /差し引かれました/);
    assert.doesNotMatch(e.description, /-1,000/);
  }
});

function moneyFixture(t) {
  const f = context();
  t.mock.method(AccountService, 'getAccountByUserId', async id => [{ user_id: id, wallet: 10000 }]);
  t.mock.method(AccountService, 'hasAccount', async () => true);
  t.mock.method(AccountService, 'isSubAccount', async () => false);
  const writes = [];
  t.mock.method(DbService, 'getConnection', async () => ({ execute: async (sql, args) => { writes.push(args); return [{}]; }, release() {} }));
  const log = t.mock.method(ActionService, 'createActionLog', async () => {});
  t.mock.method(ActionService, 'createActionLogMessage', async () => {});
  return { ...f, writes, log };
}

test('付与と剥奪の実処理から対象本人へ通知し、剥奪の操作ユーザーには送らない', async t => {
  const f = moneyFixture(t);
  t.mock.method(AdminMintService, 'validateMint', async () => {});
  t.mock.method(AdminBurnService, 'validateBurn', async () => {});
  await AdminMintService.mint(f.ctx, target, 1000, '付与理由');
  await AdminBurnService.burn(f.ctx, target, 1000, '剥奪理由');
  assert.deepEqual(f.messages.map(m => m.id), [target, target]);
  assert.match(f.messages[0].embed.footer.text, /11,000/);
  assert.match(f.messages[1].embed.footer.text, /9,000/);
  assert.equal(f.log.mock.calls[1].arguments[2], target); // 運営履歴の向きは変えない
  assert.equal(f.log.mock.calls[1].arguments[3], 'operator');
  f.ctx.user.id = target;
  await AdminBurnService.burn(f.ctx, 'other', 1000, '');
  assert.equal(f.messages.length, 2);
});

test('給与の実処理からロール・支給月と確定残高をBOT名義で通知する', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-31T15:00:00Z') });
  const f = moneyFixture(t);
  await SalaryService.paySalary(target, 'システム補佐', 100000, f.ctx.client);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].embed.author.name, 'LEVELIA BOT');
  assert.match(f.messages[0].embed.footer.text, /110,000/);
  assert.equal(f.messages[0].embed.fields[0].value, 'システム補佐');
  assert.deepEqual(f.messages[0].embed.fields[1], { name: '支給月', value: '2026年9月分' });
});

test('DM拒否は付与を失敗扱いにせず残高と履歴を維持する', async t => {
  const f = moneyFixture(t);
  t.mock.method(AdminMintService, 'validateMint', async () => {});
  t.mock.method(console, 'error', () => {});
  f.ctx.client.users.fetch = async () => ({ send: async () => { throw new Error('50007'); } });
  await AdminMintService.mint(f.ctx, target, 1000, '');
  assert.equal(f.writes.length, 1);
  assert.equal(f.log.mock.callCount(), 1);
});

test('換金の初回成功だけ通知し、処理済み確認では再送しない', async t => {
  const f = context();
  f.ctx.user.id = target;
  Object.assign(f.ctx, { channelId: TEXT_CHANNEL_IDS.TICKET_EXCHANGE_PANEL, guildId: 'guild', customId: 'ticketExchange:confirm:1234567890123456789' });
  let alreadyCompleted = false;
  t.mock.method(TicketExchangeService, 'redeem', async () => ({ label: 'VIPホテル無料券', quantity: 5, amount: 15000, afterWallet: 25000, afterQuantity: 0, alreadyCompleted }));
  t.mock.method(TicketExchangeLogService, 'send', async () => {});
  await handleTicketExchangeButton(f.ctx);
  alreadyCompleted = true;
  await handleTicketExchangeButton(f.ctx);
  assert.equal(f.messages.length, 1);
  assert.match(f.messages[0].embed.fields[0].value, /5枚/);
});

for (const failCommit of [false, true]) {
  test(`ルーレット配当はcommit・接続解放後に合算通知する（commit失敗=${failCommit}）`, async t => {
    const f = context();
    const events = [];
    let wallet = 10000;
    const conn = {
      beginTransaction: async () => {}, rollback: async () => events.push('rollback'), release: () => events.push('release'),
      commit: async () => { if (failCommit) throw new Error('commit failed'); events.push('commit'); },
      execute: async (sql, args) => {
        if (sql.includes('SELECT id, stage, status')) return [[{ id: 1, stage: 1 }]];
        if (sql.includes('SELECT COUNT')) return [[{ count: 1 }]];
        if (sql.includes('SELECT id, user_id, bet_kind')) return [[
          { id: 1, user_id: target, bet_kind: 'red', selection: '', amount: 1000 },
          { id: 2, user_id: target, bet_kind: 'odd', selection: '', amount: 1000 },
        ]];
        if (sql.includes('SELECT wallet')) return [[{ wallet: args[0] === BOT_ID ? 100000 : wallet }]];
        if (sql.startsWith('UPDATE accounts') && args[1] === target) wallet = args[0];
        return [{}];
      },
    };
    t.mock.method(DbService, 'getConnection', async () => conn);
    const send = t.mock.method(ReceiptDmService, 'send', async (ctx, receipt) => { events.push('dm'); f.messages.push(receipt); });
    if (failCommit) {
      await assert.rejects(RouletteService.settleRound(1, f.ctx), /commit failed/);
      assert.equal(send.mock.callCount(), 0);
    } else {
      await RouletteService.settleRound(1, f.ctx);
      assert.deepEqual(events, ['commit', 'release', 'dm']);
      assert.equal(f.messages[0].amount, 4000);
      assert.equal(f.messages[0].afterWallet, 14000);
    }
  });
}

test('ロール別一括付与は対象IDの本人だけにBOT名義・対象ロール付きで通知する', async t => {
  const { RoleBasedSendService } = require('../dist/service/currency/roleBasedSendService');
  const f = moneyFixture(t);
  await RoleBasedSendService.sendToTargets(f.ctx, 'operator', 50000, [
    { member: { id: target }, account: { wallet: 10000 } },
    { member: { id: 'other' }, account: { wallet: 10000 } },
  ], 1000, 'イベント', '貴族');
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].embed.author.name, 'LEVELIA BOT');
  assert.deepEqual(f.messages[0].embed.fields[0], { name: '対象ロール', value: '貴族' });
  assert.equal(f.writes.length, 2);
});

test('ブーストの新規報酬だけ確定残高で通知し、重複検知では通知しない', async t => {
  const { ServerBoostService } = require('../dist/service/member/serverBoostService');
  const f = context();
  let reward = { amount: 30000, afterWallet: 40000, boostCount: 1, comment: 'サーバーブースト1回目の報酬' };
  t.mock.method(ServerBoostService, 'rewardServerBoost', async () => reward);
  t.mock.method(ActionService, 'createActionLogMessage', async () => {});
  const member = { id: target, user: { bot: false }, guild: f.ctx.guild, premiumSinceTimestamp: 1 };
  await ServerBoostService.handleMemberUpdate({ premiumSinceTimestamp: null }, member, f.ctx.client);
  reward = null;
  await ServerBoostService.handleMemberUpdate({ premiumSinceTimestamp: null }, member, f.ctx.client);
  assert.equal(f.messages.length, 1);
  assert.match(f.messages[0].embed.footer.text, /40,000/);
});

for (const failCommit of [false, true]) {
  test(`参加ボーナスは新規支給分だけcommit・解放後に通知する（commit失敗=${failCommit}）`, async t => {
    const f = context(), events = [], receipts = [];
    const conn = {
      beginTransaction: async () => {}, rollback: async () => events.push('rollback'), release: () => events.push('release'),
      commit: async () => { if (failCommit) throw new Error('commit failed'); events.push('commit'); },
      execute: async (sql, args) => {
        if (sql.includes('SELECT id FROM roulette_rounds')) return [[{ id: 2 }]];
        if (sql.includes('SELECT id, last_round_id')) return [[]];
        if (sql.includes('SELECT DISTINCT')) return [[{ user_id: target }, { user_id: 'already-paid' }]];
        if (sql.includes('INSERT INTO roulette_bonus_batches')) return [{ insertId: 3 }];
        if (sql.includes('INSERT IGNORE INTO roulette_participation_rewards')) return [{ affectedRows: args[1] === target ? 1 : 0 }];
        if (sql.includes('SELECT wallet')) return [[{ wallet: 100000 }]];
        return [{}];
      },
    };
    t.mock.method(DbService, 'getConnection', async () => conn);
    t.mock.method(ReceiptDmService, 'send', async (ctx, receipt) => { events.push('dm'); receipts.push(receipt); });
    if (failCommit) {
      await assert.rejects(RouletteService.grantParticipationBonus(f.ctx), /commit failed/);
      assert.deepEqual(receipts, []);
    } else {
      assert.equal(await RouletteService.grantParticipationBonus(f.ctx), 1);
      assert.deepEqual(events, ['commit', 'release', 'dm']);
      assert.equal(receipts[0].recipientId, target);
      assert.equal(receipts[0].amount, 30000);
      assert.equal(receipts[0].afterWallet, 130000);
    }
  });
}

test('運営ログの送信が失敗してもDM通知まで実行される', async t => {
  const f = moneyFixture(t);
  t.mock.method(ActionService, 'createActionLogMessage', async () => { throw Object.assign(new Error('missing access'), { code: 50001 }); });
  t.mock.method(console, 'warn', () => {});
  await ActionService.executeActionLog(f.ctx, P.ADMIN_MINT, 1000, 'operator', target, 0, 11000, '');
  assert.equal(f.messages.length, 1);
});
