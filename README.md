# Motrix Next Opt Extension

Chrome/Edge MV3 companion extension for [Motrix Next Opt](https://github.com/FoLeaf/motrix-next-cust). It is focused on an IDM-like low-overhead browser workflow: downloads are handed to the Rust backend directly, progress is shown in the toolbar/popup, and the Motrix WebView does not need to be rebuilt for normal download creation.

## Features

- Intercepts common download clicks from content scripts before Chrome creates a native download item.
- Falls back to `chrome.downloads.onCreated` cleanup for downloads that cannot be predicted from page clicks.
- Hides Chrome's native downloads UI while takeover is enabled.
- Forwards safe request context to Motrix Next Opt, including cookies, Referer, User-Agent, and allowlisted headers. Authorization headers are intentionally excluded.
- Shows aggregate progress on the toolbar icon. Idle state uses the static logo; known-size downloads use a 5% bucketed progress bar; unknown-size tasks use an activity state.
- Popup shows newest-first Motrix task sync with filename, progress, speed, ETA, size, save path, and task controls.
- Connects to `/events` only while useful, then falls back to low-frequency polling when disconnected.

## Requirements

- Chrome or Edge 116+
- Motrix Next Opt desktop app from [FoLeaf/motrix-next-cust](https://github.com/FoLeaf/motrix-next-cust)
- Local API enabled on `127.0.0.1:29110`
- A non-empty extension API secret configured in Motrix and copied into the extension popup

## Install Unpacked

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Click **Load unpacked**.
4. Select this repository directory.
5. Open the extension popup and set the same port and API secret used by Motrix Next Opt.

## Development

The extension is intentionally plain MV3 JavaScript. No build step is required.

```bash
npm test
```

Primary files:

- `manifest.json` - MV3 permissions, background worker, popup, and content script registration.
- `background.js` - download takeover, Motrix API calls, WebSocket/polling, toolbar icon rendering.
- `content.js` - early click interception for download-like links.
- `popup.html`, `popup.css`, `popup.js` - progress dashboard and task controls.
- `shared.js` - pure helpers shared by background/popup/tests.
- `__tests__/` - Node test coverage for the takeover and progress helpers.

## Security Notes

- All Motrix control calls go to loopback only.
- `/tasks`, `/events`, `/task-action`, and `/window/show` require Bearer authentication in the desktop app.
- The task list does not expose source URLs, cookies, headers, RPC secrets, or the extension API secret.
- Authorization request headers are never forwarded to Motrix.
