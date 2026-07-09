const test = require("node:test");
const assert = require("node:assert/strict");

const { SEND_MESSAGES } = require("../dist/constant/send.js");

test("send completion message includes the entered comment", () => {
  const message = SEND_MESSAGES.SUCCESS_TO_USER(
    "1520000000000000000",
    1234,
    "krm",
    "薬草セット",
  );

  assert.equal(
    message,
    "✅ <@1520000000000000000> に 1,234krm送金しました！\n備考: 薬草セット",
  );
});

test("send completion message omits comment line when comment is empty", () => {
  const message = SEND_MESSAGES.SUCCESS_TO_USER(
    "1520000000000000000",
    1234,
    "krm",
    "",
  );

  assert.equal(message, "✅ <@1520000000000000000> に 1,234krm送金しました！");
});
