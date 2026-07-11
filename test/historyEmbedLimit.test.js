const test = require("node:test");
const assert = require("node:assert/strict");

const { HistoryService } = require("../dist/service/historyService.js");

test("splits long history into fields within Discord's field limit", () => {
  const entries = Array.from(
    { length: 10 },
    (_, index) => `**07/17 21:${String(index).padStart(2, "0")} 【ルーレット】ベット**\n<@bot> へ\n-500KRM　残高: 10,000KRM\n備考: ${"あ".repeat(300)}`,
  );

  const fields = HistoryService.createHistoryEmbedFields(entries);

  assert.ok(fields.length > 1);
  assert.ok(fields.every((field) => field.value.length <= 900));
});

test("paginates history by content length instead of a fixed action count", () => {
  const entries = Array.from({ length: 12 }, (_, index) => `${index}:${"x".repeat(600)}`);

  const pages = HistoryService.createHistoryPages(entries);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 8);
  assert.equal(pages[1].length, 4);
  assert.ok(pages.every((page) => page.join("\n\n").length <= 5000));
});
