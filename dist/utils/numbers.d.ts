/** Numeric formatting and geometry helpers with deterministic output. */
/** Rounds to at most `digits` decimals and strips trailing zeros. */
export declare function round(value: number, digits?: number): number;
/** Formats a number for SVG coordinates: finite, trimmed, no exponent. */
export declare function coord(value: number): string;
/** Compact human count, e.g. 1234 -> "1.2k", 1500000 -> "1.5M". */
export declare function compactNumber(value: number): string;
/** Thousands-separated integer, e.g. 12345 -> "12,345". */
export declare function withCommas(value: number): string;
/** Clamps a value into the inclusive range. */
export declare function clamp(value: number, min: number, max: number): number;
