import { describe, it, expect } from 'vitest';
import { renderChart } from '../src/renderers/index.js';
import { buildChartModel } from '../src/history/model.js';
import type { ChartStyle } from '../src/models/index.js';
import {
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  checkSvg,
} from './helpers/index.js';

const STYLES: ChartStyle[] = ['line', 'area', 'bar', 'sparkline'];

function renderStyle(
  style: ChartStyle,
  adds: number[],
  raw: Record<string, string> = {},
): string {
  const history = historyFromAdds(adds.length > 0 ? adds : [0]);
  const cols = Math.max(1, Math.min(52, adds.length || 1));
  const config = makeConfig({ style, columns: String(cols), ...raw });
  const model = buildChartModel(config, makeMetadata(), history, {
    asOf: FIXED_NOW,
  });
  return renderChart(model).svg;
}

describe('conventional renderers', () => {
  for (const style of STYLES) {
    it(`${style}: valid SVG for a normal series`, () => {
      const svg = renderStyle(style, [1, 3, 2, 5, 8, 6, 10, 12]);
      const check = checkSvg(svg);
      expect(check.ok, check.errors.join('; ')).toBe(true);
    });

    it(`${style}: valid for empty data`, () => {
      const svg = renderStyle(style, [0, 0, 0]);
      expect(checkSvg(svg).ok).toBe(true);
    });

    it(`${style}: valid for a single point`, () => {
      const svg = renderStyle(style, [5]);
      expect(checkSvg(svg).ok).toBe(true);
    });

    it(`${style}: valid for a huge spike`, () => {
      const svg = renderStyle(style, [1, 1, 1, 100000, 1, 1]);
      expect(checkSvg(svg).ok).toBe(true);
    });

    it(`${style}: valid for both themes`, () => {
      expect(
        checkSvg(renderStyle(style, [1, 2, 3], { theme: 'dark' })).ok,
      ).toBe(true);
      expect(
        checkSvg(renderStyle(style, [1, 2, 3], { theme: 'auto' })).ok,
      ).toBe(true);
    });
  }

  it('line: single point renders a dot marker', () => {
    const svg = renderStyle('line', [7]);
    expect(svg).toContain('sc-dot');
  });

  it('area: contains a filled area and a stroked line', () => {
    const svg = renderStyle('area', [1, 2, 3, 4]);
    expect(svg).toContain('sc-area');
    expect(svg).toContain('sc-stroke');
  });

  it('bar: renders one rect per column', () => {
    const svg = renderStyle('bar', [1, 2, 3, 4, 5]);
    expect(
      svg.split('class="sc-bar"').length - 1 + svg.split('sc-bar ').length - 1,
    ).toBeGreaterThanOrEqual(5);
  });

  it('sparkline: omits axis ticks but keeps the header', () => {
    const svg = renderStyle('sparkline', [1, 2, 3, 4], { show_title: 'true' });
    expect(checkSvg(svg).ok).toBe(true);
  });

  it('escapes hostile titles supplied to the renderer', () => {
    const svg = renderStyle('line', [1, 2, 3], {
      title: '<script>alert(1)</script>&"',
    });
    expect(svg).not.toContain('<script>alert(1)');
    expect(svg).toContain('&lt;script&gt;');
    expect(checkSvg(svg).ok).toBe(true);
  });
});
