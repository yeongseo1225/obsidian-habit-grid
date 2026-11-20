import { test } from "node:test";
import assert from "node:assert/strict";
import { convertAmount, mergeItems, parseAmount, parseBlock, parseItemLines, parseDates, parseEntries, parseLog, parseSkips, parseTitle } from "../src/parse";

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

test("parseTitle accepts English units", () => {
  assert.deepEqual(parseTitle("Study 45m"), { base: "Study", amount: 45, unit: "분" });
  assert.deepEqual(parseTitle("Study 30 min"), { base: "Study", amount: 30, unit: "분" });
  assert.deepEqual(parseTitle("Study 2 Hours"), { base: "Study", amount: 2, unit: "시간" });
  assert.deepEqual(parseTitle("Study 1h 30m"), { base: "Study", amount: 1.5, unit: "시간" });
  assert.deepEqual(parseTitle("Read 20 pages"), { base: "Read", amount: 20, unit: "쪽" });
  assert.deepEqual(parseTitle("Run 5km"), { base: "Run", amount: 5, unit: "km" });
});

test("convertAmount aligns hours and minutes", () => {
  assert.equal(convertAmount(45, "분", "시간"), 0.75);
  assert.equal(convertAmount(2, "시간", "분"), 120);
  assert.equal(convertAmount(3, undefined, "시간"), 3);
  assert.equal(convertAmount(5, "km", "시간"), 5);
});

test("parseItemLines reads items after the date and merges duplicates", () => {
  const text = ["- [x] 2026-11-18 스쿼트, 플랭크", "- [x] 2026-11-18 스쿼트", "- [x] 2026-11-19", "- [x] 2026-11-20 푸시업，런지"].join("\n");
  assert.deepEqual([...parseItemLines(text)], [["2026-11-18", ["스쿼트", "플랭크"]], ["2026-11-20", ["푸시업", "런지"]]]);
});

test("mergeItems unions items per day without duplicates", () => {
  const a = new Map([["2026-11-18", ["스쿼트"]]]);
  const b = new Map([["2026-11-18", ["스쿼트", "플랭크"]], ["2026-11-19", ["런지"]]]);
  assert.deepEqual([...mergeItems(a, b)], [["2026-11-18", ["스쿼트", "플랭크"]], ["2026-11-19", ["런지"]]]);
});
