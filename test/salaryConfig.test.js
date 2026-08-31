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
    GIJUTU_LEADER: ROLE_IDS.GIJUTU_LEADER,
    GINKOU_LEADER: ROLE_IDS.GINKOU_LEADER,
    EVALUATION_LEADER: ROLE_IDS.EVALUATION_LEADER,
    SHOP_LEADER: ROLE_IDS.SHOP_LEADER,
    GAME_LEADER: ROLE_IDS.GAME_LEADER,
    SHOKUNIN_LEADER: ROLE_IDS.SHOKUNIN_LEADER,
    EVENT_LEADER: ROLE_IDS.EVENT_LEADER,
    MONSTER_LEADER: ROLE_IDS.MONSTER_LEADER,
    EVALUATION_1KYUU: ROLE_IDS.EVALUATION_1KYUU,
    EVALUATION_2KYUU: ROLE_IDS.EVALUATION_2KYUU,
    EVALUATION_3KYUU: ROLE_IDS.EVALUATION_3KYUU,
    EVALUATION_BUIGINNER: ROLE_IDS.EVALUATION_BUIGINNER,
    MENSTUKAN: ROLE_IDS.MENSTUKAN,
    MENSTU_BUIGINNER: ROLE_IDS.MENSTU_BUIGINNER,
    GINKOU_STAFF: ROLE_IDS.GINKOU_STAFF,
    SHOP_STAFF: ROLE_IDS.SHOP_STAFF,
    GAME_STAFF: ROLE_IDS.GAME_STAFF,
    SHOKUNIN_STAFF: ROLE_IDS.SHOKUNIN_STAFF,
    EVENT_STAFF: ROLE_IDS.EVENT_STAFF,
    MONSTER_STAFF: ROLE_IDS.MONSTER_STAFF,
    HONMEN: ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
    JUNHONMEN: ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN,
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
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.SABANUSI], 1000000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.KANRISYA], 500000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.GIJUTU_LEADER], 200000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.GINKOU_LEADER], 200000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.SHOP_LEADER], 150000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.GAME_LEADER], 130000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.SHOKUNIN_LEADER], 150000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVENT_LEADER], 170000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.MENSETU_LEADER], 150000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.MONSTER_LEADER], 150000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVALUATION_LEADER], 250000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVALUATION_1KYUU], 200000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVALUATION_2KYUU], 150000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVALUATION_3KYUU], 100000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.EVALUATION_BUIGINNER], 0);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.GINKOU_STAFF], 50000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.SHOP_STAFF], 30000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.GAME_STAFF], 30000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.SHOKUNIN_STAFF], 0);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.MONSTER_STAFF], 50000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.MENSTUKAN], 0);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.CORE_MEMBER_ROLES.HONMEN], 60000);
  assert.equal(SALARY_PAYMENTS[ROLE_IDS.CORE_MEMBER_ROLES.JUNHONMEN], 40000);
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
