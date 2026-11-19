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
      "Study.md": ["- [x] 2026-11-18 1h30m\n", { unit: "hours", monthGoals: { "2026-11": 2 }, weeklyTimes: { "2026-11": 4 } }],
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
