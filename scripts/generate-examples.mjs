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
import { AS_OF, SOURCES, SNAPSHOT_LABEL, snapshot } from './example-data.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'examples');
mkdirSync(outDir, { recursive: true });

const WEEK = 7 * 86400000;
const [SINGLE] = SOURCES;
const { metadata } = SINGLE;

function edgeCaseSource(total) {
  return {
    metadata: {
      owner: 'sample',
      repo: total === 0 ? 'zero-stars' : 'one-star',
      fullName: `Synthetic demonstration: ${total === 0 ? 'zero' : 'one'} star`,
      createdAt: new Date(AS_OF - WEEK).toISOString(),
      stargazersCount: total,
    },
    history: normalizeHistory(
      total === 0
        ? []
        : [
            {
              timestamp: new Date(AS_OF).toISOString(),
              total,
              days: [total, 0, 0, 0, 0, 0, 0],
            },
          ],
      { asOf: AS_OF },
    ),
  };
}

const ZERO_STARS = edgeCaseSource(0);
const ONE_STAR = edgeCaseSource(1);

const AGGREGATE = {
  metadata: aggregateMetadata(SOURCES.map((source) => source.metadata)),
  history: aggregateHistories(SOURCES.map((source) => source.history)),
};

const COMPARISON = SOURCES;

function generate(name, inputs, source = SINGLE, directory = outDir) {
  const synthetic = source === ZERO_STARS || source === ONE_STAR;
  const title = Array.isArray(source)
    ? aggregateMetadata(source.map((item) => item.metadata)).fullName
    : source.metadata.fullName;
  const { config } = parseInputs({
    repository: 'rails/rails',
    title: synthetic ? title : `${title} | ${SNAPSHOT_LABEL}`,
    ...inputs,
  });
  const rendered = Array.isArray(source)
    ? renderMultiRepositoryStarChart(config, source, AS_OF)
    : renderStarChart(config, source.metadata, source.history, AS_OF);
  const provenance = synthetic
    ? { source: 'Synthetic edge fixture', asOf: snapshot.asOf }
    : {
        ...snapshot.provenance,
        asOf: snapshot.asOf,
        repositories: snapshot.repositories
          .filter(
            ({ metadata }) =>
              source !== SINGLE || metadata.fullName === 'rails/rails',
          )
          .map(({ metadata, provenance }) => ({ metadata, provenance })),
      };
  const escaped = JSON.stringify(provenance)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const svg = rendered.replace(
    /(<svg[^>]*>)/,
    `$1<metadata id="example-provenance">${escaped}</metadata>`,
  );
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

jobs.push([
  'zero-stars-light',
  { style: 'contributions', theme: 'light' },
  ZERO_STARS,
]);
jobs.push([
  'one-star-light',
  { style: 'contributions', theme: 'light' },
  ONE_STAR,
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

// Pages shows the same frozen repository data, not data for the entered repo.
const siteDir = join(root, 'docs', 'samples');
mkdirSync(siteDir, { recursive: true });
for (const [name, inputs, source = SINGLE] of jobs) {
  generate(name, inputs, source, siteDir);
}
console.log(`Generated ${jobs.length} matching example SVGs for docs/.`);

// Root README GIF: a raster rendering of the light animated contributions hero
// (`contributions-animated-once-light`), with the shading legend row hidden via
// `show_legend: false`. The committed SVG examples and the site keep their
// legends; this is the single showcase GIF referenced from the README.
const { config: leeConfig } = parseInputs({
  repository: 'rails/rails',
  title: `rails/rails | ${SNAPSHOT_LABEL}`,
  style: 'contributions',
  theme: 'light',
  animation: 'once',
  show_legend: 'false',
  show_total: 'true',
  show_change: 'false',
});
const leeModel = buildChartModel(leeConfig, metadata, SINGLE.history, {
  asOf: AS_OF,
});
const leeGif = await renderChartGif(leeModel, {
  width: 720,
  fps: 16,
  trimVertical: true,
});
writeFileSync(join(root, 'lee.gif'), leeGif.buffer);
console.log(
  `Generated lee.gif (${leeGif.frameCount} frames, ` +
    `${leeGif.width}x${leeGif.height}, ` +
    `${(leeGif.bytes / 1024).toFixed(0)} KB).`,
);

if (process.argv.includes('--videos')) {
  const { generateVideos } = await import('./generate-videos.mjs');
  await generateVideos(root, SINGLE, AS_OF);
}

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
