const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");

const {
  calculateGameRoleExpireAt,
} = require("../dist/service/gameService.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

test("temporary game short role expires after one minute", () => {
  const now = dayjs("2026-07-09T21:58:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_SHORT, now);

  assert.equal(expireAt.toISOString(), "2026-07-09T12:59:00.000Z");
});

test("temporary game long role expires after two minutes", () => {
  const now = dayjs("2026-07-09T21:58:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_LONG, now);

  assert.equal(expireAt.toISOString(), "2026-07-09T13:00:00.000Z");
});

test("temporary game pass role expires at 2026-07-09 22:00 JST", () => {
  const now = dayjs("2026-07-09T12:00:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_PASS, now);

  assert.equal(expireAt.toISOString(), "2026-07-09T13:00:00.000Z");
});
