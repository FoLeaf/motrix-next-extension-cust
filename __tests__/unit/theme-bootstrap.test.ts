import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeBootstrap,
  bootstrapStoredTheme,
  createThemeBootstrapVars,
  getBootstrappedUiPrefs,
} from '@/shared/theme-bootstrap';
import type { UiPrefs } from '@/shared/types';

const lightScheme = {
  primary: 0xff006878,
  onSurface: 0xff101418,
  errorContainer: 0xfff9dedc,
  inverseSurface: 0xff2d3135,
  inverseOnSurface: 0xffeef1f5,
  toJSON: () => ({
    primary: 0xff006878,
    onPrimary: 0xffffffff,
    primaryContainer: 0xff9eeffd,
    onPrimaryContainer: 0xff001f26,
    surface: 0xfff5fafc,
    onSurface: 0xff101418,
    onSurfaceVariant: 0xff3f484c,
    outline: 0xff6f797d,
    outlineVariant: 0xffbfc8cc,
    error: 0xffba1a1a,
    onError: 0xffffffff,
    errorContainer: 0xfff9dedc,
    tertiary: 0xff006d3e,
    onTertiary: 0xffffffff,
    inverseSurface: 0xff2d3135,
    inverseOnSurface: 0xffeef1f5,
  }),
};

const darkScheme = {
  primary: 0xff58d6f0,
  onSurface: 0xffdfe3e7,
  errorContainer: 0xff8c1d18,
  inverseSurface: 0xffdfe3e7,
  inverseOnSurface: 0xff2d3135,
  toJSON: () => ({
    primary: 0xff58d6f0,
    onPrimary: 0xff00363f,
    primaryContainer: 0xff004e5a,
    onPrimaryContainer: 0xff9eeffd,
    surface: 0xff101418,
    onSurface: 0xffdfe3e7,
    onSurfaceVariant: 0xffbfc8cc,
    outline: 0xff899296,
    outlineVariant: 0xff3f484c,
    error: 0xffffb4ab,
    onError: 0xff690005,
    errorContainer: 0xff8c1d18,
    tertiary: 0xff60dc96,
    onTertiary: 0xff00391e,
    inverseSurface: 0xffdfe3e7,
    inverseOnSurface: 0xff2d3135,
  }),
};

const sourceToLightPrimary: Record<string, number> = {
  '#E0A422': 0xff7c5800,
  '#06B6D4': 0xff006878,
  '#10B981': 0xff006d3e,
};

vi.mock('@material/material-color-utilities', () => ({
  argbFromHex: (hex: string) => hex,
  hexFromArgb: (argb: number) => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`,
  themeFromSourceColor: (source: string) => ({
    schemes: {
      light: { ...lightScheme, primary: sourceToLightPrimary[source] ?? 0xff006878 },
      dark: darkScheme,
    },
    palettes: {
      primary: { tone: (tone: number) => (tone === 30 ? 0xff00363f : 0xff9eeffd) },
      neutral: { tone: (tone: number) => 0xff000000 + tone },
    },
  }),
}));

describe('theme bootstrap', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('creates CSS variables from the stored color scheme instead of amber fallback', () => {
    const vars = createThemeBootstrapVars({
      theme: 'light',
      colorScheme: 'glacier',
      locale: 'auto',
    });

    expect(vars['--color-brand']).toBe('#006878');
    expect(vars['--color-brand']).not.toBe('#e0a422');
  });

  it('applies the stored theme class and color variables before Vue mount', () => {
    applyThemeBootstrap(
      { theme: 'dark', colorScheme: 'glacier', locale: 'auto' },
      { systemIsDark: false },
    );

    expect(document.documentElement.className).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#58d6f0');
  });

  it('falls back to defaults when stored prefs are invalid', () => {
    applyThemeBootstrap(
      { theme: 'blue', colorScheme: 'unknown', locale: 123 },
      { systemIsDark: false },
    );

    expect(document.documentElement.className).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#7c5800');
  });

  it('loads ui preferences from storage and applies them', async () => {
    const prefs: UiPrefs = { theme: 'light', colorScheme: 'mint', locale: 'auto' };
    const storage = {
      getItem: vi.fn().mockResolvedValue(prefs),
    };

    await bootstrapStoredTheme(storage, { systemIsDark: true });

    expect(storage.getItem).toHaveBeenCalledWith('local:uiPrefs');
    expect(getBootstrappedUiPrefs()).toEqual(prefs);
    expect(document.documentElement.className).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('#006d3e');
  });
});
