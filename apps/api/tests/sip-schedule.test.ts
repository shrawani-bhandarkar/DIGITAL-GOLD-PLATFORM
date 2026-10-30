import assert from "node:assert/strict";
import { test } from "node:test";
import { addSipMonths, buildSipSchedule, divideRounded } from "../src/modules/sip/schedule";

test("monthly SIP schedules preserve the original day and include the maturity installment", () => {
  assert.deepEqual(buildSipSchedule("2026-01-31", "Monthly", 3), [
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
  ]);
  assert.equal(addSipMonths("2024-01-31", 1), "2024-02-29");
});

test("weekly SIP schedules include every due date through the duration boundary", () => {
  assert.deepEqual(buildSipSchedule("2026-01-01", "Weekly", 1), [
    "2026-01-08",
    "2026-01-15",
    "2026-01-22",
    "2026-01-29",
  ]);
});

test("SIP schedules reject unsupported durations and round currency ratios to paise", () => {
  assert.throws(() => buildSipSchedule("2026-01-01", "Monthly", 0), RangeError);
  assert.throws(() => buildSipSchedule("2026-01-01", "Weekly", 61), RangeError);
  assert.equal(divideRounded(15n, 10n), 2n);
  assert.equal(divideRounded(14n, 10n), 1n);
});
