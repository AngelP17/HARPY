// Production guard: the exported site must not contain mock streams, fixtures, or demo data.
// Run after `next build`. Fails CI if any forbidden marker appears in the shipped bundle.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || "out";
const forbidden = [
  /MockStreamer/,
  /mock-streamer/i,
  /tests\/fixtures/,
  /NEXT_PUBLIC_DEMO_MODE/,
  /deterministic fallback/i,
  /synthetic track/i,
];
const skip = new Set(["cesium"]);
let hits = 0;
let files = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (p.endsWith(join("data", "v1"))) continue; // real data documents, checked separately
      walk(p);
    } else if (/\.(js|html|json|css|txt)$/.test(name)) {
      files++;
      const text = readFileSync(p, "utf8");
      for (const re of forbidden) {
        if (re.test(text)) {
          console.error(`forbidden marker ${re} in ${p}`);
          hits++;
        }
      }
    }
  }
}

walk(root);
if (files === 0) {
  console.error(`no files scanned under ${root}; did the build run?`);
  process.exit(1);
}
if (hits > 0) process.exit(1);
console.log(`no-mock guard: ${files} files clean`);
