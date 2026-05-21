/**
 * @fileoverview Pre-mount theme bootstrap for extension UI pages.
 *
 * Applies the persisted theme and color scheme before Vue mounts so the first
 * rendered frame does not flash the static amber fallback from globals.css.
 */
import { parseUiPrefs } from '@/lib/storage';
import { resolveThemeClass } from '@/lib/services';
import { applyThemeVars, createThemeVars } from '@/lib/services/theme-vars';
import { resolveScheme } from './color-schemes';
import type { UiPrefs } from './types';

type CssVarMap = Record<string, string>;
type StorageItemKey = `local:${string}`;
const BOOTSTRAPPED_UI_PREFS_KEY = '__MOTRIX_NEXT_BOOTSTRAPPED_UI_PREFS__';

declare global {
  interface Window {
    __MOTRIX_NEXT_BOOTSTRAPPED_UI_PREFS__?: UiPrefs;
  }
}

export interface ThemeBootstrapStorage {
  getItem: (key: StorageItemKey) => Promise<unknown | null>;
}

export interface ThemeBootstrapOptions {
  readonly systemIsDark?: boolean;
}

function resolveSystemIsDark(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function createThemeBootstrapVars(
  rawPrefs: unknown,
  options: ThemeBootstrapOptions = {},
): CssVarMap {
  const prefs = parseUiPrefs(rawPrefs);
  const isDark =
    resolveThemeClass(prefs.theme, resolveSystemIsDark(options.systemIsDark)) === 'dark';
  return createThemeVars({ seedHex: resolveScheme(prefs.colorScheme).seed, isDark });
}

export function applyThemeBootstrap(
  rawPrefs: unknown,
  options: ThemeBootstrapOptions = {},
): UiPrefs {
  const prefs = parseUiPrefs(rawPrefs);
  const systemIsDark = resolveSystemIsDark(options.systemIsDark);
  document.documentElement.className = resolveThemeClass(prefs.theme, systemIsDark);

  const vars = createThemeBootstrapVars(prefs, { systemIsDark });
  applyThemeVars(vars, document.documentElement.style);

  return prefs;
}

export async function bootstrapStoredTheme(
  storage: ThemeBootstrapStorage,
  options: ThemeBootstrapOptions = {},
): Promise<UiPrefs> {
  const prefs = await storage.getItem('local:uiPrefs').catch(() => null);
  const parsed = applyThemeBootstrap(prefs, options);
  window[BOOTSTRAPPED_UI_PREFS_KEY] = parsed;
  return parsed;
}

export function getBootstrappedUiPrefs(): UiPrefs | undefined {
  return window[BOOTSTRAPPED_UI_PREFS_KEY];
}
