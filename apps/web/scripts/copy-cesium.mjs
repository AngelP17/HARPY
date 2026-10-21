// Copy Cesium's static runtime (workers, assets, widgets CSS) into public/cesium so the version
// always matches node_modules. public/cesium is gitignored.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cesiumRoot = dirname(require.resolve("cesium/package.json"));
const src = join(cesiumRoot, "Build", "Cesium");
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "cesium");

if (!existsSync(src)) {
  console.error(`Cesium build not found at ${src}`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const part of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(src, part), join(dest, part), { recursive: true });
}
console.log(`copied Cesium runtime -> ${dest}`);
