export interface BrowserCapabilities {
  canControlDownloadUi: boolean;
}

export function resolveBrowserCapabilities(browser: string): BrowserCapabilities {
  return {
    canControlDownloadUi: browser !== 'firefox',
  };
}
