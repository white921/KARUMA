const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldRegisterCommandsOnBoot,
  isRuntimeFeatureEnabled,
  normalizePollingIntervalMs,
  normalizePositiveInteger,
} = require("../dist/util/runtimeConfig.js");
const {
  resolveMysqlConnectionLimit,
  resolveMysqlSlowAcquireLogMs,
} = require("../dist/service/dbService.js");
const {
  buildDailyShiftMessagePayload,
} = require("../dist/service/interviewShiftService.js");

test("command registration on boot is disabled by default", () => {
  assert.equal(shouldRegisterCommandsOnBoot(undefined), false);
  assert.equal(shouldRegisterCommandsOnBoot("false"), false);
});

test("command registration on boot is enabled only for explicit true", () => {
  assert.equal(shouldRegisterCommandsOnBoot("true"), true);
  assert.equal(shouldRegisterCommandsOnBoot("TRUE"), true);
});

test("polling interval falls back to the default when env is invalid", () => {
  assert.equal(normalizePollingIntervalMs(undefined, 60000), 60000);
  assert.equal(normalizePollingIntervalMs("abc", 60000), 60000);
  assert.equal(normalizePollingIntervalMs("1000", 60000), 30000);
});

test("runtime feature flags preserve the provided default unless explicitly set", () => {
  assert.equal(isRuntimeFeatureEnabled(undefined, true), true);
  assert.equal(isRuntimeFeatureEnabled("", false), false);
  assert.equal(isRuntimeFeatureEnabled("true", false), true);
  assert.equal(isRuntimeFeatureEnabled("1", false), true);
  assert.equal(isRuntimeFeatureEnabled("yes", false), true);
  assert.equal(isRuntimeFeatureEnabled("false", true), false);
  assert.equal(isRuntimeFeatureEnabled("0", true), false);
  assert.equal(isRuntimeFeatureEnabled("off", true), false);
  assert.equal(isRuntimeFeatureEnabled("unexpected", true), true);
});

test("positive integer env values fall back or clamp to the minimum", () => {
  assert.equal(normalizePositiveInteger(undefined, 5), 5);
  assert.equal(normalizePositiveInteger("abc", 5), 5);
  assert.equal(normalizePositiveInteger("0", 5, 1), 1);
  assert.equal(normalizePositiveInteger("8", 5), 8);
});

test("mysql runtime settings are configurable with safe defaults", () => {
  assert.equal(resolveMysqlConnectionLimit(undefined), 5);
  assert.equal(resolveMysqlConnectionLimit("abc"), 5);
  assert.equal(resolveMysqlConnectionLimit("0"), 1);
  assert.equal(resolveMysqlConnectionLimit("8"), 8);
  assert.equal(resolveMysqlSlowAcquireLogMs(undefined), 1000);
  assert.equal(resolveMysqlSlowAcquireLogMs("abc"), 1000);
  assert.equal(resolveMysqlSlowAcquireLogMs("0"), 0);
  assert.equal(resolveMysqlSlowAcquireLogMs("2500"), 2500);
});

test("daily shift payload is consolidated into a single message", () => {
  const payload = buildDailyShiftMessagePayload("7月3日(木)");
  assert.match(payload, /7月3日\(木\)/);
  assert.match(payload, /21時/);
  assert.match(payload, /22時/);
  assert.match(payload, /欠席/);
  assert.match(payload, /リアクション/);
});
