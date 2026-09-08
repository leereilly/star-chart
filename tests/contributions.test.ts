import { describe, it, expect } from 'vitest';
import {
  columnHeight,
  contribGeometry,
  tipClassFromTop,
  renderContributions,
  RenderError,
} from '../src/renderers/contributions.js';
import { buildChartModel } from '../src/history/model.js';
import type { ChartModel } from '../src/models/index.js';
import {
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  checkSvg,
  withoutLegend,
} from './helpers/index.js';

function heightModel(
  rows: number,
  max: number,
  baseline: number,
  scale: 'absolute' | 'visible',
): ChartModel {
  return {
    config: makeConfig({ rows: String(rows), scale }),
    windowMax: max,
    baseline,
  } as unknown as ChartModel;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function render(adds: number[], raw: Record<string, string> = {}): string {
  const history = historyFromAdds(adds);
  const config = makeConfig({
    columns: String(adds.length),
    weeks: String(adds.length),
    ...raw,
  });
  const model = buildChartModel(config, makeMetadata(), history, {
    asOf: FIXED_NOW,
  });
  return renderContributions(model);
}

describe('columnHeight', () => {
  it('exact heights 0..4 with rows=4 absolute', () => {
    const m = heightModel(4, 4, 0, 'absolute');
    expect(columnHeight(m, 0)).toBe(0);
    expect(columnHeight(m, 1)).toBe(1);
    expect(columnHeight(m, 2)).toBe(2);
    expect(columnHeight(m, 3)).toBe(3);
    expect(columnHeight(m, 4)).toBe(4);
  });

  it('any positive value gets at least one cell', () => {
    const m = heightModel(100, 10000, 0, 'absolute');
    expect(columnHeight(m, 1)).toBe(1);
  });

  it('latest maximum reaches all rows', () => {
    const m = heightModel(100, 500, 0, 'absolute');
    expect(columnHeight(m, 500)).toBe(100);
  });

  it('visible scale uses baseline denominator', () => {
    const m = heightModel(100, 200, 100, 'visible');
    expect(columnHeight(m, 100)).toBe(0); // at baseline
    expect(columnHeight(m, 200)).toBe(100); // at max
    expect(columnHeight(m, 150)).toBe(50);
  });

  it('flat visible range renders empty', () => {
    const m = heightModel(100, 100, 100, 'visible');
    expect(columnHeight(m, 100)).toBe(0);
  });

  it('zero denominator (absolute) is empty', () => {
    const m = heightModel(100, 0, 0, 'absolute');
    expect(columnHeight(m, 0)).toBe(0);
  });

  it('is monotonic in cumulative', () => {
    const m = heightModel(50, 1000, 0, 'absolute');
    let prev = -1;
    for (let c = 0; c <= 1000; c += 50) {
      const h = columnHeight(m, c);
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });
});

describe('tipClassFromTop', () => {
  it('is l4, l3, l2, then l1', () => {
    expect(tipClassFromTop(0)).toBe('sc-l4');
    expect(tipClassFromTop(1)).toBe('sc-l3');
    expect(tipClassFromTop(2)).toBe('sc-l2');
    expect(tipClassFromTop(3)).toBe('sc-l1');
    expect(tipClassFromTop(50)).toBe('sc-l1');
  });
});

describe('renderContributions tip palette counts', () => {
  it('produces exact l4/l3/l2 counts for heights 1..4', () => {
    // cumulative 1,2,3,4 with max 4 -> heights 1,2,3,4
    const svg = withoutLegend(render([1, 1, 1, 1], { rows: '4' }));
    expect(countOccurrences(svg, '"sc-l4"')).toBe(4); // every non-zero column
    expect(countOccurrences(svg, '"sc-l3"')).toBe(3); // heights >= 2
    expect(countOccurrences(svg, '"sc-l2"')).toBe(2); // heights >= 3
    // l1 pattern fill used only by height>=4 columns
    expect(countOccurrences(svg, 'url(#sc-contributions-l1)')).toBe(1);
  });

  it('height 1 shows only l4', () => {
    const svg = withoutLegend(render([1], { rows: '1' }));
    expect(countOccurrences(svg, '"sc-l4"')).toBe(1);
    expect(countOccurrences(svg, '"sc-l3"')).toBe(0);
    expect(countOccurrences(svg, '"sc-l2"')).toBe(0);
  });
});

describe('renderContributions geometry & validity', () => {
  it('produces valid, square-celled SVG', () => {
    const svg = render([1, 2, 3, 4, 5, 4, 3, 2]);
    const check = checkSvg(svg);
    expect(check.ok, check.errors.join('; ')).toBe(true);
  });

  it('cells are square (width == height)', () => {
    const history = historyFromAdds([1, 2, 3]);
    const config = makeConfig({ columns: '3', weeks: '3' });
    const model = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    const geo = contribGeometry(model);
    expect(geo.cell).toBeGreaterThan(2);
    expect(geo.gridHeight).toBe(geo.rows * geo.pitch - geo.gap);
  });

  it('uses GitHub contribution cell proportions for automatic geometry', () => {
    const history = historyFromAdds(new Array(52).fill(1));
    const config = makeConfig({ columns: '52', weeks: '52' });
    const model = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    const geo = contribGeometry(model);

    expect(geo.cell).toBe(12);
    expect(geo.gap).toBe(4);
    expect(geo.radius).toBe(2);
    expect(geo.gap / geo.cell).toBeCloseTo(3 / 10, 1);
    expect(geo.radius / geo.cell).toBeCloseTo(2 / 10, 1);
  });

  it('rejects impossible width/column combos', () => {
    const history = historyFromAdds(new Array(260).fill(1));
    const config = makeConfig({ columns: '260', weeks: '260', width: '240' });
    const model = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    expect(() => renderContributions(model)).toThrow(RenderError);
  });

  it('empty data renders a valid chart, not an exception', () => {
    const svg = render([0, 0, 0]);
    expect(svg).toContain('No recorded additions');
    expect(checkSvg(svg).ok).toBe(true);
  });

  it('custom palette overrides appear in both light and dark vars', () => {
    const svg = render([1, 2, 3], { theme: 'auto', level_4_color: '#123456' });
    expect(countOccurrences(svg, '#123456')).toBeGreaterThanOrEqual(2);
  });
});
