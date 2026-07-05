import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAddRequestFromCandidate,
  buildAddRequestFromDownload,
  buildTaskActionBody,
  cookieHeaderFromCookies,
  dedupeKeyForUrl,
  deriveIconState,
  iconKey,
  isDownloadLikeLink,
  normalizeSettings,
  progressBucket,
  requestHeadersToContext,
  resolveContextUrl,
  shouldInterceptDownload,
  sortTasksByCreatedDesc
} from "../shared.js";

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("progressBucket throttles icon updates to 5 percent buckets", () => {
  assert.equal(progressBucket(0), 0);
  assert.equal(progressBucket(2), 0);
  assert.equal(progressBucket(3), 5);
  assert.equal(progressBucket(52), 50);
  assert.equal(progressBucket(53), 55);
  assert.equal(progressBucket(100), 100);
});

test("deriveIconState returns idle when no active or waiting tasks exist", () => {
  const state = deriveIconState({
    totals: { numActive: 0, numWaiting: 0, progress: 0, hasUnknownSize: false },
    tasks: []
  });
  assert.deepEqual(state, { mode: "idle", bucket: 0, hasError: false });
  assert.equal(iconKey(state), "idle:0:ok");
});

test("deriveIconState returns known progress state for active known-size tasks", () => {
  const state = deriveIconState({
    totals: { numActive: 1, numWaiting: 0, progress: 47, hasUnknownSize: false },
    tasks: []
  });
  assert.deepEqual(state, { mode: "active-known", bucket: 45, hasError: false });
});

test("deriveIconState avoids fake percentage when any active task has unknown size", () => {
  const state = deriveIconState({
    totals: { numActive: 1, numWaiting: 0, progress: 70, hasUnknownSize: true },
    tasks: []
  });
  assert.deepEqual(state, { mode: "active-unknown", bucket: 0, hasError: false });
});

test("deriveIconState carries error badge state from totals or tasks", () => {
  assert.equal(
    deriveIconState({
      totals: { numActive: 0, numWaiting: 0, hasError: true },
      tasks: []
    }).hasError,
    true
  );
  assert.equal(
    deriveIconState({
      totals: { numActive: 0, numWaiting: 0, hasError: false },
      tasks: [{ status: "error" }]
    }).hasError,
    true
  );
});

test("normalizeSettings defaults invalid ports and trims token", () => {
  assert.deepEqual(normalizeSettings({ port: "not-a-port", token: "  secret  " }), {
    port: 29110,
    token: "secret",
    interceptDownloads: true
  });
  assert.deepEqual(normalizeSettings({ port: "29200", token: "" }), {
    port: 29200,
    token: "",
    interceptDownloads: true
  });
  assert.deepEqual(normalizeSettings({ port: "29200", token: "", interceptDownloads: false }), {
    port: 29200,
    token: "",
    interceptDownloads: false
  });
});

test("buildTaskActionBody sends only gid and action", () => {
  assert.equal(buildTaskActionBody("abc123", "open"), '{"gid":"abc123","action":"open"}');
});

test("sortTasksByCreatedDesc keeps extension list aligned with newest Motrix tasks first", () => {
  assert.deepEqual(
    sortTasksByCreatedDesc([
      { gid: "old", addedAt: "2026-01-01T00:00:00Z" },
      { gid: "missing" },
      { gid: "new", addedAt: "2026-06-01T00:00:00Z" }
    ]).map((task) => task.gid),
    ["new", "old", "missing"]
  );
});

test("resolveContextUrl prefers link and media URLs over page URL", () => {
  assert.equal(
    resolveContextUrl({ linkUrl: "https://example.com/file.zip", pageUrl: "https://example.com" }, {}),
    "https://example.com/file.zip"
  );
  assert.equal(
    resolveContextUrl({ srcUrl: "https://cdn.example.com/video.mp4" }, { url: "https://example.com" }),
    "https://cdn.example.com/video.mp4"
  );
});

test("shouldInterceptDownload catches native Chrome http downloads by default", () => {
  assert.equal(shouldInterceptDownload({ url: "https://example.com/file.zip" }, normalizeSettings({})), true);
  assert.equal(
    shouldInterceptDownload(
      { url: "https://example.com/file.zip" },
      normalizeSettings({ interceptDownloads: false })
    ),
    false
  );
  assert.equal(shouldInterceptDownload({ url: "blob:https://example.com/1" }, normalizeSettings({})), false);
  assert.equal(
    shouldInterceptDownload({ url: "https://example.com/file.zip", byExtensionId: "other" }, normalizeSettings({})),
    false
  );
});

test("isDownloadLikeLink recognizes explicit and common direct download links", () => {
  assert.equal(isDownloadLikeLink("https://example.com/download", { download: true }), true);
  assert.equal(isDownloadLikeLink("https://example.com/file.exe"), true);
  assert.equal(isDownloadLikeLink("https://example.com/file.msi?token=abc"), true);
  assert.equal(isDownloadLikeLink("https://example.com/archive.7z#part"), true);
  assert.equal(isDownloadLikeLink("https://example.com/linux.iso"), true);
  assert.equal(isDownloadLikeLink("https://example.com/app.apk"), true);
});

test("isDownloadLikeLink avoids normal navigation and non-web URLs", () => {
  assert.equal(isDownloadLikeLink("https://example.com/docs/page.html"), false);
  assert.equal(isDownloadLikeLink("https://example.com/view"), false);
  assert.equal(isDownloadLikeLink("blob:https://example.com/1", { download: true }), false);
  assert.equal(isDownloadLikeLink("data:application/octet-stream,abc", { download: true }), false);
});

test("requestHeadersToContext separates sensitive browser context without authorization", () => {
  const context = requestHeadersToContext([
    { name: "Cookie", value: "sid=abc" },
    { name: "Referer", value: "https://example.com/page" },
    { name: "User-Agent", value: "BrowserUA" },
    { name: "Accept", value: "application/octet-stream" },
    { name: "Authorization", value: "Bearer secret" }
  ]);
  assert.deepEqual(context, {
    cookie: "sid=abc",
    referer: "https://example.com/page",
    userAgent: "BrowserUA",
    requestHeaders: [{ name: "Accept", value: "application/octet-stream" }]
  });
});

test("cookieHeaderFromCookies builds browser cookie header including httpOnly values", () => {
  const header = cookieHeaderFromCookies([
    { name: "root", value: "a", path: "/" },
    { name: "sid", value: "abc", path: "/account", httpOnly: true },
    { name: "", value: "ignored", path: "/" }
  ]);
  assert.equal(header, "sid=abc; root=a");
});

test("buildAddRequestFromCandidate forwards only safe candidate context", () => {
  const request = buildAddRequestFromCandidate(
    {
      url: "https://example.com/download",
      filename: "file.zip",
      referer: "https://example.com/page",
      userAgent: "BrowserUA",
      authorization: "Bearer secret"
    },
    {
      cookie: "sid=abc",
      requestHeaders: [
        { name: "Accept", value: "application/octet-stream" },
        { name: "Authorization", value: "Bearer secret" }
      ]
    }
  );
  assert.deepEqual(request, {
    url: "https://example.com/download",
    referer: "https://example.com/page",
    cookie: "sid=abc",
    userAgent: "BrowserUA",
    requestHeaders: [{ name: "Accept", value: "application/octet-stream" }],
    filename: "file.zip"
  });
  assert.equal(Object.hasOwn(request, "authorization"), false);
});

test("dedupeKeyForUrl ignores fragments and normalizes host casing", () => {
  assert.equal(
    dedupeKeyForUrl("HTTPS://Example.COM/file.zip#download"),
    "https://example.com/file.zip"
  );
});

test("buildAddRequestFromDownload forwards finalUrl and basename filename", () => {
  const request = buildAddRequestFromDownload(
    {
      url: "https://example.com/redirect",
      finalUrl: "https://cdn.example.com/file.zip",
      filename: "C:\\Users\\me\\Downloads\\file.zip"
    },
    { cookie: "sid=abc", requestHeaders: [{ name: "Accept", value: "*/*" }] }
  );
  assert.deepEqual(request, {
    url: "https://example.com/redirect",
    finalUrl: "https://cdn.example.com/file.zip",
    cookie: "sid=abc",
    requestHeaders: [{ name: "Accept", value: "*/*" }],
    filename: "file.zip"
  });
});

test("manifest declares native download interception permissions", () => {
  const manifest = JSON.parse(readFileSync(join(extensionRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.permissions.includes("downloads"), true);
  assert.equal(manifest.permissions.includes("downloads.ui"), true);
  assert.equal(manifest.permissions.includes("cookies"), true);
  assert.equal(manifest.permissions.includes("webRequest"), true);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), true);
  assert.deepEqual(manifest.content_scripts?.[0]?.matches, ["http://*/*", "https://*/*"]);
  assert.deepEqual(manifest.content_scripts?.[0]?.js, ["content.js"]);
});
