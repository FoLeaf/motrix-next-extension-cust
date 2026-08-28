/** Detect Firefox navigations that should be handed to Motrix before the save dialog. */

const NON_DOWNLOAD_APPLICATION_MIMES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/json",
  "application/pdf",
  "application/wasm",
  "application/x-www-form-urlencoded"
]);
const WEB_DOCUMENT_MIMES = new Set([
  "application/xhtml+xml",
  "application/xml",
  "text/html",
  "text/xml"
]);

function headerValue(headers, name) {
  const target = name.toLowerCase();
  return headers?.find((header) => header.name?.toLowerCase() === target)?.value?.trim() ?? "";
}

function contentLength(headers) {
  const value = Number.parseInt(headerValue(headers, "content-length"), 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : -1;
}

function baseMime(value) {
  return (value.split(";")[0] ?? "").trim().toLowerCase();
}

function isBinaryMime(value) {
  const mime = baseMime(value);
  if (mime === "binary/octet-stream") return true;
  if (!mime.startsWith("application/")) return false;
  if (NON_DOWNLOAD_APPLICATION_MIMES.has(mime) || WEB_DOCUMENT_MIMES.has(mime)) return false;
  return !mime.endsWith("+json") && !mime.endsWith("+xml");
}

function hasExplicitDownloadIntent(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const downloadValue = (parsed.searchParams.get("dl") ?? "").toLowerCase();
    return (
      path.endsWith("/download") ||
      path.includes("/download/") ||
      parsed.searchParams.has("download") ||
      parsed.searchParams.has("attachment") ||
      parsed.searchParams.has("filename") ||
      parsed.searchParams.has("response-content-disposition") ||
      parsed.searchParams.get("export") === "download" ||
      ["1", "true", "yes", "download"].includes(downloadValue)
    );
  } catch {
    return false;
  }
}

function decodeMimeEncodedWords(value) {
  if (!value.includes("=?")) return value;
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, _charset, encoding, payload) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return atob(payload.replace(/\s+/g, ""));
        }
        return payload.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m, hex) =>
          String.fromCharCode(Number.parseInt(hex, 16))
        );
      } catch {
        return _match;
      }
    }
  );
}

function normalizeFilename(filename) {
  return filename
    .trim()
    .replace(/^.*[/\\]/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[. ]+$/g, "");
}

export function parseContentDispositionHeader(header) {
  if (!header) return null;
  const typeMatch = /^([^;]+)/.exec(header);
  const type = (typeMatch?.[1] || "inline").trim().toLowerCase();
  const starMatch = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (starMatch?.[1]) {
    const encoded = starMatch[1].trim().replace(/^"(.*)"$/, "$1");
    const parts = encoded.split("''");
    const rawName = parts.length > 1 ? parts.slice(1).join("''") : encoded;
    try {
      const filename = normalizeFilename(decodeURIComponent(rawName));
      return filename ? { type, filename } : { type };
    } catch {
      const filename = normalizeFilename(rawName);
      return filename ? { type, filename } : { type };
    }
  }
  const fnMatch = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);
  const rawFilename = fnMatch?.[1] || fnMatch?.[2] || "";
  const filename = rawFilename ? normalizeFilename(decodeMimeEncodedWords(rawFilename)) : "";
  return filename ? { type, filename } : { type };
}

export function parseFirefoxDownloadResponse(details = {}) {
  if (details.method !== "GET") return null;
  if (details.type !== "main_frame" && details.type !== "sub_frame") return null;
  if (details.statusCode < 200 || details.statusCode >= 300) return null;

  const disposition = parseContentDispositionHeader(
    headerValue(details.responseHeaders, "content-disposition")
  );
  const mime = headerValue(details.responseHeaders, "content-type");
  const isAttachment = disposition?.type === "attachment";
  if (!isAttachment && WEB_DOCUMENT_MIMES.has(baseMime(mime))) return null;
  if (!isAttachment && !isBinaryMime(mime) && !hasExplicitDownloadIntent(details.url)) return null;

  const filename = disposition?.filename ? normalizeFilename(disposition.filename) : "";
  const size = contentLength(details.responseHeaders);

  return {
    url: details.url,
    finalUrl: details.url,
    filename,
    fileSize: size,
    totalBytes: size,
    mime,
    referer: details.originUrl || details.documentUrl || ""
  };
}
