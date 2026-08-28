import test from "node:test";
import assert from "node:assert/strict";
import { parseContentDispositionHeader, parseFirefoxDownloadResponse } from "../firefox-response.js";

test("parseFirefoxDownloadResponse accepts attachment responses", () => {
  const candidate = parseFirefoxDownloadResponse({
    url: "https://cdn.example.com/file.zip",
    method: "GET",
    type: "main_frame",
    statusCode: 200,
    originUrl: "https://example.com/page",
    responseHeaders: [
      { name: "Content-Disposition", value: 'attachment; filename="archive.zip"' },
      { name: "Content-Type", value: "application/zip" },
      { name: "Content-Length", value: "1024" }
    ]
  });

  assert.deepEqual(candidate, {
    url: "https://cdn.example.com/file.zip",
    finalUrl: "https://cdn.example.com/file.zip",
    filename: "archive.zip",
    fileSize: 1024,
    totalBytes: 1024,
    mime: "application/zip",
    referer: "https://example.com/page"
  });
});

test("parseFirefoxDownloadResponse ignores normal HTML pages", () => {
  const candidate = parseFirefoxDownloadResponse({
    url: "https://example.com/page",
    method: "GET",
    type: "main_frame",
    statusCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }]
  });

  assert.equal(candidate, null);
});

test("parseContentDispositionHeader decodes RFC 5987 filenames", () => {
  const parsed = parseContentDispositionHeader(
    "attachment; filename*=UTF-8''motrix%20next.zip"
  );
  assert.equal(parsed?.type, "attachment");
  assert.equal(parsed?.filename, "motrix next.zip");
});
