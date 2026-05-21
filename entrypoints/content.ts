import { browser } from 'wxt/browser';
import { createExternalProtocolClickHandler, type ExternalProtocol } from '@/lib/services';
import { parseDownloadSettings } from '@/lib/storage';
import { DEFAULT_DOWNLOAD_SETTINGS } from '@/shared/constants';
import type { InterceptionScope } from '@/shared/types';

/**
 * @fileoverview Content script for external protocol link interception.
 *
 * Protocol links are not HTTP downloads — `browser.downloads` and
 * `browser.webRequest` cannot intercept them. This content script captures
 * clicks at the DOM level and routes supported links to the background service
 * worker via `browser.runtime.sendMessage`.
 *
 * The background handles the URI through the desktop API.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    let interceptionEnabled = DEFAULT_DOWNLOAD_SETTINGS.enabled;
    let interceptionScope: InterceptionScope = { ...DEFAULT_DOWNLOAD_SETTINGS.interceptionScope };

    async function refreshInterceptionState(): Promise<void> {
      const data = await browser.storage.local.get('settings');
      const settings = parseDownloadSettings(data.settings);
      interceptionEnabled = settings.enabled;
      interceptionScope = settings.interceptionScope;
    }

    void refreshInterceptionState();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.settings) return;
      const settings = parseDownloadSettings(changes.settings.newValue);
      interceptionEnabled = settings.enabled;
      interceptionScope = settings.interceptionScope;
    });

    const handleProtocolClick = createExternalProtocolClickHandler({
      shouldIntercept: (link) => interceptionEnabled && interceptionScope[link.protocol],
      sendProtocol: ({ protocol, url }: { protocol: ExternalProtocol; url: string }) => {
        void browser.runtime.sendMessage({ type: 'HANDLE_EXTERNAL_PROTOCOL', protocol, url });
      },
    });

    // Use capturing phase to intercept before any page-level handlers
    document.addEventListener(
      'click',
      handleProtocolClick,
      true, // capture phase
    );
  },
});
