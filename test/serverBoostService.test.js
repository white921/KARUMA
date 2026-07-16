const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getServerBoostRewardAmount,
  isNewServerBoost,
} = require("../dist/service/serverBoostService.js");

test("server boost is detected only when boosting starts", () => {
  assert.equal(isNewServerBoost(null, 1720000000000), true);
  assert.equal(isNewServerBoost(1720000000000, 1720000000000), false);
  assert.equal(isNewServerBoost(1720000000000, null), false);
  assert.equal(isNewServerBoost(null, null), false);
});

test("the first two server boosts each reward 30000 krm", () => {
  assert.equal(getServerBoostRewardAmount(1), 30000);
  assert.equal(getServerBoostRewardAmount(2), 30000);
});

test("the third and later server boosts each reward 5000 krm", () => {
  assert.equal(getServerBoostRewardAmount(3), 5000);
  assert.equal(getServerBoostRewardAmount(10), 5000);
});
