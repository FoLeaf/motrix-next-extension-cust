import test from "node:test";
import assert from "node:assert/strict";
import {
  __getCachedSettingsForTest,
  __nativeDownloadDedupeForTest,
  __resetNativeDownloadDedupeForTest,
  __setCachedSettingsForTest,
  interceptNativeDownload,
  killChromeDownloadSync,
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

test("killChromeDownloadSync fires pause cancel erase without awaiting", () => {
  const calls = [];
  const chromeApi = {
    runtime: {},
    downloads: {
      pause(id, cb) {
        calls.push(["pause", id]);
        cb();
      },
      cancel(id, cb) {
        calls.push(["cancel", id]);
        cb();
      },
      erase(query, cb) {
        calls.push(["erase", query]);
        cb([]);
      }
    }
  };

  killChromeDownloadSync(42, chromeApi);
  assert.deepEqual(calls, [
    ["pause", 42],
    ["cancel", 42],
    ["erase", { id: 42 }]
  ]);
});

test("interceptNativeDownload kills chrome item before any network when takeover enabled", async () => {
  __resetNativeDownloadDedupeForTest();
  __setCachedSettingsForTest({ port: 29110, token: "secret", interceptDownloads: true });

  const calls = [];
  const originalFetch = globalThis.fetch;
  let fetchStarted = false;
  globalThis.fetch = async () => {
    fetchStarted = true;
    return { ok: true, json: async () => ({}) };
  };

  globalThis.chrome = {
    runtime: {},
    downloads: {
      pause(id, cb) {
        calls.push(["pause", id, fetchStarted]);
        cb();
      },
      cancel(id, cb) {
        calls.push(["cancel", id, fetchStarted]);
        cb();
      },
      erase(query, cb) {
        calls.push(["erase", query.id, fetchStarted]);
        cb([]);
      }
    },
    storage: {
      local: {
        get: async () => ({ port: 29110, token: "secret", interceptDownloads: true })
      }
    },
    action: {
      setBadgeBackgroundColor: async () => {},
      setBadgeText: async () => {},
      setIcon: async () => {}
    }
  };

  try {
    const result = await interceptNativeDownload(
      { id: 7, url: "https://example.com/file.pdf", finalUrl: "https://example.com/file.pdf" },
      { settings: { port: 29110, token: "secret", interceptDownloads: true } }
    );
    assert.equal(result.ok, true);
    assert.equal(calls.length >= 3, true);
    assert.equal(calls[0][2], false);
    assert.equal(calls[1][2], false);
    assert.equal(calls[2][2], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached settings helpers round-trip for fast onCreated path", () => {
  __setCachedSettingsForTest({ port: 29200, token: "  abc  ", interceptDownloads: false });
  assert.deepEqual(__getCachedSettingsForTest(), {
    port: 29200,
    token: "abc",
    interceptDownloads: false
  });
});
