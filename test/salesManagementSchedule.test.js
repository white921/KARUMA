const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SalesManagementService,
} = require("../dist/service/market/salesManagementService.js");

test("monthly sales report skips safely when its destination is not configured", async (t) => {
  const fetch = t.mock.fn(async () => {
    assert.fail("an empty destination must not fetch all guild channels");
  });
  const readSales = t.mock.method(
    SalesManagementService,
    "getSalesDataByType",
    async () => {
      assert.fail("an empty destination must not query sales data");
    },
  );
  const info = t.mock.method(console, "info", () => {});

  await SalesManagementService.executeSalesDataMessage({
    channels: { fetch },
  });

  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(readSales.mock.callCount(), 0);
  assert.equal(info.mock.callCount(), 1);
  assert.match(info.mock.calls[0].arguments[0], /skipped/);
});

test("monthly sales schedule awaits and catches report failures", () => {
  const scheduleSource = fs.readFileSync(
    path.join(__dirname, "../src/handler/system/scheduleHandler.ts"),
    "utf8",
  );

  assert.match(
    scheduleSource,
    /cron\.schedule\(\s*"30 0 1 \* \*",\s*async \(\) => \{[\s\S]*?try \{[\s\S]*?await SalesManagementService\.executeSalesDataMessage\(guild!\);[\s\S]*?catch \(err\) \{[\s\S]*?schedule monthly sales report error:/,
  );
});
