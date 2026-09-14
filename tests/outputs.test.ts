import { describe, it, expect } from 'vitest';
import {
  INFINITE_GROWTH,
  OUTPUT_NAMES,
  buildOutputs,
  buildPictureSnippet,
  chartAltText,
  formatGrowthPercentage,
  outputEntries,
} from '../src/outputs.js';
import { buildChartModel } from '../src/history/model.js';
import {
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
} from './helpers/index.js';

function model(
  adds: number[],
  raw: Record<string, string | undefined> = {},
  metadata = makeMetadata(),
) {
  return buildChartModel(makeConfig(raw), metadata, historyFromAdds(adds), {
    asOf: FIXED_NOW,
  });
}

describe('formatGrowthPercentage', () => {
  it('formats a positive baseline to two decimals', () => {
    expect(formatGrowthPercentage(200, 25)).toBe('12.50%');
    expect(formatGrowthPercentage(3, 1)).toBe('33.33%');
    expect(formatGrowthPercentage(100, 0)).toBe('0.00%');
    expect(formatGrowthPercentage(100, 250)).toBe('250.00%');
  });

  it('reports no growth from a zero baseline with no additions', () => {
    expect(formatGrowthPercentage(0, 0)).toBe('0.00%');
  });

  it('reports infinite growth from a zero baseline with additions', () => {
    expect(formatGrowthPercentage(0, 1)).toBe(INFINITE_GROWTH);
    expect(formatGrowthPercentage(0, 5_000)).toBe('∞');
  });
});

describe('buildPictureSnippet', () => {
  it('pairs a dark source with a light fallback', () => {
    const snippet = buildPictureSnippet({
      lightPath: 'assets/chart-light.svg',
      darkPath: 'assets/chart-dark.svg',
      alt: 'Star history for octocat/hello-world',
      width: 1080,
    });
    expect(snippet).toContain(
      '<source media="(prefers-color-scheme: dark)" srcset="assets/chart-dark.svg">',
    );
    expect(snippet).toContain(
      '<img alt="Star history for octocat/hello-world" src="assets/chart-light.svg" width="1080">',
    );
    expect(snippet.startsWith('<picture>')).toBe(true);
    expect(snippet.trimEnd().endsWith('</picture>')).toBe(true);
    // Relative paths only: nothing absolute or host-qualified.
    expect(snippet).not.toMatch(/src(set)?="(\/|https?:)/);
  });

  it('omits the width when it is not supplied', () => {
    const snippet = buildPictureSnippet({
      lightPath: 'l.svg',
      darkPath: 'd.svg',
      alt: 'x',
    });
    expect(snippet).toContain('<img alt="x" src="l.svg">');
  });

  it('escapes attribute values', () => {
    const snippet = buildPictureSnippet({
      lightPath: 'a"b/chart-light.svg',
      darkPath: 'a&b/chart-dark.svg',
      alt: 'Stars for <script>alert("x")</script> & friends',
    });
    expect(snippet).toContain('srcset="a&amp;b/chart-dark.svg"');
    expect(snippet).toContain('src="a&quot;b/chart-light.svg"');
    expect(snippet).toContain(
      'alt="Stars for &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; friends"',
    );
    expect(snippet).not.toContain('<script>');
  });

  it('escapes control characters out of the alt text', () => {
    expect(chartAltText(model([1], { title: 'Clean Title' }))).toBe(
      'Star history for Clean Title',
    );
    expect(chartAltText(model([1]))).toBe(
      'Star history for octocat/hello-world',
    );
  });
});

describe('buildOutputs', () => {
  it('leaves dual-only values empty in single mode', () => {
    const outputs = buildOutputs(model([1, 2, 3]), {
      chartPath: 'assets/chart.svg',
    });
    expect(outputs.chartPath).toBe('assets/chart.svg');
    expect(outputs.chartPathLight).toBe('');
    expect(outputs.chartPathDark).toBe('');
    expect(outputs.pictureSnippet).toBe('');
  });

  it('populates paths and the snippet in dual mode', () => {
    const outputs = buildOutputs(model([1, 2, 3]), {
      chartPath: 'assets/chart-light.svg',
      chartPathLight: 'assets/chart-light.svg',
      chartPathDark: 'assets/chart-dark.svg',
    });
    expect(outputs.chartPath).toBe('assets/chart-light.svg');
    expect(outputs.chartPathLight).toBe('assets/chart-light.svg');
    expect(outputs.chartPathDark).toBe('assets/chart-dark.svg');
    expect(outputs.pictureSnippet).toContain('assets/chart-dark.svg');
    expect(outputs.pictureSnippet).toContain('assets/chart-light.svg');
    expect(outputs.pictureSnippet).toContain('width="900"');
  });

  it('derives growth from the pre-window baseline', () => {
    // 6 weeks of history, a 3-week window: baseline 30, added 3.
    const outputs = buildOutputs(model([10, 10, 10, 1, 1, 1], { weeks: '3' }), {
      chartPath: 'c.svg',
    });
    expect(outputs.starsAdded).toBe(3);
    expect(outputs.growthPercentage).toBe('10.00%');
  });

  it('reports infinite growth when the window starts from nothing', () => {
    const outputs = buildOutputs(model([0, 0, 5]), { chartPath: 'c.svg' });
    expect(outputs.growthPercentage).toBe(INFINITE_GROWTH);
  });

  it('reports the peak source week, not a bucket total', () => {
    const outputs = buildOutputs(model([2, 2, 7, 2], { columns: '2' }), {
      chartPath: 'c.svg',
    });
    expect(outputs.peakGain).toBe(7);
  });

  it('maps every value onto a declared output name', () => {
    const outputs = buildOutputs(model([1, 2]), {
      chartPath: 'c.svg',
      chartPathLight: 'c-light.svg',
      chartPathDark: 'c-dark.svg',
    });
    const entries = outputEntries(outputs);
    expect(entries.map(([name]) => name)).toEqual([...OUTPUT_NAMES]);
    for (const [name, value] of entries) {
      expect(typeof value, name).toBe('string');
    }
  });
});
