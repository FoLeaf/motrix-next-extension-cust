import test from "node:test";
import assert from "node:assert/strict";
import {
  __nativeDownloadDedupeForTest,
  __resetNativeDownloadDedupeForTest,
  setNativeDownloadUiForSettings
} from "../background.js";

test("setNativeDownloadUiForSettings hides Chrome UI only when interception is configured", async () => {
  const calls = [];
  const chromeApi = {
    runtime: {},
    downloads: {
      setUiOptions(options, callback) {
        calls.push(options);
        callback();
      }
    }
  };

  assert.equal(
    await setNativeDownloadUiForSettings({ interceptDownloads: true, token: "secret" }, chromeApi),
    true
  );
  assert.equal(
    await setNativeDownloadUiForSettings({ interceptDownloads: false, token: "secret" }, chromeApi),
    true
  );
  assert.equal(
    await setNativeDownloadUiForSettings({ interceptDownloads: true, token: "" }, chromeApi),
    true
  );

  assert.deepEqual(calls, [{ enabled: false }, { enabled: true }, { enabled: true }]);
});

test("native download dedupe matches original or final URL during the TTL", () => {
  __resetNativeDownloadDedupeForTest();
  const now = 100000;
  __nativeDownloadDedupeForTest.rememberNativeSubmission("https://example.com/file.zip#frag", now);

  assert.equal(
    __nativeDownloadDedupeForTest.isRecentlySubmittedNativeDownload(
      { url: "https://example.com/file.zip" },
      now + 1000
    ),
    true
  );
  assert.equal(
    __nativeDownloadDedupeForTest.isRecentlySubmittedNativeDownload(
      { finalUrl: "https://example.com/other.zip", url: "https://example.com/file.zip" },
      now + 1000
    ),
    true
  );
  assert.equal(
    __nativeDownloadDedupeForTest.isRecentlySubmittedUrl("https://example.com/file.zip", now + 30000),
    false
  );
});
