import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2];

if (target !== "firefox" && target !== "chromium") {
  console.error("Usage: node scripts/use-manifest.mjs <firefox|chromium>");
  process.exit(1);
}

copyFileSync(join(root, `manifest.${target}.json`), join(root, "manifest.json"));
console.log(`manifest.json updated from manifest.${target}.json`);
