const test = require("node:test");
const assert = require("node:assert/strict");
const dayjs = require("dayjs");

const {
  calculateGameRoleExpireAt,
} = require("../dist/service/gameService.js");
const { ROLE_IDS } = require("../dist/constant/id.js");

test("game short role expires after six hours", () => {
  const now = dayjs("2026-07-09T21:58:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_SHORT, now);

  assert.equal(expireAt.toISOString(), "2026-07-09T18:58:00.000Z");
});

test("game long role expires after twelve hours", () => {
  const now = dayjs("2026-07-09T21:58:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_LONG, now);

  assert.equal(expireAt.toISOString(), "2026-07-10T00:58:00.000Z");
});

test("game pass role expires at the end of the current month in Japan time", () => {
  const now = dayjs("2026-07-09T12:00:00+09:00");

  const expireAt = calculateGameRoleExpireAt(ROLE_IDS.GAME_PASS, now);

  assert.equal(expireAt.toISOString(), "2026-07-31T14:59:59.999Z");
});
