(() => {
  const DOWNLOAD_EXTENSIONS = new Set([
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
  const FALLBACK_DELAY_MS = 4000;

  document.addEventListener("click", onDocumentClick, true);

  function onDocumentClick(event) {
    if (!isPlainLeftClick(event)) return;

    const anchor = findAnchor(event);
    if (!anchor) return;

    const url = absoluteUrl(anchor.getAttribute("href"));
    if (!isDownloadLikeLink(url, anchor)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const candidate = {
      url,
      filename: filenameFromAnchor(anchor, url),
      referer: window.location.href,
      pageTitle: document.title,
      userAgent: navigator.userAgent
    };

    submitCandidate(candidate, () => fallbackOpen(anchor, url));
  }

  function isPlainLeftClick(event) {
    return (
      event.button === 0 &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    );
  }

  function findAnchor(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (const node of path) {
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches?.("a[href]")) return node;
        const closest = node.closest?.("a[href]");
        if (closest) return closest;
      }
    }
    return event.target?.closest?.("a[href]") || null;
  }

  function absoluteUrl(rawHref) {
    if (!rawHref || rawHref.trim() === "") return "";
    try {
      return new URL(rawHref, window.location.href).toString();
    } catch {
      return "";
    }
  }

  function isDownloadLikeLink(url, anchor) {
    if (!/^https?:\/\//i.test(url)) return false;
    if (anchor.hasAttribute("download")) return true;
    const filename = filenameFromAnchor(anchor, url);
    const extension = /\.([a-z0-9]{1,12})$/i.exec(filename || "")?.[1]?.toLowerCase();
    return extension ? DOWNLOAD_EXTENSIONS.has(extension) : false;
  }

  function filenameFromAnchor(anchor, url) {
    const downloadName = anchor.getAttribute("download");
    if (downloadName && downloadName.trim() !== "") return basename(downloadName);
    return filenameFromUrl(url);
  }

  function filenameFromUrl(url) {
    try {
      const parsed = new URL(url);
      const segment = parsed.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(segment);
    } catch {
      return "";
    }
  }

  function basename(path) {
    return String(path).replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
  }

  function submitCandidate(candidate, fallback) {
    let finished = false;
    const timer = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      fallback();
    }, FALLBACK_DELAY_MS);

    try {
      chrome.runtime.sendMessage({ type: "downloadCandidate", candidate }, (response) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        if (chrome.runtime.lastError || !response?.ok) {
          fallback();
        }
      });
    } catch {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      fallback();
    }
  }

  function fallbackOpen(anchor, url) {
    const target = (anchor.getAttribute("target") || "").trim();
    if (target && target.toLowerCase() !== "_self") {
      const opened = window.open(url, target);
      if (opened) return;
    }
    window.location.assign(url);
  }
})();
