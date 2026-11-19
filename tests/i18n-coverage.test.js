import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "src");
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".js") && !p.endsWith(path.join("src", "i18n.js"))) files.push(p);
  }
})(src);

test("every Korean tr() text has an English translation", () => {
  const i18n = readFileSync(path.join(src, "i18n.js"), "utf8");
  const table = i18n.slice(i18n.indexOf("export const EN = {"));
  const keys = new Set([...table.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1]));
  const missing = [];
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/\btr\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      if (/[가-힣]/.test(m[1]) && !keys.has(m[1])) missing.push(`${path.relative(src, f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
