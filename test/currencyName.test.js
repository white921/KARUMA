const test = require("node:test");
const assert = require("node:assert/strict");

const { CURRENCY_NAMES } = require("../dist/constant/currency.js");

test("currency name is configured for LIA", () => {
  assert.equal(CURRENCY_NAMES, "LIA");
});
