const test = require("node:test");
const assert = require("node:assert/strict");

const { EvaluationService } = require("../dist/service/evaluationService.js");
const { InterviewService } = require("../dist/service/interviewService.js");
const { BASE_EVALUATION_DAYS } = require("../dist/constant/evaluation.js");
const { CATEGORY_IDS } = require("../dist/constant/id.js");
const {
  EVALUATION_SHEET_MESSAGES,
} = require("../dist/constant/evaluationSheet.js");

test("基本評価期間は14日", () => {
  assert.equal(BASE_EVALUATION_DAYS, 14);
});

test("評価シートの対象ロール名は旅人", () => {
  assert.match(EVALUATION_SHEET_MESSAGES.NO_TARGET_USERS, /旅人/);
  assert.match(EVALUATION_SHEET_MESSAGES.NO_KARIMEN_ROLE, /旅人/);
  assert.doesNotMatch(EVALUATION_SHEET_MESSAGES.NO_TARGET_USERS, /未契約/);
  assert.doesNotMatch(EVALUATION_SHEET_MESSAGES.NO_KARIMEN_ROLE, /未契約/);
});

test("面接通過と評価シートは説明会カテゴリで実行する", () => {
  const interaction = { channel: { parentId: "1534638743619637465" } };

  assert.equal(CATEGORY_IDS.INTERVIEW, "1534638743619637465");
  assert.doesNotThrow(() =>
    InterviewService.validateCommandCategory(interaction),
  );
  assert.doesNotThrow(() =>
    EvaluationService.validateCommandCategory(interaction),
  );
});

test("評価シートは指定された4つのフォーラムに作成する", () => {
  assert.deepEqual(EvaluationService.getEvaluationForumIds(), [
    "1534655774184444076",
    "1534655844421992578",
    "1534655898549747894",
    "1534641620626964503",
  ]);
});

test("評価シート本文に自己紹介リンク、対象ユーザーID、終了日を載せる", () => {
  const content = EvaluationService.createEvaluationSheetContent(
    { id: "123456789012345678" },
    "https://discord.com/channels/1/2/3",
    "09/01",
  );

  assert.equal(
    content,
    "自己紹介: https://discord.com/channels/1/2/3\nユーザーID: 123456789012345678\n終了日: 09/01\n\n",
  );
});

test("評価期間延長でスレッド本文の終了日も更新する", async () => {
  let editedContent;
  const updated = await EvaluationService.updateStarterMessageEndDate(
    {
      fetchStarterMessage: async () => ({
        content: "評価シート\n終了日: 08/18\n",
        edit: async ({ content }) => {
          editedContent = content;
        },
      }),
    },
    "08/28",
  );

  assert.equal(updated, true);
  assert.equal(editedContent, "評価シート\n終了日: 08/28\n");
});

test("評価期間延長ログは実行者の表示名を記載し、メンションしない", () => {
  assert.equal(
    EvaluationService.createEvaluationExtensionLog(
      1,
      "08/28",
      "08/29",
      "案内官テスト",
      "デモ",
    ),
    "📅 評価期間を 1日 延長しました: 08/28 → 08/29\nby 案内官テスト\n理由: デモ",
  );
});
