import { test } from "node:test";
import assert from "node:assert/strict";
import { TFile, TFolder } from "obsidian";
import { HabitGridPlugin } from "../src/plugin";
import { DEFAULT_SETTINGS } from "../src/constants";

// A tiny in-memory vault: folder tree, file texts and frontmatter
function makeVault(tree) {
  const texts = new Map(), fms = new Map();
  const mkFolder = (path, children) => Object.assign(Object.create(TFolder.prototype), { path, name: path.split("/").pop(), children });
  const mkFile = (path, text, fm) => {
    const name = path.split("/").pop();
    const f = Object.assign(Object.create(TFile.prototype), { path, name, basename: name.replace(/\.md$/, ""), extension: "md" });
    texts.set(f, text); if (fm) fms.set(f, fm);
    return f;
  };
  const byPath = new Map();
  const build = (path, node) => {
    const kids = Object.entries(node).map(([k, v]) => {
      const p = `${path}/${k}`;
      if (Array.isArray(v)) { const f = mkFile(p, v[0], v[1]); byPath.set(p, f); return f; }
      return build(p, v);
    });
    const folder = mkFolder(path, kids); byPath.set(path, folder); return folder;
  };
  build("Habits", tree);
  return {
    vault: { getAbstractFileByPath: (p) => byPath.get(p) ?? null, cachedRead: async (f) => texts.get(f) ?? "" },
    metadataCache: { getFileCache: (f) => (fms.has(f) ? { frontmatter: fms.get(f) } : null) },
  };
}

function plugin(tree) {
  const p = new HabitGridPlugin();
  p.app = makeVault(tree);
  p.settings = { ...DEFAULT_SETTINGS };
  return p;
}

test("loadHabits reads habits from list/ and records from sync/", async () => {
  const p = plugin({
    list: {
      "Study.md": ["- [x] 2026-11-18 1h30m\n", { unit: "hours", monthGoals: { "2026-11": 2 }, weeklyTimes: { "2026-11": 4 }, start: "2026-11-10" }],
      "Read.md": ["- [x] 2026-11-19\n", { duration: 30, start: "2026-11-01", color: "#3b82f6" }],
    },
    sync: { "Reminders log.md": ["- [x] 2026-11-20 Read\n- [x] 2026-11-20 Study 2h\n- [x] 2026-11-20 Study 2h\n"] },
  });
  const out = await p.loadHabits("Habits");
  const by = Object.fromEntries(out.map((h) => [h.name, h]));
  assert.deepEqual(Object.keys(by).sort(), ["Read", "Study"]);

  assert.equal(by.Study.kind, "measure");
  assert.equal(by.Study.unit, "시간");
  assert.equal(by.Study.entries.get("2026-11-18"), 1.5);
  assert.equal(by.Study.entries.get("2026-11-20"), 2);
  assert.deepEqual(by.Study.explicit, { "2026-11": 2 });
  assert.deepEqual(by.Study.freqsRaw, { "2026-11": 4 });
  assert.equal(by.Study.startDate, "2026-11-10");
  assert.equal(by.Read.startDate, "2026-11-01");

  assert.equal(by.Read.kind, "check");
  assert.deepEqual([...by.Read.set].sort(), ["2026-11-19", "2026-11-20"]);
  assert.deepEqual(by.Read.period, { days: 30, start: "2026-11-01" });
  assert.equal(by.Read.color, "#3b82f6");
});

test("loadHabits ignores files outside list/, archive/ and sync/", async () => {
  const p = plugin({
    "Rootfile.md": ["- [x] 2026-11-01\n"],
    "습관": { "Old.md": ["- [x] 2026-11-02\n"] },
    list: { "Kept.md": ["- [x] 2026-11-03\n"] },
    archive: { "Done.md": ["- [x] 2026-11-04\n", { archived: true }] },
  });
  const out = await p.loadHabits("Habits");
  assert.deepEqual(out.map((h) => h.name).sort(), ["Done", "Kept"]);
  assert.equal(out.find((h) => h.name === "Done").archived, true);
});

test("loadHabits returns null when the habits folder is missing", async () => {
  const p = plugin({});
  assert.equal(await p.loadHabits("Nope"), null);
});

test("loadHabits merges English hour and minute titles into one habit", async () => {
  const p = plugin({
    sync: { "Reminders log.md": ["- [x] 2026-11-17 Study 2h\n- [x] 2026-11-18 Study 1h 30m\n- [x] 2026-11-19 Study 45m\n"] },
  });
  const out = await p.loadHabits("Habits");
  assert.deepEqual(out.map((h) => h.name), ["Study"]);
  assert.equal(out[0].unit, "시간");
  assert.deepEqual([...out[0].entries], [["2026-11-17", 2], ["2026-11-18", 1.5], ["2026-11-19", 0.75]]);
});

test("loadHabits merges items from reminders and from the habit file", async () => {
  const p = plugin({
    list: { "운동.md": ["- [x] 2026-11-18 플랭크, 런지\n- [x] 2026-11-19\n- [ ] 2026-11-17\n", { items: true }] },
    sync: { "Reminders log.md": ["- [x] 2026-11-18 운동 스쿼트\n- [x] 2026-11-17 운동 푸시업\n"] },
  });
  const [h] = await p.loadHabits("Habits");
  assert.equal(h.name, "운동");
  assert.equal(h.isItems, true);
  assert.deepEqual(h.items.get("2026-11-18"), ["스쿼트", "플랭크", "런지"]);
  assert.deepEqual(h.itemsLog.get("2026-11-18"), ["스쿼트"]);
  assert.deepEqual(h.itemsFile.get("2026-11-18"), ["플랭크", "런지"]);
  assert.equal(h.items.has("2026-11-17"), false);
  assert.equal(h.set.has("2026-11-19"), true);
});

test("an items habit with no records still has an empty items list", async () => {
  const p = plugin({ list: { "운동.md": ["\n", { 항목: true }] } });
  const [h] = await p.loadHabits("Habits");
  assert.equal(h.isItems, true);
  assert.equal(h.items.size, 0);
});

test("loadHabits reads the hidden item suggestions", async () => {
  const p = plugin({ list: { "운동.md": ["- [x] 2026-11-18 스쿼트\n", { items: true, hiddenItems: ["런지"] }] } });
  const [h] = await p.loadHabits("Habits");
  assert.deepEqual(h.hiddenItems, ["런지"]);
});

test("reminder titles become items only for habits with item logging on", async () => {
  const p = plugin({
    list: { "Workout.md": ["\n", { items: true }], "Read.md": ["\n"] },
    sync: { "Reminders log.md": ["- [x] 2026-11-18 Workout Squats\n- [x] 2026-11-18 Workout Plank 1 min\n- [x] 2026-11-19 Read Book\n"] },
  });
  const out = await p.loadHabits("Habits");
  const by = Object.fromEntries(out.map((h) => [h.name, h]));
  assert.deepEqual(by.Workout.items.get("2026-11-18"), ["Squats", "Plank 1 min"]);
  assert.equal(by.Workout.isItems, true);
  assert.equal(by.Read.isItems, false);
  assert.ok(by["Read Book"], "an ordinary title stays its own habit");
});

test("English reminder titles work as habits, amounts and items", async () => {
  const p = plugin({
    list: { "Workout.md": ["\n", { items: true }] },
    sync: { "Reminders log.md": [[
      "- [x] 2026-11-16 Meditate",
      "- [x] 2026-11-17 Meditate",
      "- [x] 2026-11-16 Study 2h",
      "- [x] 2026-11-17 Study 1h 30m",
      "- [x] 2026-11-18 Study 45 min",
      "- [x] 2026-11-16 Read 20 pages",
      "- [x] 2026-11-17 Run 5km",
      "- [x] 2026-11-18 Workout Squats",
      "- [x] 2026-11-18 Workout Pull-ups 3x8",
      "- [x] 2026-11-18 Meditate",
      "- [x] 2026-11-18 Meditate",
    ].join("\n") + "\n"] },
  });
  const out = await p.loadHabits("Habits");
  const by = Object.fromEntries(out.map((h) => [h.name, h]));
  assert.deepEqual(Object.keys(by).sort(), ["Meditate", "Read", "Run", "Study", "Workout"]);
  assert.deepEqual([...by.Meditate.set].sort(), ["2026-11-16", "2026-11-17", "2026-11-18"]);
  assert.equal(by.Study.unit, "시간");
  assert.deepEqual([...by.Study.entries], [["2026-11-16", 2], ["2026-11-17", 1.5], ["2026-11-18", 0.75]]);
  assert.equal(by.Read.unit, "쪽");
  assert.equal(by.Read.entries.get("2026-11-16"), 20);
  assert.equal(by.Run.unit, "km");
  assert.deepEqual(by.Workout.items.get("2026-11-18"), ["Squats", "Pull-ups 3x8"]);
});

test("an items habit stays items only: Workout 1h counts the day without an item or an amount", async () => {
  const p = plugin({
    list: { "Workout.md": ["\n", { items: true }] },
    sync: { "Reminders log.md": ["- [x] 2026-11-18 Workout Squats 30 reps\n- [x] 2026-11-19 Workout 1h\n"] },
  });
  const [h] = await p.loadHabits("Habits");
  assert.equal(h.kind, "check");
  assert.equal(h.isItems, true);
  assert.deepEqual(h.items.get("2026-11-18"), ["Squats 30 reps"]);
  assert.equal(h.items.has("2026-11-19"), false);
  assert.equal(h.set.has("2026-11-19"), true);
});

test("a habit with a unit is never an items habit", async () => {
  const p = plugin({ list: { "Workout.md": ["- [x] 2026-11-18 1h\n", { items: true, unit: "hours" }] } });
  const [h] = await p.loadHabits("Habits");
  assert.equal(h.kind, "measure");
  assert.equal(h.isItems, false);
  assert.equal(h.items, null);
});

test("Korean workout examples: 운동 스쿼트 30회 is an item, 운동 1h only counts the day", async () => {
  const p = plugin({
    list: { "운동.md": ["\n", { 항목: true }] },
    sync: { "Reminders log.md": ["- [x] 2026-11-18 운동 스쿼트 30회\n- [x] 2026-11-18 운동 플랭크 1분\n- [x] 2026-11-19 운동 1h\n"] },
  });
  const [h] = await p.loadHabits("Habits");
  assert.equal(h.kind, "check");
  assert.deepEqual(h.items.get("2026-11-18"), ["스쿼트 30회", "플랭크 1분"]);
  assert.equal(h.set.has("2026-11-19"), true);
});
