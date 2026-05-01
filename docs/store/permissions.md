# Permission Justifications

Text to enter in the Chrome Web Store Developer Dashboard when prompted to justify each permission.

---

## Required Permissions

### `downloads`

```
The 'downloads' permission is the core of this extension's functionality. When a browser download starts, the extension evaluates it against the user's rules, extracts the URL and metadata, and forwards it to the locally running Motrix Next desktop application via its HTTP API. After successful delegation, the original browser download is cancelled and erased. Without this permission, the extension cannot intercept or manage downloads.
```

### `storage`

```
Used to persist user-configured settings in chrome.storage.local, including: API connection parameters (port number, authentication token), download behavior preferences (enabled/disabled, minimum file size threshold, auto-launch, cookie forwarding, download bar visibility), per-site interception rules, appearance preferences (theme, color scheme, language), and a diagnostic event log for troubleshooting. No data is ever sent to any remote server — all storage is local-only.
```

### `contextMenus`

```
Adds a single "Download with Motrix Next" context menu item that appears when right-clicking on links, images, audio, and video elements. This allows users to manually send a specific resource to the Motrix Next download manager without relying on automatic interception. The context menu is registered once at extension startup and its title updates to match the user's selected language.
```

### `notifications`

```
Displays a brief desktop notification when an intercepted download cannot be delivered to Motrix Next. The desktop app owns normal task start, progress, completion, and error notifications.
```

## Required Host Permissions

### `http://127.0.0.1/*` and `http://localhost/*`

```
Required to communicate with the Motrix Next HTTP API running on the user's local machine inside the desktop application. This is the ONLY network communication the extension makes. The extension sends requests to http://127.0.0.1:{port} (default port: 16801) to submit download tasks, check connection status, query stats, and control tasks. No requests are ever made to any remote server.
```

## Optional Permissions

### `cookies`

```
When the user explicitly enables "Forward Cookies" in the extension's Settings page, this permission is requested to read cookies for the download URL's domain. The cookies are forwarded to the locally running Motrix Next HTTP API, enabling authenticated downloads from sites that require login (e.g., private file hosting services). Cookies are sent ONLY to the local Motrix Next instance (127.0.0.1) and are never placed in protocol fallback URLs. This permission is never requested automatically; the user must manually grant it through the Settings UI.
```

### `downloads.ui`

```
When the user enables "Hide Browser Download Bar" in Settings, this optional permission is requested and then used to call chrome.downloads.setUiOptions() to suppress the browser's native download shelf after downloads are intercepted and delegated to Motrix Next. Only available on Chrome 115+; the extension gracefully degrades on browsers that do not support this API.
```

### Optional Host: `https://*/*` and `http://*/*`

```
This broad host permission is requested ONLY when the user explicitly enables Forward Cookies. It is required because chrome.cookies.getAll() needs matching host permissions for the target download domain to successfully read cookies. Without this permission, the cookies API cannot access cookies for arbitrary download URLs. This permission is never requested automatically — the user must manually grant it through the Settings page. When not granted, the extension functions normally without cookie forwarding.
```

---

## Privacy Practices (Dashboard Section)

### Single Purpose Description

```
Intercept browser downloads and delegate them to the Motrix Next desktop download manager for accelerated multi-threaded downloading via aria2.
```

### Permission Justification Summary

```
This extension intercepts browser downloads and sends them to a locally running download manager (Motrix Next). Required permissions: 'downloads' to intercept browser downloads, 'storage' for local settings persistence, 'contextMenus' for right-click download option, 'notifications' for delivery failure alerts. Required host permissions are limited to localhost (127.0.0.1) for communicating with the local Motrix Next HTTP API. Optional permissions (cookies, downloads.ui, broad http/https origins) are only requested when the user explicitly enables the matching setting. No data is collected, transmitted, or shared with any external service.
```

### Data Use Disclosures

```
- Personally identifiable information: NOT collected
- Health information: NOT collected
- Financial and payment information: NOT collected
- Authentication information: NOT collected
- Personal communications: NOT collected
- Location: NOT collected
- Web history: NOT collected
- User activity: NOT collected
- Website content: NOT collected
```
