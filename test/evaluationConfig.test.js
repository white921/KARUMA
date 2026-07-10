const test = require("node:test");
const assert = require("node:assert/strict");

const { EvaluationService } = require("../dist/service/evaluationService.js");

test("評価シートは指定された2つのフォーラムに作成する", () => {
  assert.deepEqual(EvaluationService.getEvaluationForumIds(), [
    "1520391206662570125",
    "1520391398552113253",
  ]);
});
