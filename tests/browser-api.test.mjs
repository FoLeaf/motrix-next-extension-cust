import test from "node:test";
import assert from "node:assert/strict";
import { getActionApi, hasExtensionRuntime, isFirefox, webRequestHeaderExtraInfo } from "../browser-api.js";

test("webRequestHeaderExtraInfo omits extraHeaders on Firefox", () => {
  const originalBrowser = globalThis.browser;
  globalThis.browser = {
    runtime: {
      getBrowserInfo() {
        return Promise.resolve({ name: "Firefox" });
      }
    },
    action: {}
  };

  try {
    assert.deepEqual(webRequestHeaderExtraInfo(), ["requestHeaders"]);
    assert.equal(isFirefox(), true);
    assert.equal(hasExtensionRuntime(), true);
    assert.equal(getActionApi(), globalThis.browser.action);
  } finally {
    globalThis.browser = originalBrowser;
  }
});

test("webRequestHeaderExtraInfo includes extraHeaders on Chromium", () => {
  const originalBrowser = globalThis.browser;
  globalThis.browser = undefined;
  globalThis.chrome = {
    runtime: {},
    action: {}
  };

  try {
    assert.deepEqual(webRequestHeaderExtraInfo(), ["requestHeaders", "extraHeaders"]);
    assert.equal(isFirefox(), false);
    assert.equal(hasExtensionRuntime(), true);
  } finally {
    delete globalThis.chrome;
    globalThis.browser = originalBrowser;
  }
});
