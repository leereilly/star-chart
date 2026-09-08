import type { Palette, ThemeName } from '../models/index.js';

/** GitHub-native contribution palettes. */
export const LIGHT_PALETTE: Palette = {
  empty: '#ebedf0',
  level1: '#9be9a8',
  level2: '#40c463',
  level3: '#30a14e',
  level4: '#216e39',
};

export const DARK_PALETTE: Palette = {
  // Lighter than GitHub's #161b22 so unfilled cells read as grey squares
  // against a dark README canvas instead of blending into it.
  empty: '#30363d',
  level1: '#0e4429',
  level2: '#006d32',
  level3: '#26a641',
  level4: '#39d353',
};

export interface ThemeColors {
  /** Primary text colour. */
  readonly text: string;
  /** Muted/secondary text colour. */
  readonly muted: string;
  /** Subtle separators. */
  readonly border: string;
  /** Accent (star icon / positive change). */
  readonly accent: string;
  /** Plot stroke for conventional charts. */
  readonly stroke: string;
  /** Plot fill for area charts. */
  readonly fill: string;
  /** Axis / gridline colour. */
  readonly axis: string;
}

export const LIGHT_COLORS: ThemeColors = {
  text: '#1f2328',
  muted: '#59636e',
  border: '#d1d9e0',
  accent: '#e3b341',
  stroke: '#2da44e',
  fill: '#2da44e',
  axis: '#d1d9e0',
};

export const DARK_COLORS: ThemeColors = {
  text: '#e6edf3',
  muted: '#9198a1',
  border: '#3d444d',
  accent: '#e3b341',
  stroke: '#3fb950',
  fill: '#3fb950',
  axis: '#3d444d',
};

/** Resolves the base palette for a concrete (non-auto) theme. */
export function basePalette(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/** Applies palette overrides on top of a base palette. */
export function applyOverrides(
  base: Palette,
  overrides: Partial<Palette>,
): Palette {
  return {
    empty: overrides.empty ?? base.empty,
    level1: overrides.level1 ?? base.level1,
    level2: overrides.level2 ?? base.level2,
    level3: overrides.level3 ?? base.level3,
    level4: overrides.level4 ?? base.level4,
  };
}

export function themeColors(theme: 'light' | 'dark'): ThemeColors {
  return theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

/** The concrete themes a given theme setting renders. */
export function resolvedThemes(theme: ThemeName): ('light' | 'dark')[] {
  if (theme === 'light') {
    return ['light'];
  }
  if (theme === 'dark') {
    return ['dark'];
  }
  return ['light', 'dark'];
}

/** Comparison colours remain distinct beyond the four palette levels. */
export function seriesColor(index: number, theme: 'light' | 'dark'): string {
  const hues = [140, 215, 32, 280, 350, 180];
  const hue = hues[index] ?? (index * 137.508) % 360;
  return `hsl(${Math.round(hue)},${theme === 'dark' ? 72 : 66}%,${theme === 'dark' ? 65 : 36}%)`;
}
