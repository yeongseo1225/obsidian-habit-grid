import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, computeWeeklyStats, goalForMonth, scheduleAt } from "../src/stats";
import { weekMonthKey } from "../src/dates";

const today = new Date(2026, 10, 20); // Fri 2026-11-20

test("goalForMonth carries the latest earlier goal forward", () => {
  assert.equal(goalForMonth({ "2026-09": 2 }, "2026-11"), 2);
  assert.equal(goalForMonth({ "2026-09": 2, "2026-11": 3 }, "2026-11"), 3);
  assert.equal(goalForMonth({ "2026-12": 5 }, "2026-11"), 0);
  assert.equal(goalForMonth(null, "2026-11"), 0);
});

test("scheduleAt prefers weekdays and carries earlier months forward", () => {
  const fr = { "2026-09": 3 }, dd = { "2026-10": [1, 3] };
  assert.deepEqual(scheduleAt(fr, dd, "2026-09"), { n: 3 });
  assert.deepEqual(scheduleAt(fr, dd, "2026-11"), { days: [1, 3] });
  assert.equal(scheduleAt(fr, dd, "2026-08"), null);
});

test("a week belongs to the month of its middle day", () => {
  assert.equal(weekMonthKey(new Date(2026, 9, 26)), "2026-10");
  assert.equal(weekMonthKey(new Date(2026, 10, 30)), "2026-12");
});

test("computeStats counts streaks and the month", () => {
  const set = new Set(["2026-11-10", "2026-11-18", "2026-11-19", "2026-11-20"]);
  const st = computeStats(set, today);
  assert.equal(st.total, 4);
  assert.equal(st.current, 3);
  assert.equal(st.longest, 3);
  assert.equal(st.monthDone, 4);
  assert.equal(st.monthDays, 30);
  assert.equal(st.doneToday, true);
});

test("computeWeeklyStats counts weeks that reach the weekly goal", () => {
  const set = new Set(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-20"]);
  const st = computeWeeklyStats(set, today, () => 3, 1);
  assert.equal(st.current, 2);
  assert.equal(st.longest, 2);
  assert.equal(st.thisCount, 4);
  assert.equal(st.weekDone, true);
});
