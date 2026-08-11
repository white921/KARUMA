const test = require("node:test");
const assert = require("node:assert/strict");

const { HistoryService } = require("../dist/service/historyService.js");
const { COMMAND_NAMES } = require("../dist/constant/command.js");

test("shows VC rewards as a credit in transaction history", () => {
  const history = HistoryService.createHistoryString(
    {
      id: 1,
      command_name: COMMAND_NAMES.VC_REWARD,
      amount: 10,
      from_user_id: "1521705594912772227",
      to_user_id: "123456789012345678",
      from_after_wallet: 0,
      to_after_wallet: 110,
      comment: "VC報酬: システム管理所（テスト） 10分",
      created_at: new Date("2026-08-06T00:00:00.000Z"),
    },
    "123456789012345678",
  );

  assert.match(history, /VC滞在報酬/);
  assert.match(history, /\+10LIA/);
  assert.match(history, /残高: 110LIA/);
  assert.match(history, /備考: VC報酬: システム管理所（テスト） 10分/);
});

test("splits long history into fields within Discord's field limit", () => {
  const entries = Array.from(
    { length: 10 },
    (_, index) => `**07/17 21:${String(index).padStart(2, "0")} 【ルーレット】ベット**\n<@bot> へ\n-500KRM　残高: 10,000KRM\n備考: ${"あ".repeat(300)}`,
  );

  const fields = HistoryService.createHistoryEmbedFields(entries);

  assert.ok(fields.length > 1);
  assert.ok(fields.every((field) => field.value.length <= 900));
});

test("paginates normal history in groups of ten", () => {
  const entries = Array.from({ length: 12 }, (_, index) => `${index}:entry`);

  const pages = HistoryService.createHistoryPages(entries);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 10);
  assert.equal(pages[1].length, 2);
});

test("paginates early only when ten entries exceed Discord's content limit", () => {
  const entries = Array.from({ length: 12 }, (_, index) => `${index}:${"x".repeat(600)}`);

  const pages = HistoryService.createHistoryPages(entries);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 8);
  assert.equal(pages[1].length, 4);
  assert.ok(pages.every((page) => page.join("\n\n").length <= 5000));
});
