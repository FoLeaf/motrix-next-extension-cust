import { browser } from 'wxt/browser';
import { createMagnetClickHandler } from '@/lib/services/magnet-interception';
import { parseDownloadSettings } from '@/lib/storage';
import { DEFAULT_DOWNLOAD_SETTINGS } from '@/shared/constants';

/**
 * @fileoverview Content script for magnet link interception.
 *
 * `magnet:` is a protocol link, not an HTTP download — `browser.downloads`
 * and `browser.webRequest` cannot intercept it. This content script captures
 * clicks on `<a href="magnet:...">` elements at the DOM level and routes
 * them to the background service worker via `browser.runtime.sendMessage`.
 *
 * The background handles the magnet URI through the desktop API, which
 * natively supports magnet links.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    let interceptionEnabled = DEFAULT_DOWNLOAD_SETTINGS.enabled;

    async function refreshInterceptionState(): Promise<void> {
      const data = await browser.storage.local.get('settings');
      interceptionEnabled = parseDownloadSettings(data.settings).enabled;
    }

    void refreshInterceptionState();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      interceptionEnabled = parseDownloadSettings(changes.settings.newValue).enabled;
    });

    const handleMagnetClick = createMagnetClickHandler({
      isEnabled: () => interceptionEnabled,
      sendMagnet: (url) => {
        void browser.runtime.sendMessage({ type: 'HANDLE_MAGNET', url });
      },
    });

    // Use capturing phase to intercept before any page-level handlers
    document.addEventListener(
      'click',
      handleMagnetClick,
      true, // capture phase
    );
  },
});
