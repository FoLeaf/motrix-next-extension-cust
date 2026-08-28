import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".release");
const targets = [
  { browser: "chromium", artifact: "motrix-next-extension-chromium.zip" },
  { browser: "firefox", artifact: "motrix-next-extension-firefox.zip" }
];

const includePaths = [
  "background.js",
  "browser-api.js",
  "content.js",
  "content-download-extensions.js",
  "download-extensions-data.js",
  "firefox-response.js",
  "popup.js",
  "popup.html",
  "popup.css",
  "shared.js",
  "manifest.json",
  "icons"
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const { browser, artifact } of targets) {
  const stage = join(outDir, browser);
  mkdirSync(stage, { recursive: true });
  copyFileSync(join(root, `manifest.${browser}.json`), join(stage, "manifest.json"));
  for (const relativePath of includePaths) {
    if (relativePath === "manifest.json") continue;
    cpSync(join(root, relativePath), join(stage, relativePath), { recursive: true });
  }
  const zipPath = join(outDir, artifact);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-r", zipPath, "."], { cwd: stage, stdio: "inherit" });
  console.log(`Created ${artifact}`);
}

writeFileSync(
  join(outDir, "SHA256SUMS.txt"),
  targets
    .map(({ artifact }) => {
      const hash = execFileSync("sha256sum", [join(outDir, artifact)], { encoding: "utf8" }).trim();
      return hash;
    })
    .join("\n") + "\n"
);
