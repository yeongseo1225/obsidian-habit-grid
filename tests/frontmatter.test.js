import { test } from "node:test";
import assert from "node:assert/strict";
import { fmDel, fmGet, fmSet, fmSetUnit, normalizeUnit, resolveKeyStyle, unitForKey } from "../src/frontmatter";
import { setLang } from "../src/i18n";

test("fmGet reads Korean and English names", () => {
  assert.deepEqual(fmGet({ 월별횟수: { "2026-11": 3 } }, "weeklyTimes"), { "2026-11": 3 });
  assert.equal(fmGet({ duration: 30 }, "duration"), 30);
  assert.equal(fmGet({ archived: false }, "archived"), undefined);
  assert.equal(fmGet({ 주간목표: 2 }, "goal"), 2);
});

test("normalizeUnit maps English words and leaves other units alone", () => {
  assert.equal(normalizeUnit("hours"), "시간");
  assert.equal(normalizeUnit("Pages"), "쪽");
  assert.equal(normalizeUnit("cups"), "cups");
  assert.equal(normalizeUnit(true), true);
  assert.equal(unitForKey("시간", "unit"), "hours");
  assert.equal(unitForKey("시간", "단위"), "시간");
});

test("fmSet keeps the file's existing name and removes duplicates", () => {
  const a = { 기간: 10, duration: 5 };
  fmSet(a, "duration", 20, "en");
  assert.deepEqual(a, { 기간: 20 });
  const b = {};
  fmSet(b, "duration", 20, "en");
  assert.deepEqual(b, { duration: 20 });
  const c = {};
  fmSet(c, "duration", 20, "ko");
  assert.deepEqual(c, { 기간: 20 });
});

test("fmDel removes every name, fmSetUnit follows the key style", () => {
  const d = { 주간목표: 2, goal: 1 };
  fmDel(d, "goal");
  assert.deepEqual(d, {});
  const e = {};
  fmSetUnit(e, "시간", "en");
  assert.deepEqual(e, { unit: "hours" });
  const f = { 단위: "쪽" };
  fmSetUnit(f, "쪽", "en");
  assert.deepEqual(f, { 단위: "쪽" });
});

test("auto key style follows the display language", () => {
  setLang("ko");
  assert.equal(resolveKeyStyle("auto"), "ko");
  setLang("en");
  assert.equal(resolveKeyStyle("auto"), "en");
  assert.equal(resolveKeyStyle("ko"), "ko");
});
