import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAC_SYNC_FILES } from "../src/macSyncFiles";

test("the bundled Mac sync files match scripts/ (run the build to regenerate)", () => {
  for (const [name, text] of Object.entries(MAC_SYNC_FILES)) {
    assert.equal(text, readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8"), name);
  }
  assert.deepEqual(Object.keys(MAC_SYNC_FILES).sort(), ["habit-log-sync.sh", "install-mac-sync.sh"]);
});

import { HabitGridPlugin } from "../src/plugin";
import { DEFAULT_SETTINGS } from "../src/constants";

test("createMacSyncFiles writes both files into <folder>/mac-sync and returns the command", async () => {
  const made = new Map(), folders = new Set();
  const p = new HabitGridPlugin();
  p.prefs = { ...DEFAULT_SETTINGS };
  p.app = { vault: {
    getAbstractFileByPath: (path) => (folders.has(path) || made.has(path) ? {} : null),
    createFolder: async (path) => { folders.add(path); },
    create: async (path, text) => { made.set(path, text); },
    modify: async () => {},
    adapter: { getBasePath: () => "/Users/me/My Vault" },
  } };
  const cmd = await p.createMacSyncFiles();
  assert.deepEqual([...made.keys()].sort(), ["habit-grid/mac-sync/habit-log-sync.sh", "habit-grid/mac-sync/install-mac-sync.sh"]);
  assert.equal(made.get("habit-grid/mac-sync/install-mac-sync.sh"), MAC_SYNC_FILES["install-mac-sync.sh"]);
  assert.equal(cmd, 'bash "/Users/me/My Vault/habit-grid/mac-sync/install-mac-sync.sh" "/Users/me/My Vault"');
});
