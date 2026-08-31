const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ROLE_IDS } = require("../dist/constant/id.js");
const {
  SALARY_PAYMENTS,
  SALARY_ROLE_IDS,
  SKIPPED_MONTHLY_SALARY_PAYMENT_DATES,
} = require("../dist/constant/salary.js");
const { formatRoleNameForOutput } = require("../dist/util/role.js");
const { SalaryService } = require("../dist/service/salaryService.js");

test("role names omit parenthetical management labels in bot output", () => {
  assert.equal(formatRoleNameForOutput("市場支配人(ショップ)"), "市場支配人");
  assert.equal(formatRoleNameForOutput("英傑（運営メンバー）"), "英傑");
  assert.equal(formatRoleNameForOutput("侍従"), "侍従");
});

test("monthly salary config includes all requested roles", () => {
  assert.deepEqual(SALARY_ROLE_IDS, {
    SABANUSI: ROLE_IDS.SABANUSI,
    KANRISYA: ROLE_IDS.KANRISYA,
    MENSETU_LEADER: ROLE_IDS.MENSETU_LEADER,
    EVENT_LEADER: ROLE_IDS.EVENT_LEADER,
    GINKOU_LEADER: ROLE_IDS.GINKOU_LEADER,
    PILGRIM_LEADER: ROLE_IDS.PILGRIM_LEADER,
    SHOP_LEADER: ROLE_IDS.SHOP_LEADER,
    DARK_SHOP_LEADER: ROLE_IDS.DARK_SHOP_LEADER,
    STREAMER_MANAGER: ROLE_IDS.STREAMER_MANAGER,
    GAME_LEADER: ROLE_IDS.GAME_LEADER,
    SHOKUNIN_LEADER: ROLE_IDS.SHOKUNIN_LEADER,
    COURT_LEADER: ROLE_IDS.COURT_LEADER,
    HAZAMA_LEADER: ROLE_IDS.HAZAMA_LEADER,
    MONSTER_LEADER: ROLE_IDS.MONSTER_LEADER,
    GIJUTU_LEADER: ROLE_IDS.GIJUTU_LEADER,
    EVALUATION_LEADER: ROLE_IDS.EVALUATION_LEADER,
    EVALUATION_1KYUU: ROLE_IDS.EVALUATION_1KYUU,
    EVALUATION_2KYUU: ROLE_IDS.EVALUATION_2KYUU,
    EVALUATION_3KYUU: ROLE_IDS.EVALUATION_3KYUU,
    EVALUATION_BUIGINNER: ROLE_IDS.EVALUATION_BUIGINNER,
    MENSTUKAN: ROLE_IDS.MENSTUKAN,
    MENSTU_BUIGINNER: ROLE_IDS.MENSTU_BUIGINNER,
    GINKOU_STAFF: ROLE_IDS.GINKOU_STAFF,
    PILGRIM: ROLE_IDS.PILGRIM,
    SHOP_STAFF: ROLE_IDS.SHOP_STAFF,
    GAME_STAFF: ROLE_IDS.GAME_STAFF,
    COURT_STAFF: ROLE_IDS.COURT_STAFF,
    HAZAMA_STAFF: ROLE_IDS.HAZAMA_STAFF,
    SHOKUNIN_STAFF: ROLE_IDS.SHOKUNIN_STAFF,
    EVENT_STAFF: ROLE_IDS.EVENT_STAFF,
    MONSTER_STAFF: ROLE_IDS.MONSTER_STAFF,
    SINGER_CROWN: ROLE_IDS.SINGER_CROWN,
    VOICE_CROWN: ROLE_IDS.VOICE_CROWN,
    HONMEN: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
    JUNHONMEN: ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
    JUNJUNHONMEN: ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN,
    JUNMEN: ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN,
    HYOKAOTI: ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI,
  });
});

test("provisional members are excluded from monthly salary", () => {
  assert.equal(
    Object.values(SALARY_ROLE_IDS).includes(ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN),
    false,
  );
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.CORE_MEMBER_ROLES.KARIMEN], undefined);
});

test("monthly salary follows the provided compensation table", () => {
  assert.deepEqual(SALARY_PAYMENTS, {
    [ROLE_IDS.SABANUSI]: 1500000,
    [ROLE_IDS.KANRISYA]: 1000000,
    [ROLE_IDS.MENSETU_LEADER]: 200000,
    [ROLE_IDS.EVENT_LEADER]: 220000,
    [ROLE_IDS.GINKOU_LEADER]: 300000,
    [ROLE_IDS.PILGRIM_LEADER]: 200000,
    [ROLE_IDS.SHOP_LEADER]: 200000,
    [ROLE_IDS.DARK_SHOP_LEADER]: 230000,
    [ROLE_IDS.STREAMER_MANAGER]: 170000,
    [ROLE_IDS.GAME_LEADER]: 180000,
    [ROLE_IDS.SHOKUNIN_LEADER]: 180000,
    [ROLE_IDS.COURT_LEADER]: 250000,
    [ROLE_IDS.HAZAMA_LEADER]: 170000,
    [ROLE_IDS.MONSTER_LEADER]: 220000,
    [ROLE_IDS.GIJUTU_LEADER]: 300000,
    [ROLE_IDS.EVALUATION_LEADER]: 300000,
    [ROLE_IDS.EVALUATION_1KYUU]: 200000,
    [ROLE_IDS.EVALUATION_2KYUU]: 130000,
    [ROLE_IDS.EVALUATION_3KYUU]: 80000,
    [ROLE_IDS.EVALUATION_BUIGINNER]: 0,
    [ROLE_IDS.MENSTUKAN]: 0,
    [ROLE_IDS.MENSTU_BUIGINNER]: 0,
    [ROLE_IDS.GINKOU_STAFF]: 50000,
    [ROLE_IDS.PILGRIM]: 50000,
    [ROLE_IDS.SHOP_STAFF]: 30000,
    [ROLE_IDS.GAME_STAFF]: 0,
    [ROLE_IDS.COURT_STAFF]: 30000,
    [ROLE_IDS.HAZAMA_STAFF]: 30000,
    [ROLE_IDS.SHOKUNIN_STAFF]: 0,
    [ROLE_IDS.EVENT_STAFF]: 0,
    [ROLE_IDS.MONSTER_STAFF]: 50000,
    [ROLE_IDS.SINGER_CROWN]: 40000,
    [ROLE_IDS.VOICE_CROWN]: 0,
    [ROLE_IDS.CORE_MEMBER_ROLES.HONMEN]: 60000,
    [ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN]: 40000,
    [ROLE_IDS.CORE_MEMBER_ROLES.JUNJUNHONMEN]: 0,
    [ROLE_IDS.CORE_MEMBER_ROLES.JUNMEN]: 0,
    [ROLE_IDS.CORE_MEMBER_ROLES.HYOKAOTI]: 0,
  });
});

test("monthly salary job runs at 00:00 Japan time on the first day", () => {
  const scheduleSource = fs.readFileSync(
    path.join(__dirname, "../src/handler/scheduleHandler.ts"),
    "utf8",
  );

  assert.match(scheduleSource, /cron\.schedule\(\s*"0 0 1 \* \*"/);
  assert.match(scheduleSource, /SalaryService\.payMonthlySalaries\(guild!\)/);
});

test("9月1日の給与振込だけをJSTで停止し、翌月は再開する", () => {
  assert.deepEqual(SKIPPED_MONTHLY_SALARY_PAYMENT_DATES, ["2026-09-01"]);
  assert.equal(
    SalaryService.shouldPayMonthlySalaries(new Date("2026-08-31T15:00:00.000Z")),
    false,
  );
  assert.equal(
    SalaryService.shouldPayMonthlySalaries(new Date("2026-09-30T15:00:00.000Z")),
    true,
  );
});

test("monthly game sales job runs at 00:30 Japan time on the first day", () => {
  const scheduleSource = fs.readFileSync(
    path.join(__dirname, "../src/handler/scheduleHandler.ts"),
    "utf8",
  );

  assert.match(scheduleSource, /cron\.schedule\(\s*"30 0 1 \* \*"/);
  assert.match(
    scheduleSource,
    /SalesManagementService\.executeSalesDataMessage\(guild!\)/,
  );
});
