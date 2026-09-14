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

// Small, fixed-clock renders keep snapshots deterministic and reviewable.
const ADDS = [1, 2, 0, 3, 5, 4, 6, 8];

function render(style: ChartStyle, extra: Record<string, string> = {}): string {
  const history = historyFromAdds(ADDS);
  const config = makeConfig({
    style,
    columns: '8',
    weeks: '8',
    rows: '10',
    width: '360',
    logo: 'false',
    ...extra,
  });
  const model = buildChartModel(config, makeMetadata(), history, {
    asOf: FIXED_NOW,
  });
  return renderChart(model).svg;
}

describe('deterministic SVG snapshots', () => {
  for (const style of [
    'contributions',
    'line',
    'area',
    'bar',
    'sparkline',
    'grid',
    'step-line',
    'milestone-scatter',
    'milestone-area',
    'clustered-bar',
    'neon-glow',
    'neon-glow-stream',
    'ascii-terminal',
    'hand-drawn',
  ] as ChartStyle[]) {
    it(`${style} (light) is stable and valid XML`, () => {
      const svg = render(style);
      expect(checkSvg(svg).ok).toBe(true);
      expect(svg).toMatchSnapshot();
    });
  }

  it('contributions (dark) is stable', () => {
    const svg = render('contributions', { theme: 'dark' });
    expect(checkSvg(svg).ok).toBe(true);
    expect(svg).toMatchSnapshot();
  });

  it('renders identically for the same inputs (no clock drift)', () => {
    expect(render('contributions')).toBe(render('contributions'));
  });
});
