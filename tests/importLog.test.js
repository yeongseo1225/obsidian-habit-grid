import { test } from "node:test";
import assert from "node:assert/strict";
import { planImport, safeFileName, upsertDays } from "../src/importLog";

test("planImport groups log lines into habits and days", () => {
  const plan = planImport([
    { ds: "2026-11-18", title: "산책" },
    { ds: "2026-11-18", title: "Study 1h" },
    { ds: "2026-11-18", title: "Study 30m" },
    { ds: "2026-11-18", title: "운동 스쿼트 30회" },
    { ds: "2026-11-18", title: "운동 플랭크" },
    { ds: "2026-11-19", title: "운동 1h" },
    { ds: "2026-11-19", title: "목 스트레칭" },
  ], ["운동"]);
  assert.deepEqual([...plan.keys()], ["산책", "Study", "운동", "목 스트레칭"]);
  assert.equal(plan.get("Study").unit, "시간");
  assert.equal(plan.get("Study").days.get("2026-11-18").amount, 1);
  assert.deepEqual(plan.get("운동").days.get("2026-11-18").items, ["스쿼트 30회", "플랭크"]);
  assert.deepEqual(plan.get("운동").days.get("2026-11-19").items, []);
});

test("a title that starts with an items habit name becomes an item, a reversed title is its own habit", () => {
  const plan = planImport([{ ds: "2026-11-18", title: "스트레칭 목" }, { ds: "2026-11-18", title: "목 스트레칭" }], ["스트레칭"]);
  assert.deepEqual([...plan.keys()], ["스트레칭", "목 스트레칭"]);
  assert.deepEqual(plan.get("스트레칭").days.get("2026-11-18").items, ["목"]);
});

test("upsertDays adds check days once and keeps removed days removed", () => {
  const days = new Map([["2026-11-18", { amount: 0, items: [] }], ["2026-11-19", { amount: 0, items: [] }], ["2026-11-20", { amount: 0, items: [] }]]);
  const text = "---\ncolor: red\n---\n- [x] 2026-11-18\n- [ ] 2026-11-19\n";
  const out = upsertDays(text, days, {});
  assert.equal(out, "---\ncolor: red\n---\n- [x] 2026-11-18\n- [ ] 2026-11-19\n- [x] 2026-11-20\n");
  assert.equal(upsertDays(out, days, {}), out);
});

test("upsertDays writes amounts in the file unit and keeps the larger one", () => {
  const days = new Map([["2026-11-18", { amount: 45, items: [] }], ["2026-11-19", { amount: 0.5, items: [] }]]);
  const out = upsertDays("- [x] 2026-11-19 1h\n", days, { unit: "시간", amountUnit: "분" });
  assert.equal(out, "- [x] 2026-11-19 1h\n- [x] 2026-11-18 45m\n");
});

test("upsertDays merges items into an existing day", () => {
  const days = new Map([["2026-11-18", { amount: 0, items: ["플랭크", "런지"] }]]);
  const out = upsertDays("- [x] 2026-11-18 스쿼트, 플랭크\n", days, { isItems: true });
  assert.equal(out, "- [x] 2026-11-18 스쿼트, 플랭크, 런지\n");
});

test("safeFileName removes characters a file name cannot hold", () => {
  assert.equal(safeFileName("a/b: c?"), "a b c");
  assert.equal(safeFileName("..hidden"), "hidden");
});
