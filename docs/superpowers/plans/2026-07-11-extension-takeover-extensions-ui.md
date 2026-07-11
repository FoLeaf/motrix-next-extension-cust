# Expanded Download Extension Takeover + Popup UI Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the content-script pre-intercept whitelist for common download suffixes and harden the popup so long filenames/paths never break layout.

**Architecture:** Package one logical extension list twice — ESM `download-extensions-data.js` for `shared.js`/tests, classic `content-download-extensions.js` injecting `globalThis.MOTRIX_DOWNLOAD_EXTENSIONS` for content scripts. A unit test asserts both lists match. Popup CSS/JS only change presentation (`ellipsis` + `title`), not API payloads.

**Tech Stack:** Chrome MV3 plain JS (ESM background/popup, classic content scripts), Node `node:test` via `npm test`.

**Spec:** `docs/superpowers/specs/2026-07-11-extension-takeover-extensions-ui-design.md`  
**中文规格:** `docs/superpowers/specs/2026-07-11-extension-takeover-extensions-ui-design.zh-CN.md`

## Global Constraints

- Chrome/Edge minimum remains **116** (no module content scripts).
- No new manifest permissions.
- Authorization headers must never be forwarded (unchanged).
- Do not truncate filenames sent to Motrix `/add`.
- Content scripts stay classic non-module; dual list packaging is intentional.
- Working directory for all commands: `motrix-next-extension-cust` (repo root of the extension).
- Test command: `npm test` (runs `node --test __tests__/*.mjs`).

## File map

| File | Responsibility |
|------|----------------|
| `download-extensions-data.js` | **Create** — ESM frozen array of lowercase extensions |
| `content-download-extensions.js` | **Create** — classic script setting `globalThis.MOTRIX_DOWNLOAD_EXTENSIONS` |
| `shared.js` | **Modify** — import list; drop inline Set |
| `content.js` | **Modify** — use global Set |
| `manifest.json` | **Modify** — inject classic list before `content.js` |
| `popup.css` | **Modify** — min-width/ellipsis hardening |
| `popup.js` | **Modify** — set `title` on name/path |
| `__tests__/shared.test.mjs` | **Modify** — new cases + list-sync + manifest order |

---

### Task 1: ESM extension list + shared import + failing tests first

**Files:**
- Create: `download-extensions-data.js`
- Modify: `shared.js` (replace inline `DOWNLOAD_FILE_EXTENSIONS`)
- Modify: `__tests__/shared.test.mjs`
- Test: `__tests__/shared.test.mjs`

**Interfaces:**
- Produces: `export const DOWNLOAD_FILE_EXTENSIONS_LIST` — `ReadonlyArray<string>` (frozen), lowercase, no dots
- Produces: `shared.js` still exports `DOWNLOAD_FILE_EXTENSIONS` as `Set<string>` built from that list
- Consumes: nothing new

- [ ] **Step 1: Write failing tests for expanded whitelist and non-targets**

Append to `__tests__/shared.test.mjs` (keep existing imports; add `DOWNLOAD_FILE_EXTENSIONS` and `DOWNLOAD_FILE_EXTENSIONS_LIST` if needed):

```js
import { DOWNLOAD_FILE_EXTENSIONS_LIST } from "../download-extensions-data.js";
import {
  // existing imports...
  DOWNLOAD_FILE_EXTENSIONS,
  isDownloadLikeLink
} from "../shared.js";

test("isDownloadLikeLink recognizes expanded common download extensions", () => {
  assert.equal(isDownloadLikeLink("https://example.com/report.pdf"), true);
  assert.equal(isDownloadLikeLink("https://example.com/movie.mkv"), true);
  assert.equal(isDownloadLikeLink("https://example.com/sheet.docx"), true);
  assert.equal(isDownloadLikeLink("https://example.com/pack.zst"), true);
  assert.equal(isDownloadLikeLink("https://cdn.example.com/audio.flac?token=1"), true);
  assert.equal(isDownloadLikeLink("https://example.com/model.gguf"), true);
});

test("isDownloadLikeLink still avoids navigation and web asset suffixes", () => {
  assert.equal(isDownloadLikeLink("https://example.com/docs/page.html"), false);
  assert.equal(isDownloadLikeLink("https://example.com/api.json"), false);
  assert.equal(isDownloadLikeLink("https://example.com/style.css"), false);
  assert.equal(isDownloadLikeLink("https://example.com/app.js"), false);
  assert.equal(isDownloadLikeLink("https://example.com/icon.svg"), false);
});

test("DOWNLOAD_FILE_EXTENSIONS is built from the shared data list", () => {
  assert.equal(DOWNLOAD_FILE_EXTENSIONS instanceof Set, true);
  assert.deepEqual(
    [...DOWNLOAD_FILE_EXTENSIONS].sort(),
    [...DOWNLOAD_FILE_EXTENSIONS_LIST].sort()
  );
  assert.equal(DOWNLOAD_FILE_EXTENSIONS.has("pdf"), true);
  assert.equal(DOWNLOAD_FILE_EXTENSIONS.has("html"), false);
});
```

Also update the existing test `"isDownloadLikeLink recognizes explicit and common direct download links"` if it still passes with current list (it should — do not remove it).

- [ ] **Step 2: Run tests to verify new ones fail**

Run:

```bash
npm test
```

Expected: FAIL — `download-extensions-data.js` missing and/or `pdf`/`mkv` not recognized / `DOWNLOAD_FILE_EXTENSIONS_LIST` not exported.

- [ ] **Step 3: Create `download-extensions-data.js`**

Create `download-extensions-data.js`:

```js
export const DOWNLOAD_FILE_EXTENSIONS_LIST = Object.freeze([
  // existing
  "7z",
  "apk",
  "appx",
  "bin",
  "bz2",
  "deb",
  "dmg",
  "exe",
  "gz",
  "iso",
  "msi",
  "msix",
  "pkg",
  "rar",
  "rpm",
  "tar",
  "torrent",
  "xz",
  "zip",
  // archive
  "zipx",
  "zst",
  "lz",
  "lzma",
  "cab",
  "arj",
  "lzh",
  "lha",
  // documents
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "epub",
  "mobi",
  "djvu",
  "rtf",
  "odt",
  "ods",
  "odp",
  "txt",
  "csv",
  // audio / video
  "mp3",
  "mp4",
  "m4a",
  "m4v",
  "mkv",
  "avi",
  "mov",
  "webm",
  "flac",
  "wav",
  "aac",
  "ogg",
  "opus",
  "wmv",
  "mpg",
  "mpeg",
  "ts",
  "m2ts",
  // disk / image
  "img",
  "vhd",
  "vhdx",
  "vmdk",
  "wim",
  "esd",
  // packages
  "jar",
  "war",
  "ear",
  "nupkg",
  "vsix",
  "crx",
  "xpi",
  // fonts / design
  "ttf",
  "otf",
  "woff",
  "woff2",
  "psd",
  "ai",
  "sketch",
  "fig",
  // data / models
  "sqlite",
  "db",
  "parquet",
  "avro",
  "onnx",
  "gguf",
  "safetensors",
  "pth",
  "pt",
  // subtitles
  "srt",
  "ass",
  "vtt",
  "sub"
]);
```

- [ ] **Step 4: Wire `shared.js` to the data module**

In `shared.js`, replace:

```js
export const DOWNLOAD_FILE_EXTENSIONS = new Set([
  "7z",
  // ... entire old list ...
  "zip"
]);
```

with:

```js
import { DOWNLOAD_FILE_EXTENSIONS_LIST } from "./download-extensions-data.js";

export const DOWNLOAD_FILE_EXTENSIONS = new Set(DOWNLOAD_FILE_EXTENSIONS_LIST);
```

Keep all other exports and functions unchanged. Place the import at the top of the file with other imports (this file currently has no imports — add as first lines).

- [ ] **Step 5: Run tests to verify Task 1 tests pass**

Run:

```bash
npm test
```

Expected: PASS for the new whitelist tests (list-sync with content may still be absent until Task 2).

- [ ] **Step 6: Commit**

```bash
git add download-extensions-data.js shared.js __tests__/shared.test.mjs
git commit -m "feat: expand shared download extension whitelist from data module"
```

---

### Task 2: Classic content inject + content.js + list sync test

**Files:**
- Create: `content-download-extensions.js`
- Modify: `content.js`
- Modify: `manifest.json`
- Modify: `__tests__/shared.test.mjs`
- Test: `__tests__/shared.test.mjs`

**Interfaces:**
- Consumes: same membership as `DOWNLOAD_FILE_EXTENSIONS_LIST`
- Produces: `globalThis.MOTRIX_DOWNLOAD_EXTENSIONS` as `Set<string>` in content world
- Produces: `content.js` reads that Set (fallback empty Set)

- [ ] **Step 1: Write failing list-sync and manifest tests**

Append to `__tests__/shared.test.mjs`:

```js
function extractQuotedStringsFromSetLiteral(source) {
  const match = source.match(/new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
  assert.ok(match, "expected new Set([ ... ]) in content-download-extensions.js");
  return [...match[1].matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]).sort();
}

test("content-download-extensions list matches download-extensions-data list", () => {
  const classicSource = readFileSync(join(extensionRoot, "content-download-extensions.js"), "utf8");
  const classic = extractQuotedStringsFromSetLiteral(classicSource);
  const shared = [...DOWNLOAD_FILE_EXTENSIONS_LIST].slice().sort();
  assert.deepEqual(classic, shared);
});

test("manifest injects content download extensions before content.js", () => {
  const manifest = JSON.parse(readFileSync(join(extensionRoot, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.content_scripts?.[0]?.js, [
    "content-download-extensions.js",
    "content.js"
  ]);
});
```

(`readFileSync`, `join`, `extensionRoot` already exist in this test file.)

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test
```

Expected: FAIL — missing `content-download-extensions.js` and/or wrong manifest js array.

- [ ] **Step 3: Create `content-download-extensions.js`**

Create `content-download-extensions.js` with **exactly the same extensions** as `download-extensions-data.js` (copy the array contents into the Set):

```js
globalThis.MOTRIX_DOWNLOAD_EXTENSIONS = new Set([
  "7z",
  "apk",
  "appx",
  "bin",
  "bz2",
  "deb",
  "dmg",
  "exe",
  "gz",
  "iso",
  "msi",
  "msix",
  "pkg",
  "rar",
  "rpm",
  "tar",
  "torrent",
  "xz",
  "zip",
  "zipx",
  "zst",
  "lz",
  "lzma",
  "cab",
  "arj",
  "lzh",
  "lha",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "epub",
  "mobi",
  "djvu",
  "rtf",
  "odt",
  "ods",
  "odp",
  "txt",
  "csv",
  "mp3",
  "mp4",
  "m4a",
  "m4v",
  "mkv",
  "avi",
  "mov",
  "webm",
  "flac",
  "wav",
  "aac",
  "ogg",
  "opus",
  "wmv",
  "mpg",
  "mpeg",
  "ts",
  "m2ts",
  "img",
  "vhd",
  "vhdx",
  "vmdk",
  "wim",
  "esd",
  "jar",
  "war",
  "ear",
  "nupkg",
  "vsix",
  "crx",
  "xpi",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "psd",
  "ai",
  "sketch",
  "fig",
  "sqlite",
  "db",
  "parquet",
  "avro",
  "onnx",
  "gguf",
  "safetensors",
  "pth",
  "pt",
  "srt",
  "ass",
  "vtt",
  "sub"
]);
```

- [ ] **Step 4: Update `content.js` to use the global Set**

Replace the top of `content.js` from the IIFE start through the local Set definition:

```js
(() => {
  const DOWNLOAD_EXTENSIONS = new Set([
    "7z",
    // ... old list ...
    "zip"
  ]);
  const FALLBACK_DELAY_MS = 4000;
```

with:

```js
(() => {
  const DOWNLOAD_EXTENSIONS =
    globalThis.MOTRIX_DOWNLOAD_EXTENSIONS instanceof Set
      ? globalThis.MOTRIX_DOWNLOAD_EXTENSIONS
      : new Set();
  const FALLBACK_DELAY_MS = 4000;
```

Leave the rest of `content.js` unchanged (`isDownloadLikeLink` still uses `DOWNLOAD_EXTENSIONS.has(extension)`).

- [ ] **Step 5: Update `manifest.json` content_scripts**

Change:

```json
"js": ["content.js"]
```

to:

```json
"js": ["content-download-extensions.js", "content.js"]
```

Leave `matches` and `run_at` unchanged.

- [ ] **Step 6: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests PASS, including list sync and manifest order.

- [ ] **Step 7: Commit**

```bash
git add content-download-extensions.js content.js manifest.json __tests__/shared.test.mjs
git commit -m "feat: inject shared download extensions into content pre-intercept"
```

---

### Task 3: Popup long filename / path UI hardening

**Files:**
- Modify: `popup.css`
- Modify: `popup.js` (`renderTask`)
- Test: manual + ensure `npm test` still green (no automated CSS tests in this repo)

**Interfaces:**
- Consumes: `task.name`, `task.gid`, `task.targetPath`, `task.dir` from snapshot (unchanged)
- Produces: DOM `title` attributes on `.task-name` and `.task-path`; CSS ellipsis only

- [ ] **Step 1: Harden `popup.css` overflow chain**

Ensure these rules exist (merge with existing selectors; do not remove other styles):

```css
.task {
  min-width: 0;
  overflow: hidden;
  padding: 10px;
}

.task-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.task-name,
.task-path,
.task-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta > * {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-name {
  font-weight: 680;
}

.task-path {
  margin-top: 6px;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
```

If `.task` already has `padding: 10px` only, add `min-width: 0` and `overflow: hidden` without duplicating the whole block twice — edit the existing `.task` rule.

Also ensure `.task-list` and `.shell` keep horizontal overflow contained:

```css
.task-list {
  display: grid;
  gap: 8px;
  padding-right: 2px;
  min-width: 0;
  overflow-x: hidden;
}
```

- [ ] **Step 2: Set full-text `title` in `popup.js`**

In `renderTask`, replace:

```js
  node.querySelector(".task-name").textContent = task.name || task.gid;
```

with:

```js
  const name = task.name || task.gid;
  const nameEl = node.querySelector(".task-name");
  nameEl.textContent = name;
  nameEl.title = name;
```

And replace:

```js
  node.querySelector(".task-path").textContent = task.targetPath || task.dir || "";
```

with:

```js
  const path = task.targetPath || task.dir || "";
  const pathEl = node.querySelector(".task-path");
  pathEl.textContent = path;
  pathEl.title = path;
```

Do not change API calls or truncate `name`/`path` strings before display assignment.

- [ ] **Step 3: Run automated tests (regression)**

Run:

```bash
npm test
```

Expected: PASS (no behavioral change to shared helpers).

- [ ] **Step 4: Manual smoke checklist (document in commit body if useful)**

1. Load unpacked extension from repo root in Chrome/Edge.
2. Confirm popup opens and existing tasks render.
3. If a long-named task exists (or temporarily mock long `task.name` / `task.targetPath` in DevTools), verify no horizontal popup growth and hover shows full text.

- [ ] **Step 5: Commit**

```bash
git add popup.css popup.js
git commit -m "fix: keep long task names and paths from breaking popup layout"
```

---

### Task 4: README note + final verification

**Files:**
- Modify: `README.md` (Features bullet only)
- Test: `npm test`

- [ ] **Step 1: Update README feature bullet**

In `README.md`, update the first feature bullet from something like “Intercepts common download clicks…” to mention the broader whitelist, e.g.:

```markdown
- Intercepts common download clicks from content scripts before Chrome creates a native download item (expanded extension whitelist: archives, documents, media, disk images, packages, and more).
```

Keep other bullets unchanged.

- [ ] **Step 2: Full test run**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: note expanded content-script download extension whitelist"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Expand common extensions list | Task 1 |
| Dual packaging ESM + classic | Tasks 1–2 |
| List sync automated test | Task 2 |
| manifest inject order | Task 2 |
| content.js uses global Set | Task 2 |
| Popup ellipsis / min-width | Task 3 |
| Popup `title` full text | Task 3 |
| No API filename truncation | Task 3 (explicit) |
| No new permissions / min Chrome 116 | All (no permission edits) |
| Non-targets html/json/css/js/svg | Task 1 tests |
| README optional note | Task 4 |
| Manual acceptance pdf/mkv/docx | Task 3 manual + operator after load |

## Out of scope (do not implement in this plan)

- Content-Disposition / MIME pre-intercept
- Middle-click / Ctrl+click / new-tab parity
- Authorization header forwarding
- blob:/data: takeover
