const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateRoulettePayout,
  validateRouletteBet,
  getAllowedBetKinds,
  getRouletteResultColor,
  normalizeRouletteResultColor,
} = require("../dist/service/rouletteRules.js");

test("stage availability limits betting options", () => {
  assert.deepEqual(getAllowedBetKinds(1), ["red", "black", "even", "odd"]);
  assert.ok(getAllowedBetKinds(2).includes("dozen"));
  assert.ok(getAllowedBetKinds(3).includes("split"));
  assert.throws(() => validateRouletteBet(1, "straight", "13", 100));
});

test("European roulette pays the configured total multipliers", () => {
  assert.equal(calculateRoulettePayout({ kind: "red", selection: "red", amount: 500 }, 1), 1000);
  assert.equal(calculateRoulettePayout({ kind: "dozen", selection: "13-24", amount: 500 }, 13), 1500);
  assert.equal(calculateRoulettePayout({ kind: "straight", selection: "13", amount: 500 }, 13), 18000);
  assert.equal(calculateRoulettePayout({ kind: "split", selection: "13-14", amount: 500 }, 14), 9000);
});

test("zero loses every available bet", () => {
  assert.equal(calculateRoulettePayout({ kind: "black", selection: "black", amount: 500 }, 0), 0);
  assert.equal(calculateRoulettePayout({ kind: "straight", selection: "13", amount: 500 }, 0), 0);
});

test("result color identifies red, black, and zero green with Japanese aliases", () => {
  assert.equal(getRouletteResultColor(1), "red");
  assert.equal(getRouletteResultColor(2), "black");
  assert.equal(getRouletteResultColor(0), "green");
  assert.equal(normalizeRouletteResultColor("アカ"), "red");
  assert.equal(normalizeRouletteResultColor("くろ"), "black");
  assert.equal(normalizeRouletteResultColor("緑"), "green");
});
