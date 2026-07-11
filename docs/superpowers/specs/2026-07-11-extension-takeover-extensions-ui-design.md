# Extension Takeover: Common Extensions + Long Filename UI

Date: 2026-07-11  
Repo: `motrix-next-extension-cust`  
Status: Approved for planning

## Problem

1. Content-script pre-interception only recognizes a short download-extension whitelist. Common types (pdf, mkv, docx, etc.) often miss pre-intercept, so Chromium still shows the native Save As / download path UI before `chrome.downloads.onCreated` cleanup can run.
2. Long task names and save paths break the popup layout (horizontal overflow / visual clutter) even though CSS already attempts ellipsis in some places.

## Goals

1. Reduce missed pre-intercepts for **common download file extensions**.
2. Keep a **single logical whitelist** for content-script and shared helpers, with automated consistency.
3. Fix popup display so long filenames/paths never break the 410px popup width; full text remains available via `title` tooltip.
4. Keep existing native-download fallback, security posture, and API contracts unchanged.

## Non-Goals (this round)

- Content-Disposition / extensionless URL detection
- Stronger interaction coverage (middle-click, new tab, keyboard, iframe-only flows)
- Broader cookie/header forwarding (Authorization remains excluded)
- blob:/data: download takeover
- Raising Chrome minimum version beyond current 116

## Approach

**Chosen:** Expand whitelist + dual packaging of one logical list + CSS/JS popup hardening.

Rejected for this round:

- Heuristic “any non-web extension” matching (too many false positives on navigation/API links)
- Dual lists with no mechanical consistency check (regression risk)
- Module content scripts (would raise min Chrome for little gain)

## Architecture

MV3 content scripts remain classic (non-module). Background/popup/tests use ESM. Therefore the logical list is packaged twice and locked by tests.

### Exact file structure

1. **`download-extensions-data.js`** (ESM)

   ```js
   export const DOWNLOAD_FILE_EXTENSIONS_LIST = Object.freeze([
     // lowercase extensions without dots; full list in Whitelist section
   ]);
   ```

2. **`shared.js`**

   ```js
   import { DOWNLOAD_FILE_EXTENSIONS_LIST } from "./download-extensions-data.js";
   export const DOWNLOAD_FILE_EXTENSIONS = new Set(DOWNLOAD_FILE_EXTENSIONS_LIST);
   ```

   Remove the previous inline `DOWNLOAD_FILE_EXTENSIONS` Set. `isDownloadLikeLink` continues to use the exported Set.

3. **`content-download-extensions.js`** (classic content inject)

   ```js
   globalThis.MOTRIX_DOWNLOAD_EXTENSIONS = new Set([
     // same membership as DOWNLOAD_FILE_EXTENSIONS_LIST
   ]);
   ```

   Hand-maintained once; unit test asserts sorted membership equals the ESM list.

4. **`manifest.json` content_scripts**

   ```json
   "js": ["content-download-extensions.js", "content.js"]
   ```

5. **`content.js`**

   - Remove local `DOWNLOAD_EXTENSIONS` set
   - Use `globalThis.MOTRIX_DOWNLOAD_EXTENSIONS` (fallback: empty Set)
   - Keep existing click rules: plain left click, `download` attribute OR extension match, preventDefault + candidate message + fallback open

6. **`popup.css` / `popup.js`**

   - Harden ellipsis chain for `.task`, `.task-head`, `.task-name`, `.task-path`, `.task-meta` children
   - Ensure `min-width: 0` on grid/flex children that hold text
   - After setting `textContent` for name/path, set `element.title` to the full string
   - Do **not** truncate filenames sent to Motrix API

## Extension whitelist

### Keep (existing)

`7z`, `apk`, `appx`, `bin`, `bz2`, `deb`, `dmg`, `exe`, `gz`, `iso`, `msi`, `msix`, `pkg`, `rar`, `rpm`, `tar`, `torrent`, `xz`, `zip`

### Add

| Category | Extensions |
|----------|------------|
| Archive | `zipx`, `zst`, `lz`, `lzma`, `cab`, `arj`, `lzh`, `lha` |
| Documents | `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `epub`, `mobi`, `djvu`, `rtf`, `odt`, `ods`, `odp`, `txt`, `csv` |
| Audio/Video | `mp3`, `mp4`, `m4a`, `m4v`, `mkv`, `avi`, `mov`, `webm`, `flac`, `wav`, `aac`, `ogg`, `opus`, `wmv`, `mpg`, `mpeg`, `ts`, `m2ts` |
| Disk/Image | `img`, `vhd`, `vhdx`, `vmdk`, `wim`, `esd` |
| Packages | `jar`, `war`, `ear`, `nupkg`, `vsix`, `crx`, `xpi` |
| Fonts/Design | `ttf`, `otf`, `woff`, `woff2`, `psd`, `ai`, `sketch`, `fig` |
| Data/Models | `sqlite`, `db`, `parquet`, `avro`, `onnx`, `gguf`, `safetensors`, `pth`, `pt` |
| Subtitles | `srt`, `ass`, `vtt`, `sub` |

### Explicit non-targets (remain non-intercepting by extension alone)

`html`, `htm`, `php`, `asp`, `aspx`, `jsp`, `do`, `action`, `cgi`, `js`, `mjs`, `cjs`, `css`, `map`, `json`, `xml`, `svg`

Notes:

- `download` HTML attribute still forces pre-intercept for http(s) links regardless of extension.
- Query strings and hashes continue to be stripped for filename/extension extraction via existing URL helpers.
- Compound names like `file.tar.gz` resolve to extension `gz` (existing basename/extension logic); `gz` is already listed.
- All stored values are lowercase with no leading dot.

## Data flow

### Pre-intercept (strengthened)

1. User plain-left-clicks an `<a href>`
2. Content resolves absolute URL and candidate filename
3. If `download` attribute present **or** extension ∈ whitelist → `preventDefault` / `stopImmediatePropagation`
4. Send `{ type: "downloadCandidate", candidate }` to background
5. Background builds add request (cookies/referer/UA/allowlisted headers), POSTs `/add`
6. On success: remember dedupe key, ensure WS/poll; on failure/timeout: content `fallbackOpen`

### Native fallback (unchanged)

`chrome.downloads.onCreated` → optional pause → `/add` → cancel/erase Chrome item when takeover enabled and URL supported.

### Popup long text

Snapshot task → render name/path with ellipsis CSS → set `title` to full string for hover.

## Error handling

| Case | Behavior |
|------|----------|
| Takeover disabled or missing token | No pre-submit; native path unchanged |
| Extension not in whitelist, no `download` attr | Browser default; native `onCreated` may still take over |
| Content list global missing | Empty set; only `download` attr pre-intercepts |
| Motrix `/add` fails | Resume native path via content fallback / resume download |
| Extremely long filename | Display truncated; API receives full name; no layout break |

## Testing

### Automated (`npm test`)

1. `isDownloadLikeLink("https://ex.com/a.pdf")` → true (and samples for mkv, docx, zst)
2. `isDownloadLikeLink("https://ex.com/page.html")` → false; same for `api.json`, `style.css`
3. Existing tests for `download` attribute, query strings, blob rejection remain green
4. **List sync test:** classic content inject list equals ESM data list (sorted)
5. Manifest `content_scripts[0].js` is `["content-download-extensions.js", "content.js"]`

### Manual acceptance

1. With Motrix Next Opt running and extension token configured, click direct links for pdf/mkv/docx → no Chromium Save As; task appears in Motrix/popup
2. Open popup with a task whose name and path exceed ~80 characters → card stays within popup width; hover shows full text
3. Navigation links (html pages) still navigate normally

## Security

- No new permissions
- Authorization headers still never forwarded
- Loopback-only Motrix control API unchanged
- Whitelist expansion only affects which clicks are pre-empted; native interceptor already accepts any http(s)/ftp download item

## Files touched

| File | Change |
|------|--------|
| `download-extensions-data.js` | **new** ESM list |
| `content-download-extensions.js` | **new** classic Set inject |
| `shared.js` | import list; remove local hardcoded set |
| `content.js` | use global set |
| `manifest.json` | inject classic list script first |
| `popup.css` | ellipsis / min-width hardening |
| `popup.js` | set `title` on name/path |
| `__tests__/shared.test.mjs` | new extension cases + list sync |
| `README.md` | optional brief note on expanded pre-intercept types |

## Out of scope follow-ups

- Content-Disposition / MIME-based pre-intercept
- Middle-click / Ctrl+click / target=_blank parity
- Richer request context for auth-gated downloads

## Success criteria

1. Common document/media/archive extensions pre-intercept when clicked as normal left-click links.
2. Logical whitelist stays consistent between content and shared via automated test.
3. Popup remains layout-stable for long filenames/paths.
4. All existing tests pass; new tests cover added extensions and non-targets.
