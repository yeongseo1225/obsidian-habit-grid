import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, parseBlock, parseDates, parseEntries, parseLog, parseSkips, parseTitle } from "../src/parse";

test("parseTitle reads name, amount and unit from a reminder title", () => {
  assert.deepEqual(parseTitle("공부 2시간"), { base: "공부", amount: 2, unit: "시간" });
  assert.deepEqual(parseTitle("공부 1시간 30분"), { base: "공부", amount: 1.5, unit: "시간" });
  assert.deepEqual(parseTitle("Study 3h"), { base: "Study", amount: 3, unit: "시간" });
  assert.deepEqual(parseTitle("달리기 5km"), { base: "달리기", amount: 5, unit: "km" });
  assert.equal(parseTitle("스트레칭"), null);
});

test("parseAmount understands several formats", () => {
  assert.equal(parseAmount("1h30m"), 1.5);
  assert.equal(parseAmount("45m"), 0.75);
  assert.equal(parseAmount("1:30"), 1.5);
  assert.equal(parseAmount("2"), 2);
  assert.equal(parseAmount(""), 0);
  assert.ok(Math.abs(parseAmount("3시간 23분") - (3 + 23 / 60)) < 1e-9);
});

test("parseLog keeps checked lines that have a title", () => {
  const text = ["- [x] 2026-11-19 목 스트레칭", "- [x] 2026-11-19", "- [ ] 2026-11-20 달리기", "memo"].join("\n");
  assert.deepEqual(parseLog(text), [{ ds: "2026-11-19", title: "목 스트레칭" }]);
});

test("parseDates, parseSkips and parseEntries", () => {
  const text = ["- [x] 2026-11-01 1h30m", "- [x] 2026-11-02", "- [ ] 2026-11-03", "* [X] 2026-11-04"].join("\n");
  assert.deepEqual([...parseDates(text)], ["2026-11-01", "2026-11-02", "2026-11-04"]);
  assert.deepEqual([...parseSkips(text)], ["2026-11-03"]);
  assert.deepEqual([...parseEntries(text)], [["2026-11-01", 1.5], ["2026-11-02", 0], ["2026-11-04", 0]]);
});

test("parseBlock reads English and Korean option names", () => {
  assert.deepEqual(parseBlock("habit: a, b\nweeks: 10\ncolor: red\nfolder: X\ngoal: 3"), { habits: ["a", "b"], weeks: 10, color: "red", folder: "X", goal: 3 });
  assert.deepEqual(parseBlock("습관: 공부\n주: 8"), { habits: ["공부"], weeks: 8 });
});
