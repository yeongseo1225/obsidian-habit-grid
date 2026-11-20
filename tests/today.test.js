import { test } from "node:test";
import assert from "node:assert/strict";
import { weekCellsOf, weekHasHabit } from "../src/render/today";
import { addDays, fmt, weekStartOf } from "../src/dates";

const today = new Date(2026, 10, 20); // Fri 2026-11-20
const monday = weekStartOf(today, 1); // 2026-11-16
const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i));
const todayStr = fmt(today);

const check = (dates, extra = {}) => ({ kind: "check", set: new Set(dates), entries: new Map(), freqsRaw: {}, days: {}, ...extra });
const measure = (pairs, extra = {}) => ({ kind: "measure", unit: "시간", set: new Set(pairs.map(([d]) => d)), entries: new Map(pairs), monthGoals: { "2026-11": 2 }, freqsRaw: {}, days: {}, ...extra });

test("weekCellsOf marks done days, empty days and future days", () => {
  const cells = weekCellsOf(check(["2026-11-16", "2026-11-18"]), days, todayStr, 1);
  assert.deepEqual(cells.map((c) => c.state), ["on", "none", "on", "none", "none", "future", "future"]);
});

test("weekCellsOf shows amounts and partial progress for measured habits", () => {
  const cells = weekCellsOf(measure([["2026-11-16", 2], ["2026-11-17", 0.5]]), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 3).map((c) => [c.state, c.text]), [["on", "2h"], ["partial", "30m"], ["none", ""]]);
});

test("weekCellsOf flags days that are not scheduled", () => {
  const h = check(["2026-11-10"], { days: { "2026-11": [1, 3, 5] }, freqsRaw: { "2026-11": 3 } });
  const cells = weekCellsOf(h, days, todayStr, 1);
  // Mon, Wed, Fri are scheduled; Tue, Thu are rest days
  assert.deepEqual(cells.slice(0, 5).map((c) => c.due), [true, false, true, false, true]);
});

test("days before a habit's first record are off", () => {
  const cells = weekCellsOf(check(["2026-11-18"]), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 3).map((c) => c.state), ["off", "off", "on"]);
});

test("weekHasHabit hides habits that have not started or whose challenge ended", () => {
  assert.equal(weekHasHabit(check(["2026-11-18"]), monday, todayStr), true);
  assert.equal(weekHasHabit(check(["2026-12-01"]), addDays(monday, -14), todayStr), false);
  const ended = check(["2026-09-02"], { period: { days: 10, start: "2026-09-01" } });
  assert.equal(weekHasHabit(ended, monday, todayStr), false);
  assert.equal(weekHasHabit(ended, weekStartOf(new Date(2026, 8, 3), 1), todayStr), true);
});
