/** Cross-browser WebExtension API helpers (Chrome / Edge / Firefox). */

export function getBrowserApi() {
  return globalThis.browser ?? globalThis.chrome;
}

export function isFirefox() {
  return typeof getBrowserApi()?.runtime?.getBrowserInfo === "function";
}

export function getActionApi() {
  const api = getBrowserApi();
  return api?.action ?? api?.browserAction ?? null;
}

export function hasExtensionRuntime() {
  return Boolean(getBrowserApi()?.runtime && getActionApi());
}

export function webRequestHeaderExtraInfo() {
  // Chromium-only; Firefox rejects listener registration when extraHeaders is included.
  return isFirefox() ? ["requestHeaders"] : ["requestHeaders", "extraHeaders"];
}

export function createBrowserApiProxy() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const api = getBrowserApi();
        const value = api?.[prop];
        if (typeof value === "function") return value.bind(api);
        return value;
      }
    }
  );
}

export function createActionApiProxy() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const api = getActionApi();
        const value = api?.[prop];
        if (typeof value === "function") return value.bind(api);
        return value;
      }
    }
  );
}
