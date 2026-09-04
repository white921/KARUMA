const test = require("node:test");
const assert = require("node:assert/strict");

const { COMMAND_NAMES } = require("../dist/constant/command.js");
const {
  LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS,
  getEvaluationCommandHandlerTimeoutMs,
} = require("../dist/util/interactionHealth.js");
const { shouldDeferButtonUpdate } = require("../dist/util/interactionAck.js");

test("遊戯VCのボタンは本人限定応答を開始する", () => {
  assert.equal(shouldDeferButtonUpdate("gameVcCreate"), false);
  assert.equal(shouldDeferButtonUpdate("gameVcCreateTicket"), false);
  assert.equal(shouldDeferButtonUpdate("gameVcCreateMoney"), false);
  assert.equal(shouldDeferButtonUpdate("gameCriminalAccessPurchase"), false);
  assert.equal(shouldDeferButtonUpdate("gameCriminalAccessConfirm"), false);
  assert.equal(shouldDeferButtonUpdate("history_page_2"), true);
});

test("長時間になり得る評価シート操作だけ15分のhandler監視を使う", () => {
  for (const commandName of [
    COMMAND_NAMES.EVALUATION_SHEET,
    COMMAND_NAMES.EVALUATION_SHEET_ARCHIVE,
    COMMAND_NAMES.EVALUATION_SHEET_RESTORE,
  ]) {
    assert.equal(
      getEvaluationCommandHandlerTimeoutMs(commandName, false),
      LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS,
    );
  }

  assert.equal(
    getEvaluationCommandHandlerTimeoutMs(COMMAND_NAMES.EXTRA_EXTEND, false),
    LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS,
  );
  assert.equal(
    getEvaluationCommandHandlerTimeoutMs(COMMAND_NAMES.EXTRA_EXTEND, true), undefined);
  assert.equal(getEvaluationCommandHandlerTimeoutMs(COMMAND_NAMES.VIEW, false), undefined);
});
