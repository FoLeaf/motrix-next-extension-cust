import {
  buildAddRequestFromCandidate,
  buildAddRequestFromDownload,
  cookieHeaderFromCookies,
  dedupeKeyForUrl,
  deriveIconState,
  iconKey,
  isSupportedDownloadUrl,
  normalizeSettings,
  normalizeUrlForMatch,
  requestHeadersToContext,
  resolveContextUrl,
  shouldInterceptDownload
} from "./shared.js";

export const IDLE_DISCONNECT_MS = 20000;
export const FALLBACK_ALARM_NAME = "motrix-progress-poll";
const REQUEST_CONTEXT_TTL_MS = 120000;
const REQUEST_CONTEXT_LIMIT = 400;
export const NATIVE_DOWNLOAD_DEDUPE_TTL_MS = 20000;
const NATIVE_DOWNLOAD_DEDUPE_LIMIT = 500;

let ws = null;
let idleDisconnectTimer = null;
let lastIconKey = "";
const iconCache = new Map();
const requestContextByUrl = new Map();
const nativeDownloadDedupeByUrl = new Map();

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "download-with-motrix",
      title: "Download with Motrix Next Opt",
      contexts: ["link", "image", "video", "audio", "page"]
    });
  });
}

function hasChromeRuntime() {
  return typeof chrome !== "undefined" && chrome.runtime && chrome.action;
}

function apiBase(settings) {
  return `http://127.0.0.1:${settings.port}`;
}

function wsBase(settings) {
  return `ws://127.0.0.1:${settings.port}`;
}

async function readSettings() {
  return normalizeSettings(await chrome.storage.local.get(["port", "token", "interceptDownloads"]));
}

export async function setNativeDownloadUiForSettings(settings, chromeApi = chrome) {
  const shouldHideNativeUi = settings.interceptDownloads !== false && Boolean(settings.token);
  const enabled = !shouldHideNativeUi;
  if (!chromeApi?.downloads?.setUiOptions) return false;
  return new Promise((resolve) => {
    chromeApi.downloads.setUiOptions({ enabled }, () => {
      const error = chromeApi.runtime?.lastError;
      if (error) {
        console.warn("Motrix Next Opt could not update Chrome download UI:", error.message);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function applyNativeDownloadUiFromCurrentSettings() {
  const settings = await readSettings();
  await setNativeDownloadUiForSettings(settings);
}

async function fetchSnapshot(settings) {
  if (!settings.token) throw new Error("missing-token");
  const response = await fetch(`${apiBase(settings)}/tasks`, {
    headers: { Authorization: `Bearer ${settings.token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`tasks-${response.status}`);
  return response.json();
}

async function submitDownloadUrl(rawUrl) {
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!url || !isSupportedDownloadUrl(url)) return;
  const settings = await readSettings();
  if (!settings.token) {
    await setIdleIcon(false);
    return;
  }
  const ok = await submitAddRequest({ url }, settings);
  if (!ok) throw new Error("add-failed");
  await ensureConnected();
  void pollAfterSubmission(settings);
}

async function submitAddRequest(body, settings) {
  if (!settings.token) return false;
  const response = await fetch(`${apiBase(settings)}/add`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return response.ok;
}

async function pollAfterSubmission(settings, attempts = 12) {
  for (let i = 0; i < attempts; i += 1) {
    await sleep(1000);
    try {
      const snapshot = await fetchSnapshot(settings);
      await updateIconFromSnapshot(snapshot);
      const totals = snapshot.totals || {};
      const activeCount = Number(totals.numActive || 0) + Number(totals.numWaiting || 0);
      if (activeCount > 0) {
        await ensureConnected();
        return;
      }
    } catch {
      return;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rememberNativeSubmission(rawUrl, now = Date.now()) {
  const key = dedupeKeyForUrl(rawUrl);
  if (!key) return false;
  pruneNativeSubmissions(now);
  nativeDownloadDedupeByUrl.set(key, now);
  while (nativeDownloadDedupeByUrl.size > NATIVE_DOWNLOAD_DEDUPE_LIMIT) {
    const firstKey = nativeDownloadDedupeByUrl.keys().next().value;
    if (!firstKey) break;
    nativeDownloadDedupeByUrl.delete(firstKey);
  }
  return true;
}

function rememberNativeSubmissionForRequest(request, now = Date.now()) {
  rememberNativeSubmission(request.url, now);
  rememberNativeSubmission(request.finalUrl, now);
}

function pruneNativeSubmissions(now = Date.now()) {
  for (const [key, time] of nativeDownloadDedupeByUrl.entries()) {
    if (now - time > NATIVE_DOWNLOAD_DEDUPE_TTL_MS) {
      nativeDownloadDedupeByUrl.delete(key);
    }
  }
}

function isRecentlySubmittedUrl(rawUrl, now = Date.now()) {
  const key = dedupeKeyForUrl(rawUrl);
  if (!key) return false;
  pruneNativeSubmissions(now);
  const time = nativeDownloadDedupeByUrl.get(key);
  return Number.isFinite(time) && now - time <= NATIVE_DOWNLOAD_DEDUPE_TTL_MS;
}

function isRecentlySubmittedNativeDownload(downloadItem = {}, now = Date.now()) {
  return [downloadItem.finalUrl, downloadItem.url].some((url) => isRecentlySubmittedUrl(url, now));
}

export function __resetNativeDownloadDedupeForTest() {
  nativeDownloadDedupeByUrl.clear();
}

export const __nativeDownloadDedupeForTest = {
  rememberNativeSubmission,
  isRecentlySubmittedUrl,
  isRecentlySubmittedNativeDownload
};

function rememberRequestContext(details) {
  if (!isSupportedDownloadUrl(details.url)) return;
  pruneRequestContexts(Date.now());
  const context = {
    ...requestHeadersToContext(details.requestHeaders || []),
    url: details.url,
    tabId: details.tabId,
    time: Date.now()
  };
  const key = normalizeUrlForMatch(details.url);
  const entries = requestContextByUrl.get(key) || [];
  entries.push(context);
  requestContextByUrl.set(key, entries.slice(-6));

  while (requestContextCount() > REQUEST_CONTEXT_LIMIT) {
    const firstKey = requestContextByUrl.keys().next().value;
    if (!firstKey) break;
    requestContextByUrl.delete(firstKey);
  }
}

function requestContextCount() {
  let count = 0;
  for (const entries of requestContextByUrl.values()) count += entries.length;
  return count;
}

function pruneRequestContexts(now) {
  for (const [key, entries] of requestContextByUrl.entries()) {
    const kept = entries.filter((entry) => now - entry.time <= REQUEST_CONTEXT_TTL_MS);
    if (kept.length > 0) {
      requestContextByUrl.set(key, kept);
    } else {
      requestContextByUrl.delete(key);
    }
  }
}

function findRequestContext(downloadItem) {
  pruneRequestContexts(Date.now());
  const candidates = [
    normalizeUrlForMatch(downloadItem.finalUrl),
    normalizeUrlForMatch(downloadItem.url)
  ].filter(Boolean);

  for (const key of candidates) {
    const entries = requestContextByUrl.get(key);
    if (!entries?.length) continue;
    return entries[entries.length - 1];
  }
  return {};
}

async function cookieHeaderForUrl(rawUrl) {
  if (!rawUrl || !chrome.cookies?.getAll) return "";
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url: rawUrl }, (cookies) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn("Motrix Next Opt could not read cookies:", error.message);
        resolve("");
      } else {
        resolve(cookieHeaderFromCookies(cookies || []));
      }
    });
  });
}

async function buildCandidateAddRequest(candidate) {
  const effectiveUrl = candidate.finalUrl || candidate.url || "";
  const requestContext = findRequestContext({
    url: candidate.url,
    finalUrl: candidate.finalUrl || candidate.url
  });
  const cookie = await cookieHeaderForUrl(effectiveUrl);
  return buildAddRequestFromCandidate(candidate, {
    ...requestContext,
    cookie: cookie || requestContext.cookie,
    referer: candidate.referer || requestContext.referer,
    userAgent: requestContext.userAgent || candidate.userAgent
  });
}

async function handleDownloadCandidate(candidate = {}) {
  const settings = await readSettings();
  if (settings.interceptDownloads === false) return { ok: false, reason: "disabled" };
  if (!settings.token) return { ok: false, reason: "missing-token" };

  const request = await buildCandidateAddRequest(candidate);
  const effectiveUrl = request.finalUrl || request.url;
  if (!request.url || !isSupportedDownloadUrl(effectiveUrl)) {
    return { ok: false, reason: "unsupported-url" };
  }

  if (isRecentlySubmittedUrl(effectiveUrl) || isRecentlySubmittedUrl(request.url)) {
    return { ok: true, deduped: true };
  }

  const ok = await submitAddRequest(request, settings).catch(() => false);
  if (!ok) return { ok: false, reason: "add-failed" };

  rememberNativeSubmissionForRequest(request);
  await ensureConnected();
  void pollAfterSubmission(settings);
  return { ok: true };
}

async function interceptNativeDownload(downloadItem) {
  const settings = await readSettings();
  if (!settings.token) return;
  if (!shouldInterceptDownload(downloadItem, settings)) return;

  if (isRecentlySubmittedNativeDownload(downloadItem)) {
    await cleanupChromeDownload(downloadItem.id);
    return;
  }

  let paused = false;
  try {
    await pauseChromeDownload(downloadItem.id);
    paused = true;
  } catch {
    paused = false;
  }

  const request = buildAddRequestFromDownload(downloadItem, findRequestContext(downloadItem));
  if (!request.url || !isSupportedDownloadUrl(request.finalUrl || request.url)) {
    if (paused) await resumeChromeDownload(downloadItem.id).catch(() => {});
    return;
  }

  const ok = await submitAddRequest(request, settings).catch(() => false);
  if (!ok) {
    if (paused) await resumeChromeDownload(downloadItem.id).catch(() => {});
    return;
  }

  rememberNativeSubmissionForRequest(request);
  await cleanupChromeDownload(downloadItem.id);
  await ensureConnected();
  void pollAfterSubmission(settings);
}

async function cleanupChromeDownload(id) {
  await pauseChromeDownload(id).catch(() => {});
  await cancelChromeDownload(id).catch(() => {});
  await eraseChromeDownload(id).catch(() => {});
}

function pauseChromeDownload(id) {
  return downloadCall("pause", id);
}

function resumeChromeDownload(id) {
  return downloadCall("resume", id);
}

function cancelChromeDownload(id) {
  return downloadCall("cancel", id);
}

function eraseChromeDownload(id) {
  return new Promise((resolve, reject) => {
    chrome.downloads.erase({ id }, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(items);
      }
    });
  });
}

function downloadCall(method, id) {
  return new Promise((resolve, reject) => {
    chrome.downloads[method](id, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}

async function setBadge(hasError) {
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  await chrome.action.setBadgeText({ text: hasError ? "!" : "" });
}

async function setIdleIcon(hasError = false) {
  const state = { mode: "idle", bucket: 0, hasError };
  const key = iconKey(state);
  if (lastIconKey !== key) {
    await chrome.action.setIcon({
      path: {
        16: "icons/icon16.png",
        32: "icons/icon32.png",
        48: "icons/icon48.png",
        128: "icons/icon128.png"
      }
    });
    lastIconKey = key;
  }
  await setBadge(hasError);
}

async function updateIconFromSnapshot(snapshot) {
  const state = deriveIconState(snapshot);
  const key = iconKey(state);
  if (state.mode === "idle") {
    await setIdleIcon(state.hasError);
    return;
  }
  if (lastIconKey !== key) {
    await chrome.action.setIcon({
      imageData: {
        16: getGeneratedIcon(16, state),
        32: getGeneratedIcon(32, state),
        48: getGeneratedIcon(48, state),
        128: getGeneratedIcon(128, state)
      }
    });
    lastIconKey = key;
  }
  await setBadge(state.hasError);
}

function getGeneratedIcon(size, state) {
  const key = `${size}:${iconKey(state)}`;
  if (!iconCache.has(key)) {
    iconCache.set(key, drawIcon(size, state));
  }
  return iconCache.get(key);
}

function drawIcon(size, state) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const scale = size / 128;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = "#111827";
  roundedRect(ctx, 18, 12, 92, 92, 22);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 50px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("M", 64, 57);

  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  roundedRect(ctx, 20, 102, 88, 10, 5);
  ctx.fill();

  if (state.mode === "active-known") {
    ctx.fillStyle = "#22c55e";
    roundedRect(ctx, 20, 102, Math.max(8, 88 * (state.bucket / 100)), 10, 5);
    ctx.fill();
  } else {
    ctx.fillStyle = "#38bdf8";
    roundedRect(ctx, 20, 102, 88, 10, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    for (let x = 14; x < 112; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 112);
      ctx.lineTo(x + 12, 102);
      ctx.stroke();
    }
  }

  if (state.hasError) {
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(99, 25, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return ctx.getImageData(0, 0, size, size);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clearIdleDisconnectTimer() {
  if (idleDisconnectTimer) {
    clearTimeout(idleDisconnectTimer);
    idleDisconnectTimer = null;
  }
}

function scheduleIdleDisconnect(snapshot) {
  clearIdleDisconnectTimer();
  const totals = snapshot?.totals || {};
  const activeCount = Number(totals.numActive || 0) + Number(totals.numWaiting || 0);
  if (activeCount > 0) return;
  idleDisconnectTimer = setTimeout(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "idle");
    }
    ws = null;
  }, IDLE_DISCONNECT_MS);
}

async function ensureConnected() {
  const settings = await readSettings();
  if (!settings.token) {
    await setIdleIcon(false);
    return;
  }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(`${wsBase(settings)}/events`);
  ws.addEventListener("open", () => {
    ws?.send(JSON.stringify({ type: "auth", token: settings.token }));
  });
  ws.addEventListener("message", async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "snapshot") {
      await updateIconFromSnapshot(message.snapshot);
      scheduleIdleDisconnect(message.snapshot);
    } else if (message.type === "error") {
      await setIdleIcon(false);
    }
  });
  ws.addEventListener("close", () => {
    clearIdleDisconnectTimer();
    ws = null;
  });
  ws.addEventListener("error", async () => {
    await setIdleIcon(false);
  });
}

async function pollOnce() {
  const settings = await readSettings();
  if (!settings.token) {
    await setIdleIcon(false);
    return;
  }
  try {
    const snapshot = await fetchSnapshot(settings);
    await updateIconFromSnapshot(snapshot);
    const totals = snapshot.totals || {};
    const activeCount = Number(totals.numActive || 0) + Number(totals.numWaiting || 0);
    if (activeCount > 0) await ensureConnected();
  } catch {
    await setIdleIcon(false);
  }
}

async function resetConnection() {
  clearIdleDisconnectTimer();
  if (ws) {
    ws.close(1000, "settings-updated");
    ws = null;
  }
  lastIconKey = "";
  await applyNativeDownloadUiFromCurrentSettings();
  await pollOnce();
}

async function bootstrap() {
  await chrome.alarms.create(FALLBACK_ALARM_NAME, { periodInMinutes: 1 });
  await applyNativeDownloadUiFromCurrentSettings();
  await setIdleIcon(false);
  await pollOnce();
}

if (hasChromeRuntime()) {
  chrome.runtime.onInstalled.addListener(() => {
    createContextMenus();
    void bootstrap();
  });
  chrome.runtime.onStartup.addListener(() => {
    void bootstrap();
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === FALLBACK_ALARM_NAME) void pollOnce();
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "download-with-motrix") {
      void submitDownloadUrl(resolveContextUrl(info, tab)).catch(() => setIdleIcon(false));
    }
  });
  chrome.webRequest.onBeforeSendHeaders.addListener(
    rememberRequestContext,
    { urls: ["http://*/*", "https://*/*"] },
    ["requestHeaders", "extraHeaders"]
  );
  chrome.downloads.onCreated.addListener((downloadItem) => {
    void interceptNativeDownload(downloadItem).catch(() => setIdleIcon(false));
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.interceptDownloads || changes.token || changes.port) {
      void applyNativeDownloadUiFromCurrentSettings();
    }
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "settingsUpdated") {
      resetConnection().then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message?.type === "wake") {
      ensureConnected().then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message?.type === "downloadCandidate") {
      handleDownloadCandidate(message.candidate)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, reason: error?.message || "failed" }));
      return true;
    }
    return false;
  });
  void bootstrap();
}
