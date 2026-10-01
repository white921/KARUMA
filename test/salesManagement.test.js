const test = require("node:test");
const assert = require("node:assert/strict");

const { ACTION_TYPES } = require("../dist/constant/currency/action.js");
const { THREAD_IDS } = require("../dist/constant/shared/id.js");
const { DbService } = require("../dist/service/system/dbService.js");
const {
  MONTHLY_GAME_SALES_CATEGORIES,
  SalesManagementService,
} = require("../dist/service/market/salesManagementService.js");

test("monthly game sales use the five current categories and destination", () => {
  assert.equal(THREAD_IDS.SALES_DATA_THREAD, "1555107104975757363");
  assert.deepEqual(
    MONTHLY_GAME_SALES_CATEGORIES.map(({ label }) => label),
    [
      "遊戯VC作成",
      "ゲームパス（1か月）",
      "ゲームパス（2週間）",
      "罪人用VC接続権限購入",
      "罪人用VC作成",
    ],
  );
});

test("monthly sales can calculate the previous Japan month without import side effects", async (t) => {
  let queryParameters;
  let released = false;
  t.mock.method(DbService, "getConnection", async () => ({
    async execute(_sql, parameters) {
      queryParameters = parameters;
      return [[]];
    },
    release() { released = true; },
  }));

  await SalesManagementService.getSalesDataLastMonth(ACTION_TYPES.GAME_VC_CREATE);

  assert.equal(queryParameters[0], ACTION_TYPES.GAME_VC_CREATE);
  assert.ok(queryParameters[1] instanceof Date);
  assert.ok(queryParameters[2] instanceof Date);
  assert.ok(queryParameters[1].getTime() < queryParameters[2].getTime());
  assert.equal(released, true);
});

test("monthly game sales aggregate current and legacy one-month pass actions", async (t) => {
  const rows = new Map([
    [ACTION_TYPES.GAME_VC_CREATE, [{ amount: 0 }, { amount: 5000 }]],
    [ACTION_TYPES.GAME_PASS_ONE_MONTH, [{ amount: 100000 }]],
    [ACTION_TYPES.GAME_PASS, [{ amount: 100000 }]],
    [ACTION_TYPES.GAME_PASS_TWO_WEEKS, [{ amount: 50000 }]],
    [ACTION_TYPES.GAME_CRIMINAL_ACCESS, [{ amount: 5000 }]],
    [ACTION_TYPES.GAME_CRIMINAL_VC_CREATE, [{ amount: 10000 }]],
  ]);
  t.mock.method(
    SalesManagementService,
    "getSalesDataLastMonth",
    async (actionType) => rows.get(actionType) ?? [],
  );

  const result = await SalesManagementService.getSalesDataByType();
  assert.deepEqual(Array.from(result.entries()), [
    ["遊戯VC作成", { totalAmountOfThisType: 5000, count: 2 }],
    ["ゲームパス（1か月）", { totalAmountOfThisType: 200000, count: 2 }],
    ["ゲームパス（2週間）", { totalAmountOfThisType: 50000, count: 1 }],
    ["罪人用VC接続権限購入", { totalAmountOfThisType: 5000, count: 1 }],
    ["罪人用VC作成", { totalAmountOfThisType: 10000, count: 1 }],
  ]);

  const message = (await SalesManagementService.createSalesDataMessage(result)).join("\n");
  assert.match(message, /遊戯VC作成\n2件 5,000 LIA/);
  assert.match(message, /ゲームパス（2週間）\n1件 50,000 LIA/);
  assert.match(message, /罪人用VC作成\n1件 10,000 LIA/);
  assert.match(message, /\*\*合計金額\n270,000 LIA\*\*/);
});
