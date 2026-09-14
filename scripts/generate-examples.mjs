import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  aggregateHistories,
  aggregateMetadata,
  normalizeHistory,
  parseInputs,
  buildChartModel,
  renderChartGif,
  renderStarChart,
  renderMultiRepositoryStarChart,
} from '../dist/lib.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'examples');
mkdirSync(outDir, { recursive: true });

const WEEK = 7 * 86400000;
const AS_OF = Date.UTC(2026, 8, 6); // fixed clock for reproducibility

// Deterministic synthetic history: ~120 weeks of organic-looking growth.
function syntheticRaw(weeks, seedValue = 1337, scale = 1) {
  const start = AS_OF - (weeks - 1) * WEEK;
  const raw = [];
  let seed = seedValue;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < weeks; i += 1) {
    const trend = Math.max(0, Math.round(2 + i * 0.15 + 6 * Math.sin(i / 7)));
    const noise = Math.round(rand() * 3);
    const total = Math.max(0, Math.round((trend + noise) * scale));
    raw.push({
      timestamp: new Date(start + i * WEEK).toISOString(),
      total,
      days: [total, 0, 0, 0, 0, 0, 0],
    });
  }
  return raw;
}

const RAW = syntheticRaw(120);

const metadata = {
  owner: 'leereilly',
  repo: 'star-chart',
  fullName: 'leereilly/star-chart',
  createdAt: new Date(AS_OF - 119 * WEEK).toISOString(),
  stargazersCount: 2048,
};

// A second and third repository, aggregated into the "aggregate-*" examples.
const SIBLING_RAW = syntheticRaw(96, 90210, 0.6);
const THIRD_RAW = syntheticRaw(72, 4711, 0.35);

const siblingMetadata = {
  owner: 'leereilly',
  repo: 'star-chart-docs',
  fullName: 'leereilly/star-chart-docs',
  createdAt: new Date(AS_OF - 95 * WEEK).toISOString(),
  stargazersCount: 734,
};

const thirdMetadata = {
  owner: 'leereilly',
  repo: 'star-chart-examples',
  fullName: 'leereilly/star-chart-examples',
  createdAt: new Date(AS_OF - 71 * WEEK).toISOString(),
  stargazersCount: 256,
};

const SINGLE = {
  metadata,
  history: normalizeHistory(RAW, { asOf: AS_OF }),
};

const AGGREGATE = {
  metadata: aggregateMetadata([metadata, siblingMetadata, thirdMetadata]),
  history: aggregateHistories([
    normalizeHistory(RAW, { asOf: AS_OF }),
    normalizeHistory(SIBLING_RAW, { asOf: AS_OF }),
    normalizeHistory(THIRD_RAW, { asOf: AS_OF }),
  ]),
};

const COMPARISON = [
  SINGLE,
  {
    metadata: siblingMetadata,
    history: normalizeHistory(SIBLING_RAW, { asOf: AS_OF }),
  },
  {
    metadata: thirdMetadata,
    history: normalizeHistory(THIRD_RAW, { asOf: AS_OF }),
  },
];

function generate(name, inputs, source = SINGLE, directory = outDir) {
  const { config } = parseInputs({
    repository: 'leereilly/star-chart',
    ...inputs,
  });
  const svg = Array.isArray(source)
    ? renderMultiRepositoryStarChart(config, source, AS_OF)
    : renderStarChart(config, source.metadata, source.history, AS_OF);
  writeFileSync(join(directory, `${name}.svg`), svg);
  return svg.length;
}

const jobs = [];
const styles = [
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
];
for (const style of styles) {
  for (const theme of ['light', 'dark']) {
    jobs.push(
      style === 'clustered-bar'
        ? [
            `${style}-${theme}`,
            {
              style,
              theme,
              columns: '12',
              repositories: COMPARISON.map((s) => s.metadata.fullName).join(
                ',',
              ),
            },
            COMPARISON,
          ]
        : [`${style}-${theme}`, { style, theme }],
    );
  }
}

// Animated contributions heroes (once + loop) in both themes. Rendered at 2x
// the default width so the README hero stays legible at display size; the
// axis legend is doubled to match, otherwise 10px date labels shrink to ~6px
// once the browser scales the 1800px source down to the 1080px display width.
const HERO_WIDTH = '1800';
const HERO_AXIS_FONT_SIZE = '20';
for (const theme of ['light', 'dark']) {
  jobs.push([
    `contributions-animated-once-${theme}`,
    {
      style: 'contributions',
      theme,
      animation: 'once',
      width: HERO_WIDTH,
      axis_font_size: HERO_AXIS_FONT_SIZE,
    },
  ]);
  jobs.push([
    `contributions-animated-loop-${theme}`,
    {
      style: 'contributions',
      theme,
      animation: 'loop',
      width: HERO_WIDTH,
      axis_font_size: HERO_AXIS_FONT_SIZE,
    },
  ]);
}

// Explicit static aliases used in docs.
jobs.push([
  'contributions-static-light',
  { style: 'contributions', theme: 'light' },
]);
jobs.push([
  'contributions-static-dark',
  { style: 'contributions', theme: 'dark' },
]);

// Auto theme + custom palette example.
jobs.push([
  'contributions-auto-custom',
  {
    style: 'contributions',
    theme: 'auto',
    level_1_color: '#a5d6ff',
    level_2_color: '#54aeff',
    level_3_color: '#0969da',
    level_4_color: '#0a3069',
  },
]);

// Backgrounds: explicit solid fills instead of the transparent default.
jobs.push([
  'contributions-solid-dark',
  {
    style: 'contributions',
    theme: 'dark',
    background_mode: 'solid',
    background: '#0d1117',
  },
]);
jobs.push([
  'line-solid-light',
  {
    style: 'line',
    theme: 'light',
    background_mode: 'solid',
    background: '#ffffff',
  },
]);

// Time windows: the shortest and the longest.
jobs.push([
  'contributions-period-3m-light',
  { style: 'contributions', theme: 'light', period: '3m' },
]);
jobs.push([
  'area-period-all-dark',
  { style: 'area', theme: 'dark', period: 'all' },
]);

// Compare the same cumulative history and window with only the scale changed.
for (const scale of ['absolute', 'visible']) {
  jobs.push([
    `line-period-3m-scale-${scale}-light`,
    {
      style: 'line',
      theme: 'light',
      period: '3m',
      scale,
      axis_font_size: '20',
    },
  ]);
}

// Alternative animation styles on conventional charts.
jobs.push([
  'line-animated-reveal-light',
  {
    style: 'line',
    theme: 'light',
    animation: 'once',
    animation_style: 'reveal',
  },
]);
jobs.push([
  'bar-animated-cascade-dark',
  {
    style: 'bar',
    theme: 'dark',
    animation: 'loop',
    animation_style: 'cascade',
  },
]);

// Multi-repository aggregates: one chart summing three repositories.
const aggregateJobs = [
  ['aggregate-contributions-light', { style: 'contributions', theme: 'light' }],
  ['aggregate-contributions-dark', { style: 'contributions', theme: 'dark' }],
  ['aggregate-line-light', { style: 'line', theme: 'light' }],
];
for (const [name, inputs] of aggregateJobs) {
  jobs.push([name, inputs, AGGREGATE]);
}

let total = 0;
for (const [name, inputs, source] of jobs) {
  const bytes = generate(name, inputs, source);
  total += bytes;
  console.log(`  ${name}.svg  ${(bytes / 1024).toFixed(1)} KB`);
}
console.log(
  `Generated ${jobs.length} example SVGs (${(total / 1024).toFixed(0)} KB total).`,
);

// Reuse the full catalog for Pages, keeping its source histories and options
// while making the synthetic branding explicit, including comparison legends.
const siteDir = join(root, 'docs', 'samples');
mkdirSync(siteDir, { recursive: true });
const siteComparison = COMPARISON.map((source, index) => ({
  ...source,
  metadata: {
    ...source.metadata,
    owner: 'sample',
    repo: `synthetic-${index + 1}`,
    fullName:
      index === 0
        ? 'Synthetic demonstration'
        : `Synthetic demonstration ${index + 1}`,
    stargazersCount: source.history.totalAdded,
  },
}));
const siteAggregate = {
  ...AGGREGATE,
  metadata: aggregateMetadata(siteComparison.map((source) => source.metadata)),
};
for (const [name, inputs, source = SINGLE] of jobs) {
  const siteSource =
    source === AGGREGATE
      ? siteAggregate
      : Array.isArray(source)
        ? siteComparison
        : siteComparison[0];
  generate(
    name,
    {
      ...inputs,
      ...(inputs.repositories
        ? {
            repositories: siteComparison
              .map(({ metadata }) => `${metadata.owner}/${metadata.repo}`)
              .join(','),
          }
        : {}),
    },
    siteSource,
    siteDir,
  );
}
console.log(`Generated ${jobs.length} synthetic example SVGs for docs/.`);

// Root README GIF: a raster rendering of the light animated contributions hero
// (`contributions-animated-once-light`), with the shading legend row hidden via
// `show_legend: false`. The committed SVG examples and the site keep their
// legends; this is the single showcase GIF referenced from the README.
const { config: leeConfig } = parseInputs({
  repository: 'leereilly/star-chart',
  style: 'contributions',
  theme: 'light',
  animation: 'once',
  show_legend: 'false',
});
const leeModel = buildChartModel(leeConfig, metadata, SINGLE.history, {
  asOf: AS_OF,
});
const leeGif = await renderChartGif(leeModel, { width: 720, fps: 16 });
writeFileSync(join(root, 'lee.gif'), leeGif.buffer);
console.log(
  `Generated lee.gif (${leeGif.frameCount} frames, ` +
    `${leeGif.width}x${leeGif.height}, ` +
    `${(leeGif.bytes / 1024).toFixed(0)} KB).`,
);

// Sanity: ensure every example is non-empty and starts with <svg.
for (const [name] of jobs) {
  for (const directory of [outDir, siteDir]) {
    const svg = readFileSync(join(directory, `${name}.svg`), 'utf8');
    if (!svg.startsWith('<svg')) {
      throw new Error(
        `Example ${join(directory, `${name}.svg`)} is malformed.`,
      );
    }
  }
}
