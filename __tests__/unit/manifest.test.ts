import { describe, expect, it } from 'vitest';
import { buildExtensionManifest } from '@/shared/manifest';

describe('buildExtensionManifest', () => {
  it('keeps sensitive Chromium permissions optional', () => {
    const manifest = buildExtensionManifest('chromium');

    expect(manifest.permissions).toEqual([
      'downloads',
      'storage',
      'contextMenus',
      'notifications',
      'webRequest',
    ]);
    expect(manifest.optional_permissions).toEqual(['cookies', 'downloads.ui']);
    expect(manifest.host_permissions).toEqual(['http://127.0.0.1/*', 'http://localhost/*']);
    expect(manifest.optional_host_permissions).toEqual(['https://*/*', 'http://*/*']);
  });

  it('keeps Firefox-only metadata while leaving cookies optional', () => {
    const manifest = buildExtensionManifest('firefox');

    expect(manifest.permissions).toEqual([
      'downloads',
      'storage',
      'contextMenus',
      'notifications',
      'webRequest',
    ]);
    expect(manifest.optional_permissions).toEqual(['cookies']);
    expect(manifest.optional_host_permissions).toEqual(['https://*/*', 'http://*/*']);
    expect(manifest.browser_specific_settings?.gecko.id).toBe(
      'motrix-next-extension@aninsomniacy.dev',
    );
  });
});
