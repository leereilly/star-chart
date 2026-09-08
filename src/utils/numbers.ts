/** Numeric formatting and geometry helpers with deterministic output. */

/** Rounds to at most `digits` decimals and strips trailing zeros. */
export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round non-finite value: ${String(value)}`);
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Formats a number for SVG coordinates: finite, trimmed, no exponent. */
export function coord(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite geometry value: ${String(value)}`);
  }
  const rounded = round(value, 3);
  // Avoid "-0".
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return String(normalized);
}

/** Compact human count, e.g. 1234 -> "1.2k", 1500000 -> "1.5M". */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const abs = Math.abs(value);
  if (abs < 1000) {
    return String(Math.round(value));
  }
  if (abs < 1_000_000) {
    return `${trimUnit(value / 1000)}k`;
  }
  if (abs < 1_000_000_000) {
    return `${trimUnit(value / 1_000_000)}M`;
  }
  return `${trimUnit(value / 1_000_000_000)}B`;
}

function trimUnit(value: number): string {
  const rounded = round(value, 1);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Thousands-separated integer, e.g. 12345 -> "12,345". */
export function withCommas(value: number): string {
  const rounded = Math.round(value);
  return rounded.toLocaleString('en-US');
}

/** Clamps a value into the inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
