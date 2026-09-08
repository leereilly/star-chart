import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type {
  ChartConfig,
  NormalizedHistory,
  RepositoryMetadata,
} from '../../src/models/index.js';
import type { RawWeek } from '../../src/api/history.js';
import { parseInputs, type RawInputs } from '../../src/config/inputs.js';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Creates a repo-local scratch directory (never uses the OS temp dir). */
export function makeScratchDir(prefix = 'sctmp-'): string {
  const base = join(process.cwd(), '.scratch');
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, prefix));
}

export const MS_WEEK = 7 * 86_400_000;

/** Exclude explanatory swatches when asserting data marks and geometry. */
export function withoutLegend(svg: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  for (const group of Array.from(document.getElementsByTagName('g'))) {
    if (group.getAttribute('class') === 'sc-legend')
      group.parentNode?.removeChild(group);
  }
  return new XMLSerializer().serializeToString(document);
}
export const FIXED_NOW = Date.UTC(2026, 8, 6); // 2026-09-06 UTC

/** Builds a ChartConfig from raw inputs with a default repository. */
export function makeConfig(raw: RawInputs = {}): ChartConfig {
  return parseInputs({ repository: 'octocat/hello-world', ...raw }).config;
}

export function makeMetadata(
  overrides: Partial<RepositoryMetadata> = {},
): RepositoryMetadata {
  return {
    owner: 'octocat',
    repo: 'hello-world',
    fullName: 'octocat/hello-world',
    createdAt: new Date(FIXED_NOW - 120 * MS_WEEK).toISOString(),
    stargazersCount: 1234,
    ...overrides,
  };
}

/** Builds raw weekly history ending at `endTime` from an array of additions. */
export function rawWeeksFromAdds(
  adds: number[],
  endTime = FIXED_NOW,
): RawWeek[] {
  const n = adds.length;
  const startTime = endTime - (n - 1) * MS_WEEK;
  return adds.map((total, i) => ({
    timestamp: new Date(startTime + i * MS_WEEK).toISOString(),
    total,
    days: [total, 0, 0, 0, 0, 0, 0],
  }));
}

/** Builds a NormalizedHistory directly from additions (no gaps). */
export function historyFromAdds(
  adds: number[],
  endTime = FIXED_NOW,
): NormalizedHistory {
  const weeks = rawWeeksFromAdds(adds, endTime).map((w) => ({
    timestamp: w.timestamp,
    time: Date.parse(w.timestamp),
    added: w.total,
    synthetic: false,
  }));
  const cumulative: number[] = [];
  let running = 0;
  for (const w of weeks) {
    running += w.added;
    cumulative.push(running);
  }
  return {
    weeks,
    cumulative,
    hasSyntheticWeeks: false,
    totalAdded: running,
  };
}

export interface XmlCheck {
  readonly ok: boolean;
  readonly errors: string[];
  readonly ids: string[];
  readonly missingRefs: string[];
}

/**
 * Parses an SVG string, asserting well-formedness, unique ids, resolvable
 * url(#..) references, no scripts/external resources, and finite geometry.
 */
export function checkSvg(svg: string): XmlCheck {
  const errors: string[] = [];
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') {
        errors.push(message);
      }
    },
  });
  parser.parseFromString(svg, 'image/svg+xml');

  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1] as string);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Duplicate id: ${id}`);
    }
    seen.add(id);
  }

  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] as string);
  const idSet = new Set(ids);
  const missingRefs = refs.filter((r) => !idSet.has(r));
  for (const r of missingRefs) {
    errors.push(`Unresolved reference: url(#${r})`);
  }

  if (/<script/i.test(svg)) {
    errors.push('Contains <script>');
  }
  if (/foreignObject/i.test(svg)) {
    errors.push('Contains <foreignObject>');
  }
  if (/href="https?:|xlink:href/i.test(svg)) {
    errors.push('Contains external resource reference');
  }

  // Finite geometry: scan numeric attributes for NaN/Infinity tokens.
  if (/(NaN|Infinity|undefined|null)/.test(svg)) {
    errors.push('Contains non-finite or invalid token');
  }

  return {
    ok: errors.length === 0,
    errors,
    ids,
    missingRefs,
  };
}
