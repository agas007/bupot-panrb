import assert from "node:assert/strict";
import test from "node:test";
import { getJakartaDateRange, getJakartaMonthRange } from "../src/lib/jakarta-date-range.ts";

test("uses WIB boundaries for a selected SP2D month", () => {
  const range = getJakartaMonthRange(2026, 9);

  assert.equal(range?.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.ok(new Date("2026-09-30T16:59:59.999Z") < range!.end);
  assert.ok(new Date("2026-09-30T17:00:00.000Z") >= range!.end);
});

test("uses WIB boundaries for the advanced SP2D date range", () => {
  const range = getJakartaDateRange("2026-09-30", "2026-09-30");

  assert.equal(range.start?.toISOString(), "2026-09-29T17:00:00.000Z");
  assert.equal(range.end?.toISOString(), "2026-09-30T17:00:00.000Z");
});
