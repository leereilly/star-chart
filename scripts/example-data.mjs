import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeHistory } from '../dist/lib.js';

export const snapshot = JSON.parse(
  readFileSync(
    new URL('./fixtures/github-star-history.json', import.meta.url),
    'utf8',
  ),
);
assert.equal(snapshot.schemaVersion, 1);
export const AS_OF = Date.parse(snapshot.asOf);
assert.ok(Number.isFinite(AS_OF), 'Invalid example snapshot clock');
export const SOURCES = snapshot.repositories.map(
  ({ metadata, provenance, raw }) => {
    const history = normalizeHistory(raw, { asOf: AS_OF, warn: console.warn });
    assert.equal(history.totalAdded, provenance.recordedTotal);
    assert.equal(
      metadata.stargazersCount - history.totalAdded,
      provenance.currentMinusRecorded,
    );
    return { metadata, history };
  },
);
assert.deepEqual(
  SOURCES.map(({ metadata }) => metadata.fullName),
  ['rails/rails', 'rails/propshaft', 'rails/sprockets-rails'],
);

export const SNAPSHOT_LABEL = `GitHub snapshot ${snapshot.asOf.slice(0, 10)}`;
