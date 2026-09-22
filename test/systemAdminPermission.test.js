const test = require("node:test");
const assert = require("node:assert/strict");
const { ChannelType } = require("discord.js");
const { ROLE_IDS, TEXT_CHANNEL_IDS } = require("../dist/constant/shared/id.js");
const { GAME_VC } = require("../dist/constant/game/game.js");
const { hasSystemAdminRole, hasOperatorRole } = require("../dist/util/shared/operatorPermission.js");
const { hasRole } = require("../dist/util/member/role.js");
const { hasAdminBankPanelPermission } = require("../dist/util/currency/adminPermission.js");
const { canManageEvaluationSheetArchive } = require("../dist/util/evaluation/evaluationSheetPermission.js");
const { canManageLinkAccount } = require("../dist/service/account/linkAccountService.js");
const { canManageInvitePoints } = require("../dist/service/market/invitePointService.js");
const { InterviewService } = require("../dist/service/evaluation/interviewService.js");
const { EvaluationService } = require("../dist/service/evaluation/evaluationService.js");
const { CheckNameService } = require("../dist/service/evaluation/checkNameService.js");
const { ChangeRoleService } = require("../dist/service/member/changeRoleService.js");
const { ChangeNameService } = require("../dist/service/account/changeNameService.js");
const { RoleBasedSendService } = require("../dist/service/currency/roleBasedSendService.js");
const { RouletteService } = require("../dist/service/casino/rouletteService.js");
const { RankingService } = require("../dist/service/currency/ranking.js");
const { AccountService } = require("../dist/service/account/accountService.js");
const { VcService } = require("../dist/service/vc/vcService.js");
const { GameVcService, getGameVcTier, canPurchaseGamePass } = require("../dist/service/game/gameVcService.js");
const { SolitaryCellService } = require("../dist/service/vc/solitaryCellService.js");
const { DbService } = require("../dist/service/system/dbService.js");
const { requireChannel, requireForum } = require("../dist/util/shared/channelGuard.js");

const member = (roles = [ROLE_IDS.GIJUTU_LEADER]) => ({ id: "operator", roles: { cache: new Set(roles) } });
const interaction = (operator = member()) => ({
  member: operator, user: { id: "operator" }, channelId: "outside", channel: { id: "outside", parentId: "outside", isThread: () => false },
  guild: { members: { fetch: async () => operator } },
});

test("システム支配人はすべての操作用許可リストを通り、属性ロールは偽装しない", async () => {
  assert.equal(hasOperatorRole(member(), []), true);
  assert.equal(hasOperatorRole(member(), [ROLE_IDS.EVENT_STAFF]), true);
  assert.equal(hasSystemAdminRole({ roles: [ROLE_IDS.GIJUTU_LEADER] }), true);
  assert.equal(await hasRole(member(), ROLE_IDS.SUB_ACCOUNT), false);
  assert.equal(await hasRole(member(), ROLE_IDS.GAME_PASS), false);
  assert.equal(hasSystemAdminRole(null), false);
  assert.equal(hasOperatorRole(member([]), []), false);
  assert.equal(hasOperatorRole(member([ROLE_IDS.GINKOU_STAFF]), [ROLE_IDS.GINKOU_STAFF]), true);
  assert.equal(hasOperatorRole(member([ROLE_IDS.SABANUSI]), [ROLE_IDS.EVENT_STAFF]), false);
});

test("システム支配人だけで既存の管理者コマンド・銀行パネルの権限を満たす", async () => {
  const operator = member();
  assert.equal(await hasAdminBankPanelPermission(operator), true);
  assert.equal(canManageEvaluationSheetArchive(operator), true);
  assert.equal(canManageLinkAccount(operator), true);
  assert.equal(canManageInvitePoints(operator), true);
  await InterviewService.validateOperator(operator);
  await CheckNameService.validateOperator(operator);
  await ChangeRoleService.validateChangeRole(operator);
  await RoleBasedSendService.validate(interaction(operator), { id: "target-role" }, 1000);
  await RouletteService.assertOperator(interaction(operator));
  await RankingService.validateRanking(interaction(operator).guild, operator.id);
});

test("システム支配人は説明会外でも面接・評価・チャンネル制限付きコマンドを使用できる", async () => {
  assert.doesNotThrow(() => InterviewService.validateCommandCategory(interaction()));
  assert.doesNotThrow(() => EvaluationService.validateCommandCategory(interaction()));
  assert.equal(await requireChannel(interaction(), ["allowed"]), true);
  assert.equal(await requireForum(interaction(), ["allowed"]), true);
  assert.throws(() => InterviewService.validateCommandCategory(interaction(member([]))));
  assert.throws(() => EvaluationService.validateCommandCategory(interaction(member([]))));
  assert.equal(await requireChannel(interaction(member([])), ["allowed"]), false);
});

test("システム支配人は遊戯・罪人用パネル・ゲームパス・独房を利用できる", () => {
  assert.deepEqual(getGameVcTier(member()), { label: "旅人以上", price: GAME_VC.PRICES.TRAVELER_OR_ABOVE });
  assert.equal(canPurchaseGamePass(member()), true);
  assert.doesNotThrow(() => GameVcService.assertCreatePanelAccess(interaction(), member()));
  assert.doesNotThrow(() => GameVcService.assertRegularPanel(interaction(), member()));
  assert.doesNotThrow(() => GameVcService.assertCriminalPanel(interaction(), member()));
  assert.doesNotThrow(() => SolitaryCellService.getTier(member()));
  assert.throws(() => getGameVcTier(member([])));
  assert.throws(() => GameVcService.assertCriminalPanel({ channelId: TEXT_CHANNEL_IDS.GAME_CRIMINAL_PANEL }, member([])));
  assert.throws(() => SolitaryCellService.getTier(member([])));
});

test("システム支配人は他人が作成したVCとVC外の操作パネルを管理できる", async (t) => {
  const channel = { id: "vc", type: ChannelType.GuildVoice, parentId: "category", setName: async (name) => { channel.name = name; } };
  const operator = { ...member(), voice: { channel } };
  t.mock.method(DbService, "getConnection", async () => ({
    execute: async () => [[{ owner_id: "someone-else", type: GAME_VC.TYPE }]], release() {},
  }));
  assert.equal(await VcService.changeOwnedManagedVcName(interaction(operator), "新しい部屋"), "新しい部屋");
  assert.equal(channel.name, "新しい部屋");
  await VcService.validateVcMember(interaction({ ...member(), voice: { channel: null } }));
  await assert.rejects(VcService.validateVcMember(interaction({ ...member([]), voice: { channel: null } })));
});

test("システム支配人は一般ロールのない対象者の表示名も変更できる", async (t) => {
  t.mock.method(AccountService, "hasAccount", async () => true);
  t.mock.method(AccountService, "isSubAccount", async () => false);
  const validation = t.mock.method(AccountService, "validateName", async () => {});
  await ChangeNameService.validateChangeName({ ...member([]), id: "target", user: { id: "target" }, displayName: "旧名" }, "新名", member());
  assert.equal(validation.mock.callCount(), 1);
});
