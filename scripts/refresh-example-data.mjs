import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const repositories = [
  'rails/rails',
  'rails/propshaft',
  'rails/sprockets-rails',
];
const startedAt = new Date().toISOString();

function api(endpoint, flags = []) {
  const result = spawnSync(
    'gh',
    [
      'api',
      '--hostname',
      'github.com',
      '-H',
      'Accept: application/vnd.github+json',
      '-H',
      'X-GitHub-Api-Version: 2022-11-28',
      ...flags,
      endpoint,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`GitHub request failed for ${endpoint}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const sources = [];
for (const fullName of repositories) {
  const rate = api('rate_limit').resources.core;
  assert.ok(
    rate.remaining >= 150,
    `Insufficient API budget (${rate.remaining}); retry after ${new Date(rate.reset * 1000).toISOString()}`,
  );
  // gh follows every Link: next, including GitHub's numeric repository URLs.
  // The native endpoint returns only weekly counts, never account identities.
  const endpoint = `repos/${fullName}/stargazers/history`;
  const pages = api(`${endpoint}?per_page=30`, ['--paginate', '--slurp']);
  assert.ok(Array.isArray(pages) && pages.length > 0);
  const seen = new Set();
  const raw = pages
    .flatMap((page) => {
      assert.ok(Array.isArray(page), `Invalid history page for ${fullName}`);
      return page.map(({ week, total, days }) => {
        assert.ok(Number.isSafeInteger(week) && week > 0);
        assert.ok(!seen.has(week), `Duplicate week in ${fullName}`);
        seen.add(week);
        assert.ok(Number.isSafeInteger(total) && total >= 0);
        assert.ok(
          Array.isArray(days) &&
            days.length === 7 &&
            days.every((day) => Number.isSafeInteger(day) && day >= 0),
        );
        assert.equal(
          days.reduce((sum, day) => sum + day, 0),
          total,
        );
        assert.ok(week * 1000 <= Date.now(), 'Future weekly observation');
        return { timestamp: new Date(week * 1000).toISOString(), total, days };
      });
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  assert.ok(raw.length > 0, `Empty history for ${fullName}`);
  const data = api(`repos/${fullName}`, [
    '--jq',
    '{full_name,created_at,stargazers_count}',
  ]);
  assert.equal(data.full_name, fullName);
  assert.ok(Number.isFinite(Date.parse(data.created_at)));
  assert.ok(
    Number.isSafeInteger(data.stargazers_count) && data.stargazers_count >= 0,
  );
  const [owner, repo] = fullName.split('/');
  const recordedTotal = raw.reduce((sum, week) => sum + week.total, 0);
  sources.push({
    metadata: {
      owner,
      repo,
      fullName,
      createdAt: data.created_at,
      stargazersCount: data.stargazers_count,
    },
    provenance: {
      metadataUrl: `https://api.github.com/repos/${fullName}`,
      historyUrl: `https://api.github.com/${endpoint}?per_page=30`,
      pages: pages.length,
      recordedTotal,
      currentMinusRecorded: data.stargazers_count - recordedTotal,
    },
    raw,
  });
  console.log(
    `${fullName}: ${data.stargazers_count} current stars, ${recordedTotal} recorded stars, ${raw.length} weeks (${pages.length} pages)`,
  );
}

const snapshot = {
  schemaVersion: 1,
  startedAt,
  asOf: new Date().toISOString(),
  provenance: {
    source: 'GitHub REST API',
    apiVersion: '2022-11-28',
    method:
      'Authenticated gh api; all Link: next pages of native weekly history',
    semantics:
      'Unmodified native weekly recorded additions, not a reconstructed unstar ledger. Current metadata and recorded totals may differ; no scaling or invented additions. Requests are sequential, not an atomic snapshot.',
  },
  repositories: sources,
};
mkdirSync(directory, { recursive: true });
const target = join(directory, 'github-star-history.json');
writeFileSync(`${target}.tmp`, `${JSON.stringify(snapshot)}\n`);
renameSync(`${target}.tmp`, target);
console.log(`Saved authenticated GitHub snapshot as of ${snapshot.asOf}`);
