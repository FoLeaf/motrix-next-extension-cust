export const DEFAULT_PORT = 29110;
export const ICON_BUCKET_SIZE = 5;
export const DEFAULT_INTERCEPT_DOWNLOADS = true;
export const DOWNLOAD_FILE_EXTENSIONS = new Set([
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
  "zip"
]);
export const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "accept-language",
  "accept-encoding",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "upgrade-insecure-requests",
  "dnt",
  "origin"
]);

export function progressBucket(progress) {
  if (!Number.isFinite(progress)) return 0;
  const clamped = Math.min(100, Math.max(0, progress));
  return Math.round(clamped / ICON_BUCKET_SIZE) * ICON_BUCKET_SIZE;
}

export function normalizeSettings(input = {}) {
  const parsedPort = Number.parseInt(input.port, 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : DEFAULT_PORT;
  return {
    port,
    token: typeof input.token === "string" ? input.token.trim() : "",
    interceptDownloads: input.interceptDownloads !== false
  };
}

export function deriveIconState(snapshot) {
  const totals = snapshot?.totals || {};
  const activeCount = Number(totals.numActive || 0) + Number(totals.numWaiting || 0);
  const hasError = Boolean(totals.hasError || snapshot?.tasks?.some((task) => task.status === "error"));

  if (activeCount <= 0) {
    return { mode: "idle", bucket: 0, hasError };
  }
  if (totals.hasUnknownSize) {
    return { mode: "active-unknown", bucket: 0, hasError };
  }
  return {
    mode: "active-known",
    bucket: progressBucket(Number(totals.progress || 0)),
    hasError
  };
}

export function iconKey(iconState) {
  return `${iconState.mode}:${iconState.bucket}:${iconState.hasError ? "error" : "ok"}`;
}

export function buildTaskActionBody(gid, action) {
  return JSON.stringify({ gid, action });
}

export function sortTasksByCreatedDesc(tasks = []) {
  if (!Array.isArray(tasks)) return [];
  return tasks.slice().sort((a, b) => taskCreatedTime(b) - taskCreatedTime(a));
}

export function resolveContextUrl(info = {}, tab = {}) {
  return info.linkUrl || info.srcUrl || info.pageUrl || tab.url || "";
}

export function normalizeUrlForMatch(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") return "";
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function isSupportedDownloadUrl(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  return /^(https?|ftp):\/\//i.test(rawUrl.trim());
}

export function isPreInterceptableDownloadUrl(rawUrl) {
  if (typeof rawUrl !== "string") return false;
  return /^https?:\/\//i.test(rawUrl.trim());
}

export function isDownloadLikeLink(rawUrl, attrs = {}) {
  if (!isPreInterceptableDownloadUrl(rawUrl)) return false;
  if (attrs.download === true || attrs.downloadAttribute === true) return true;
  if (typeof attrs.download === "string" && attrs.download.trim() !== "") return true;
  if (typeof attrs.downloadAttribute === "string" && attrs.downloadAttribute.trim() !== "") {
    return true;
  }

  const filename = attrs.filename || filenameFromUrl(rawUrl);
  const extension = extensionFromFilename(filename);
  return extension ? DOWNLOAD_FILE_EXTENSIONS.has(extension) : false;
}

export function shouldInterceptDownload(downloadItem = {}, settings = {}) {
  if (settings.interceptDownloads === false) return false;
  if (downloadItem.byExtensionId) return false;
  const url = downloadItem.finalUrl || downloadItem.url || "";
  return isSupportedDownloadUrl(url);
}

export function basenameFromPath(path) {
  if (typeof path !== "string" || path.trim() === "") return undefined;
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").filter(Boolean).pop();
  return name || undefined;
}

export function filenameFromUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") return undefined;
  try {
    const url = new URL(rawUrl);
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return name || undefined;
  } catch {
    return basenameFromPath(rawUrl);
  }
}

export function extensionFromFilename(filename) {
  if (typeof filename !== "string") return "";
  const cleaned = filename.trim().toLowerCase();
  const match = /\.([a-z0-9]{1,12})$/.exec(cleaned);
  return match?.[1] || "";
}

export function cookieHeaderFromCookies(cookies = []) {
  if (!Array.isArray(cookies)) return "";
  return cookies
    .filter((cookie) => typeof cookie?.name === "string" && cookie.name !== "" && typeof cookie.value === "string")
    .slice()
    .sort((a, b) => {
      const pathDelta = String(b.path || "").length - String(a.path || "").length;
      if (pathDelta !== 0) return pathDelta;
      return String(a.name).localeCompare(String(b.name));
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export function dedupeKeyForUrl(rawUrl) {
  const normalized = normalizeUrlForMatch(rawUrl);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return normalized;
  }
}

export function requestHeadersToContext(headers = []) {
  const context = { requestHeaders: [] };
  const seen = new Set();
  for (const header of headers) {
    const name = typeof header.name === "string" ? header.name.trim() : "";
    const value = typeof header.value === "string" ? header.value : "";
    if (!name || !value) continue;
    const key = name.toLowerCase();
    if (key === "cookie") {
      context.cookie = value;
    } else if (key === "referer" || key === "referrer") {
      context.referer = value;
    } else if (key === "user-agent") {
      context.userAgent = value;
    } else if (REQUEST_HEADER_ALLOWLIST.has(key) && !seen.has(key)) {
      context.requestHeaders.push({ name: canonicalHeaderName(key), value });
      seen.add(key);
    }
  }
  return context;
}

export function buildAddRequestFromDownload(downloadItem = {}, context = {}) {
  const url = downloadItem.url || context.url || "";
  const finalUrl = downloadItem.finalUrl && downloadItem.finalUrl !== url ? downloadItem.finalUrl : undefined;
  const filename = basenameFromPath(downloadItem.filename) || context.filename;
  return stripUndefined({
    url,
    finalUrl,
    referer: context.referer,
    cookie: context.cookie,
    userAgent: context.userAgent,
    requestHeaders: safeRequestHeaders(context.requestHeaders),
    filename
  });
}

export function buildAddRequestFromCandidate(candidate = {}, context = {}) {
  const url = candidate.url || context.url || "";
  const finalUrl = candidate.finalUrl && candidate.finalUrl !== url ? candidate.finalUrl : undefined;
  const filename = candidate.filename || context.filename || filenameFromUrl(finalUrl || url);
  return stripUndefined({
    url,
    finalUrl,
    referer: candidate.referer || context.referer,
    cookie: context.cookie || candidate.cookie,
    userAgent: context.userAgent || candidate.userAgent,
    requestHeaders: safeRequestHeaders(context.requestHeaders),
    filename
  });
}

function safeRequestHeaders(headers = []) {
  if (!Array.isArray(headers)) return [];
  const seen = new Set();
  const result = [];
  for (const header of headers) {
    const rawName = typeof header?.name === "string" ? header.name.trim() : "";
    const value = typeof header?.value === "string" ? header.value : "";
    const key = rawName.toLowerCase();
    if (!rawName || !value || !REQUEST_HEADER_ALLOWLIST.has(key) || seen.has(key)) continue;
    result.push({ name: canonicalHeaderName(key), value });
    seen.add(key);
  }
  return result;
}

function canonicalHeaderName(name) {
  return name
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join("-");
}

function stripUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function taskCreatedTime(task = {}) {
  const value = task.addedAt || task.createdAt || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
