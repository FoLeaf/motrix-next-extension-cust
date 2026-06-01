import { describe, expect, it } from 'vitest';
import { resolveBrowserCapabilities } from '@/shared/browser-capabilities';

describe('resolveBrowserCapabilities', () => {
  it('disables download UI control on Firefox only', () => {
    expect(resolveBrowserCapabilities('firefox').canControlDownloadUi).toBe(false);
    expect(resolveBrowserCapabilities('chromium').canControlDownloadUi).toBe(true);
    expect(resolveBrowserCapabilities('edge').canControlDownloadUi).toBe(true);
  });
});
