// Bundles every tests/*.test.js with esbuild (so src/ imports resolve) and runs them with node --test.
import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, ".test-build");
rmSync(out, { recursive: true, force: true });
const entries = readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.js")).map((f) => path.join(root, "tests", f));
await build({
  entryPoints: entries, outdir: out, bundle: true, platform: "node", format: "esm", outExtension: { ".js": ".mjs" },
  alias: { obsidian: path.join(root, "tests", "obsidian-stub.js") }, logLevel: "warning",
});
const files = readdirSync(out).map((f) => path.join(out, f));
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
