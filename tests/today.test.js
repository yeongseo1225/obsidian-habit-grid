import { test } from "node:test";
import assert from "node:assert/strict";
import { nameIsShort, weekCellsOf, weekHasHabit, weekTargetOf } from "../src/render/today";
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

test("without a start date, the first record starts the habit", () => {
  const cells = weekCellsOf(check(["2026-11-18"]), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 3).map((c) => c.state), ["off", "off", "on"]);
});

test("an explicit start date unlocks the days from that date", () => {
  const cells = weekCellsOf(check(["2026-11-18"], { startDate: "2026-11-10" }), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 3).map((c) => c.state), ["none", "none", "on"]);
  const later = weekCellsOf(check([], { startDate: "2026-11-18" }), days, todayStr, 1);
  assert.deepEqual(later.slice(0, 4).map((c) => c.state), ["off", "off", "none", "none"]);
});

test("days before a challenge starts are off", () => {
  const cells = weekCellsOf(check([], { period: { days: 30, start: "2026-11-18" } }), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 4).map((c) => c.state), ["off", "off", "none", "none"]);
});

test("weekHasHabit shows a habit from the week it started", () => {
  const prevWeek = addDays(monday, -7);
  assert.equal(weekHasHabit(check(["2026-11-18"]), monday, todayStr), true);
  assert.equal(weekHasHabit(check(["2026-11-18"]), prevWeek, todayStr), false);
  assert.equal(weekHasHabit(check(["2026-11-18"], { startDate: "2026-11-09" }), prevWeek, todayStr), true);
  assert.equal(weekHasHabit(check([], { startDate: "2026-11-09" }), addDays(monday, -14), todayStr), false);
});

test("weekHasHabit shows a habit with no start and no records only this week", () => {
  assert.equal(weekHasHabit(check([]), monday, todayStr), true);
  assert.equal(weekHasHabit(check([]), addDays(monday, -7), todayStr), false);
});

test("weekHasHabit hides challenges outside their period", () => {
  const later = check([], { period: { days: 30, start: "2026-11-25" } });
  assert.equal(weekHasHabit(later, monday, todayStr), false);
  const ended = check(["2026-09-02"], { period: { days: 10, start: "2026-09-01" } });
  assert.equal(weekHasHabit(ended, monday, todayStr), false);
  assert.equal(weekHasHabit(ended, weekStartOf(new Date(2026, 8, 3), 1), todayStr), true);
});

test("nameIsShort counts Korean characters as two columns", () => {
  assert.equal(nameIsShort("공부"), true);
  assert.equal(nameIsShort("월수금"), true);
  assert.equal(nameIsShort("Study"), true);
  assert.equal(nameIsShort("아침 스트레칭"), false);
  assert.equal(nameIsShort("Morning stretching"), false);
});

test("weekTargetOf uses the chosen weekdays, weekly times, or every day", () => {
  assert.equal(weekTargetOf(check([], { days: { "2026-11": [1, 3, 5] }, freqsRaw: { "2026-11": 3 } }), monday), 3);
  assert.equal(weekTargetOf(check([], { freqsRaw: { "2026-11": 4 } }), monday), 4);
  assert.equal(weekTargetOf(check([]), monday), 7);
  assert.equal(weekTargetOf(check([], { freqsRaw: { "2026-09": 2 } }), monday), 2);
});

test("hour amounts are shown as hours and minutes, not decimals", () => {
  const cells = weekCellsOf(measure([["2026-11-16", 2 + 40 / 60], ["2026-11-17", 0.75]]), days, todayStr, 1);
  assert.deepEqual(cells.slice(0, 2).map((c) => c.text), ["2h40m", "45m"]);
});

test("week cells count the items of an items habit", () => {
  const h = check(["2026-11-18"], { isItems: true, items: new Map([["2026-11-18", ["스쿼트", "플랭크"]]]) });
  const cells = weekCellsOf(h, days, todayStr, 1);
  assert.equal(cells[2].n, 2);
  assert.equal(cells[3].n, 0);
});
