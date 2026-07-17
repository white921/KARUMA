const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  shouldRegisterCommandsOnBoot,
  isRuntimeFeatureEnabled,
  normalizePollingIntervalMs,
  normalizePositiveInteger,
} = require("../dist/util/runtimeConfig.js");
const { BOT_ID, TEXT_CHANNEL_IDS } = require("../dist/constant/id.js");
const {
  resolveMysqlConnectionLimit,
  resolveMysqlSlowAcquireLogMs,
} = require("../dist/service/dbService.js");
const {
  buildDailyShiftMessagePayloads,
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
  assert.equal(normalizePollingIntervalMs("1000", 60000, 15000), 15000);
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

test("daily shift payloads are separated by shift option", () => {
  const payloads = buildDailyShiftMessagePayloads("7月3日(木)");

  assert.equal(payloads.length, 4);
  assert.deepEqual(
    payloads.map((payload) => {
      assert.match(payload, /7月3日\(木\)/);
      assert.match(payload, /リアクション/);
      return payload.match(/(?:21時|22時|23時|欠席)/)?.[0];
    }),
    ["21時", "22時", "23時", "欠席"],
  );
});

test("interviewer shift notifications target the configured channel at 00:30 Japan time", () => {
  const scheduleSource = fs.readFileSync(
    path.join(__dirname, "../src/handler/scheduleHandler.ts"),
    "utf8",
  );

  assert.equal(TEXT_CHANNEL_IDS.MENSTU_SHIFT, "1527175478102851685");
  assert.match(scheduleSource, /cron\.schedule\(\s*"30 0 \* \* \*"/);
  assert.match(scheduleSource, /timezone:\s*"Asia\/Tokyo"/);
  assert.match(scheduleSource, /await InterviewShiftService\.sendDailyShiftMessage\(client\)/);
});

test("daily diary cleanup schedule is disabled", () => {
  const scheduleSource = fs.readFileSync(
    path.join(__dirname, "../src/handler/scheduleHandler.ts"),
    "utf8",
  );

  assert.doesNotMatch(scheduleSource, /^\s+DiaryService\.closeInactiveDiaries\(client\);/m);
});

test("bot account id is configured for KARUMA", () => {
  const karumaBotId = "1521705594912772227";
  const createTableSql = fs.readFileSync(
    path.join(__dirname, "../src/sql/createTable.sql"),
    "utf8",
  );

  assert.equal(BOT_ID, karumaBotId);
  assert.match(createTableSql, new RegExp(`VALUES \\(${karumaBotId}, 'KARUMA Bot', 0\\)`));
});

test("command registration script invokes and awaits registration when run directly", () => {
  const registerSource = fs.readFileSync(
    path.join(__dirname, "../src/registerCommands.ts"),
    "utf8",
  );

  assert.match(registerSource, /if\s*\(\s*require\.main\s*===\s*module\s*\)/);
  assert.match(registerSource, /await\s+rest\.put/);
  assert.doesNotMatch(registerSource, /\(async\s*\(\)\s*=>/);
});
