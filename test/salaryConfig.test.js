const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ROLE_IDS } = require("../dist/constant/id.js");
const {
  SALARY_PAYMENTS,
  SALARY_ROLE_IDS,
} = require("../dist/constant/salary.js");

test("monthly salary is paid only to the technical director role", () => {
  assert.deepEqual(SALARY_ROLE_IDS, {
    GIJUTU_LEADER: ROLE_IDS.GIJUTU_LEADER,
  });
});

test("technical director monthly salary is 10000 KARUMA", () => {
  assert.deepEqual(SALARY_PAYMENTS, {
    [ROLE_IDS.GIJUTU_LEADER]: 10000,
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
