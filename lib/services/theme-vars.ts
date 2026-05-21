import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';

type CssVarMap = Record<string, string>;

const MCU_TO_CSS: Record<string, string> = {
  primary: '--color-primary',
  onPrimary: '--color-on-primary',
  primaryContainer: '--color-primary-container',
  onPrimaryContainer: '--color-on-primary-container',
  surface: '--color-surface',
  onSurface: '--color-on-surface',
  onSurfaceVariant: '--color-on-surface-variant',
  outline: '--color-outline',
  outlineVariant: '--color-outline-variant',
  error: '--color-error',
  onError: '--color-on-error',
  errorContainer: '--color-error-container',
  tertiary: '--color-tertiary',
  onTertiary: '--color-on-tertiary',
  inverseSurface: '--color-inverse-surface',
  inverseOnSurface: '--color-on-inverse-surface',
};

const SURFACE_TONES = {
  light: {
    surfaceDim: 84,
    surfaceContainerLowest: 98,
    surfaceContainerLow: 94,
    surfaceContainer: 91,
    surfaceContainerHigh: 88,
    surfaceContainerHighest: 85,
  },
  dark: {
    surfaceDim: 6,
    surfaceContainerLowest: 4,
    surfaceContainerLow: 10,
    surfaceContainer: 12,
    surfaceContainerHigh: 17,
    surfaceContainerHighest: 22,
  },
} as const;

const SURFACE_CSS_MAP: Record<string, string> = {
  surfaceDim: '--color-surface-dim',
  surfaceContainerLowest: '--color-surface-container-lowest',
  surfaceContainerLow: '--color-surface-container-low',
  surfaceContainer: '--color-surface-container',
  surfaceContainerHigh: '--color-surface-container-high',
  surfaceContainerHighest: '--color-surface-container-highest',
};

export interface ThemeVarsInput {
  readonly seedHex: string;
  readonly isDark: boolean;
}

export function createThemeVars(input: ThemeVarsInput): CssVarMap {
  const seed = input.seedHex;
  const m3Theme = themeFromSourceColor(argbFromHex(seed));
  const scheme = input.isDark ? m3Theme.schemes.dark : m3Theme.schemes.light;
  const json = scheme.toJSON() as Record<string, number>;
  const vars: CssVarMap = {};

  for (const [mcuKey, cssVar] of Object.entries(MCU_TO_CSS)) {
    const argb = json[mcuKey];
    if (argb !== undefined) {
      vars[cssVar] = hexFromArgb(argb);
    }
  }

  const neutral = m3Theme.palettes.neutral;
  const tones = input.isDark ? SURFACE_TONES.dark : SURFACE_TONES.light;
  for (const [key, cssVar] of Object.entries(SURFACE_CSS_MAP)) {
    vars[cssVar] = hexFromArgb(neutral.tone(tones[key as keyof typeof tones]));
  }

  const primary = hexFromArgb(scheme.primary);
  vars['--color-brand'] = primary;
  vars['--color-warning'] = primary;
  vars['--color-success'] = input.isDark ? '#8edb6a' : '#386a20';
  vars['--color-on-success'] = input.isDark ? '#0a3900' : '#ffffff';
  vars['--color-error-container'] = hexFromArgb(scheme.errorContainer);
  vars['--color-inverse-surface'] = hexFromArgb(scheme.inverseSurface);
  vars['--color-on-inverse-surface'] = hexFromArgb(scheme.inverseOnSurface);

  const palette = m3Theme.palettes.primary;
  vars['--color-primary-light-5'] = hexFromArgb(palette.tone(input.isDark ? 30 : 80));
  vars['--color-primary-light-9'] = hexFromArgb(palette.tone(input.isDark ? 10 : 95));

  const sr = (scheme.onSurface >> 16) & 0xff;
  const sg = (scheme.onSurface >> 8) & 0xff;
  const sb = scheme.onSurface & 0xff;
  vars['--color-scrollbar-thumb'] = `rgba(${sr}, ${sg}, ${sb}, ${input.isDark ? 0.22 : 0.3})`;

  return vars;
}

export function applyThemeVars(vars: CssVarMap, rootStyle: CSSStyleDeclaration): void {
  for (const [key, value] of Object.entries(vars)) {
    rootStyle.setProperty(key, value);
  }
}
