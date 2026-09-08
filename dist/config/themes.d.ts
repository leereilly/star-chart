import type { Palette, ThemeName } from '../models/index.js';
/** GitHub-native contribution palettes. */
export declare const LIGHT_PALETTE: Palette;
export declare const DARK_PALETTE: Palette;
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
export declare const LIGHT_COLORS: ThemeColors;
export declare const DARK_COLORS: ThemeColors;
/** Resolves the base palette for a concrete (non-auto) theme. */
export declare function basePalette(theme: 'light' | 'dark'): Palette;
/** Applies palette overrides on top of a base palette. */
export declare function applyOverrides(base: Palette, overrides: Partial<Palette>): Palette;
export declare function themeColors(theme: 'light' | 'dark'): ThemeColors;
/** The concrete themes a given theme setting renders. */
export declare function resolvedThemes(theme: ThemeName): ('light' | 'dark')[];
/** Comparison colours remain distinct beyond the four palette levels. */
export declare function seriesColor(index: number, theme: 'light' | 'dark'): string;
