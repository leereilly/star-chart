import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import type { RawWeek } from '../src/api/history.js';
import type { RepositoryMetadata } from '../src/models/index.js';
import { normalizeHistory } from '../src/history/normalize.js';
import { buildChartModel } from '../src/history/model.js';
import { parseInputs } from '../src/config/inputs.js';
import { renderChart } from '../src/renderers/index.js';

interface Snapshot {
  schemaVersion: number;
  startedAt: string;
  asOf: string;
  provenance: { source: string; apiVersion: string; semantics: string };
  repositories: {
    metadata: RepositoryMetadata;
    provenance: {
      metadataUrl: string;
      historyUrl: string;
      pages: number;
      recordedTotal: number;
      currentMinusRecorded: number;
    };
    raw: RawWeek[];
  }[];
}
const fixtureText = readFileSync(
  'scripts/fixtures/github-star-history.json',
  'utf8',
);
const snapshot: Snapshot = JSON.parse(fixtureText);
const rails = snapshot.repositories[0]!;
const asOf = Date.parse(snapshot.asOf);
const history = normalizeHistory(rails.raw, { asOf });

describe('authentic frozen showcase data', () => {
  it('pins verified creation, counts, capture time and native API provenance', () => {
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.asOf).toBe('2026-09-14T03:45:49.440Z');
    expect(Date.parse(snapshot.startedAt)).toBeLessThanOrEqual(asOf);
    expect(snapshot.provenance.source).toBe('GitHub REST API');
    expect(snapshot.provenance.apiVersion).toBe('2022-11-28');
    expect(snapshot.provenance.semantics).toContain('no scaling');
    expect(rails.metadata).toEqual({
      owner: 'rails',
      repo: 'rails',
      fullName: 'rails/rails',
      createdAt: '2008-04-11T02:19:47Z',
      stargazersCount: 58751,
    });
    expect(rails.provenance).toEqual({
      metadataUrl: 'https://api.github.com/repos/rails/rails',
      historyUrl:
        'https://api.github.com/repos/rails/rails/stargazers/history?per_page=30',
      pages: 33,
      recordedTotal: 58750,
      currentMinusRecorded: 1,
    });
    expect(rails.raw).toHaveLength(963);
    expect(rails.raw[0]).toEqual({
      timestamp: '2008-04-06T00:00:00.000Z',
      total: 927,
      days: [0, 0, 0, 0, 862, 57, 8],
    });
    expect(rails.raw.at(-1)).toEqual({
      timestamp: '2026-09-13T00:00:00.000Z',
      total: 3,
      days: [3, 0, 0, 0, 0, 0, 0],
    });
  });

  it('keeps original weekly counts for every real repository without account data', () => {
    expect(
      snapshot.repositories.map(({ metadata }) => [
        metadata.fullName,
        metadata.stargazersCount,
      ]),
    ).toEqual([
      ['rails/rails', 58751],
      ['rails/propshaft', 1044],
      ['rails/sprockets-rails', 593],
    ]);
    for (const source of snapshot.repositories) {
      const normalized = normalizeHistory(source.raw, { asOf });
      expect(normalized.totalAdded).toBe(source.provenance.recordedTotal);
      expect(source.metadata.stargazersCount - normalized.totalAdded).toBe(
        source.provenance.currentMinusRecorded,
      );
      expect(normalized.hasSyntheticWeeks).toBe(false);
      expect(new Set(source.raw.map((week) => week.timestamp)).size).toBe(
        source.raw.length,
      );
      for (const week of source.raw) {
        expect(Object.keys(week).sort()).toEqual([
          'days',
          'timestamp',
          'total',
        ]);
      }
    }
    expect(fixtureText).not.toMatch(
      /"(?:login|avatar_url|user|token|authorization|email|starred_at)"\s*:/i,
    );
  });

  it('renders the real 18-year lifetime in 52 columns and preserves explicit windows', () => {
    for (const inputs of [{}, { period: 'all' }, { period: '3m' }]) {
      const { config } = parseInputs({
        repository: 'rails/rails',
        ...inputs,
      });
      const model = buildChartModel(config, rails.metadata, history, { asOf });
      expect(model.currentStars).toBe(58751);
      expect(model.buckets.at(-1)?.cumulative).toBe(58750);
      expect(model.buckets).toHaveLength(52);
      if (inputs.period === '3m') {
        expect(model.selectedWeeks).toHaveLength(13);
        expect(model.baseline).toBeGreaterThan(58000);
      } else {
        expect(model.periodStart).toBe('2008-04-11');
        expect(model.periodEnd).toBe('2026-09-14');
        expect(model.selectedWeeks).toHaveLength(963);
        expect(model.buckets[0]?.startTime).toBe(
          Date.parse(rails.metadata.createdAt),
        );
        expect(model.buckets.at(-1)?.endTime).toBe(asOf);
        expect(model.windowAdded).toBe(58750);
        const svg = renderChart(model).svg;
        expect(svg).toContain('58,751');
        expect(svg).toContain('58,750 recorded additions');
        expect(svg).toContain('Apr 2008');
        expect(svg).toContain('Sep 2026');
      }
    }
  });

  it('uses the snapshot across both complete catalogs and brands only edges synthetic', () => {
    const files = readdirSync('examples').filter((name) =>
      name.endsWith('.svg'),
    );
    expect(files).toHaveLength(48);
    for (const file of files) {
      const svg = readFileSync(`examples/${file}`, 'utf8');
      expect(readFileSync(`docs/samples/${file}`, 'utf8')).toBe(svg);
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const provenance = JSON.parse(
        document.getElementsByTagName('metadata')[0]!.textContent!,
      );
      expect(provenance.asOf).toBe(snapshot.asOf);
      if (/^(zero-stars|one-star)-/.test(file)) {
        expect(svg).toContain('Synthetic demonstration');
        expect(svg).not.toContain('rails/rails');
        expect(provenance.source).toBe('Synthetic edge fixture');
      } else {
        expect(svg).toContain('rails/rails');
        expect(svg).toContain('GitHub snapshot 2026-09-14');
        expect(svg).not.toContain('Synthetic demonstration');
        expect(provenance.source).toBe('GitHub REST API');
        if (!/^(aggregate|clustered-bar)-/.test(file)) {
          expect(svg).toContain('58,751');
          expect(provenance.repositories).toHaveLength(1);
        }
      }
    }
  });

  it('ships matching videos with native history provenance, not synthetic metadata', () => {
    const video = readFileSync('assets/rails-rails-social-loop.mp4');
    expect(
      readFileSync('assets/rails-rails-social-loop-candidate.mp4').equals(
        video,
      ),
    ).toBe(true);
    const metadata = video.toString('latin1');
    expect(metadata).toContain('GitHub snapshot 2026-09-14');
    expect(metadata).toContain(
      'https://api.github.com/repos/rails/rails/stargazers/history',
    );
    expect(metadata).toContain('58751 current stars; 58750 recorded stars');
    expect(metadata).toContain(`asOf=${snapshot.asOf}`);
    expect(metadata).not.toContain('synthetic example');
  });
});
