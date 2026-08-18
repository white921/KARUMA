const test = require("node:test");
const assert = require("node:assert/strict");

const { EvaluationService } = require("../dist/service/evaluationService.js");
const { BASE_EVALUATION_DAYS } = require("../dist/constant/evaluation.js");
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

test("評価シートは指定された4つのフォーラムに作成する", () => {
  assert.deepEqual(EvaluationService.getEvaluationForumIds(), [
    "1534655774184444076",
    "1534655844421992578",
    "1534655898549747894",
    "1534641620626964503",
  ]);
});

test("評価シート本文に自己紹介リンクと対象ユーザーIDを載せる", () => {
  const content = EvaluationService.createEvaluationSheetContent(
    { id: "123456789012345678" },
    "https://discord.com/channels/1/2/3",
  );

  assert.equal(
    content,
    "自己紹介: https://discord.com/channels/1/2/3\nユーザーID: 123456789012345678\n\n",
  );
});
