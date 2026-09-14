import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { INPUT_NAMES } from '../src/run.js';
import { OUTPUT_NAMES } from '../src/outputs.js';
import { DEFAULT_AXIS_FONT_SIZE } from '../src/config/defaults.js';

interface ActionYml {
  name: string;
  description: string;
  runs: { using: string; main: string };
  inputs: Record<string, { description?: string; default?: string }>;
  outputs: Record<string, { description?: string }>;
}

const action = parseYaml(readFileSync('action.yml', 'utf8')) as ActionYml;
const generator = readFileSync('scripts/generate-examples.mjs', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const docs = readFileSync('docs/index.html', 'utf8');

describe('action.yml metadata', () => {
  it('has the marketplace name and description', () => {
    expect(action.name).toBe('Star Chart');
    expect(action.description).toMatch(/self-updating star history/i);
  });

  it('runs on node24 with the bundled entrypoint', () => {
    expect(action.runs.using).toBe('node24');
    expect(action.runs.main).toBe('dist/index.js');
  });

  it('declares exactly the inputs the parser consumes', () => {
    const declared = Object.keys(action.inputs).sort();
    const consumed = [...INPUT_NAMES].sort();
    expect(declared).toEqual(consumed);
  });

  it('declares the documented outputs', () => {
    expect(Object.keys(action.outputs).sort()).toEqual(
      [
        'chart_path',
        'chart_path_light',
        'chart_path_dark',
        'growth_percentage',
        'peak_gain',
        'period_end',
        'period_start',
        'picture_snippet',
        'stars',
        'stars_added',
      ].sort(),
    );
  });

  it('declares exactly the outputs the pipeline sets', () => {
    expect(Object.keys(action.outputs).sort()).toEqual(
      [...OUTPUT_NAMES].sort(),
    );
  });

  it('every output has a description', () => {
    for (const [name, output] of Object.entries(action.outputs)) {
      expect(output.description, `output ${name}`).toBeTruthy();
    }
  });

  it('leaves period and weeks defaults empty to preserve intent', () => {
    expect(action.inputs.period?.default).toBe('');
    expect(action.inputs.weeks?.default).toBe('');
  });

  it('defaults repositories to empty and dual_theme to false', () => {
    expect(action.inputs.repositories?.default).toBe('');
    expect(action.inputs.dual_theme?.default).toBe('false');
  });

  it('defaults background_mode to empty for legacy inference', () => {
    expect(action.inputs.background_mode?.default).toBe('');
  });

  it('documents effective defaults matching the parser', () => {
    expect(action.inputs.style?.default).toBe('contributions');
    expect(action.inputs.theme?.default).toBe('light');
    expect(action.inputs.scale?.default).toBe('absolute');
    expect(action.inputs.output?.default).toBe('assets/star-chart.svg');
    expect(action.inputs.animation?.default).toBe('none');
    expect(action.inputs.animation_duration?.default).toBe('4s');
    expect(action.inputs.axis_font_size?.default).toBe(
      String(DEFAULT_AXIS_FONT_SIZE),
    );
  });

  it('every input has a description', () => {
    for (const [name, input] of Object.entries(action.inputs)) {
      expect(input.description, `input ${name}`).toBeTruthy();
    }
  });

  it('keeps published action references while removing the legacy website URL', () => {
    const trackedText = execFileSync('git', ['grep', '-Il', '.'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(trackedText).not.toMatch(
      /https?:\/\/leereilly\.github\.io\/star-chart\/?/,
    );
    expect(trackedText).toContain('https://leereilly.net/star-chart/');
    expect(trackedText).toContain('uses: leereilly/star-chart@v0.3');
  });

  it('pins installation guidance to the published v0.3 release', () => {
    for (const [name, content] of [
      ['README.md', readme],
      ['docs/index.html', docs],
    ] as const) {
      expect(content, name).toContain(
        'https://github.com/leereilly/star-chart/releases/tag/v0.3',
      );
      expect(content, name).not.toContain('leereilly/star-chart@v1');
      expect(content, name).not.toContain('leereilly/star-chart@v0.1');
      expect(content, name).not.toContain('leereilly/star-chart@v0.2');
    }
    expect(readme).toContain(
      'npm install https://github.com/leereilly/star-chart/archive/refs/tags/v0.3.tar.gz',
    );
    expect(readme).toContain("from 'star-chart-action'");
    expect(readme).not.toContain('npm install star-chart-action@0.3');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.version).toBe('0.3.0');
    expect(readme).toContain('package version `0.3.0`');
    const workflowExample = readFileSync(
      '.github/workflows/update-star-chart.yml',
      'utf8',
    );
    expect(workflowExample).toContain('uses: leereilly/star-chart@v0.3');
    expect(workflowExample).not.toContain('leereilly/star-chart@v1');
  });
});

describe('example generator fixtures', () => {
  it('loads frozen Rails data and keeps synthetic edges explicitly separate', () => {
    expect(generator).toContain("repository: 'rails/rails'");
    expect(generator).toContain("from './example-data.mjs'");
    expect(generator).toContain('const [SINGLE] = SOURCES');
    expect(generator).toContain("owner: 'sample'");
    expect(generator).toContain('Synthetic demonstration:');
    expect(generator).not.toContain('syntheticRaw');
    expect(generator).not.toContain("repository: 'leereilly/star-chart'");
    expect(generator).not.toContain('fullName: `sample/${name}`');
  });

  it('aggregates rails, propshaft, and sprockets-rails in stable order', () => {
    const snapshot = JSON.parse(
      readFileSync('scripts/fixtures/github-star-history.json', 'utf8'),
    );
    expect(
      snapshot.repositories.map(
        (source: { metadata: { fullName: string } }) =>
          source.metadata.fullName,
      ),
    ).toEqual(['rails/rails', 'rails/propshaft', 'rails/sprockets-rails']);
    expect(generator).toContain('const COMPARISON = SOURCES');
    expect(generator).toContain(
      'aggregateHistories(SOURCES.map((source) => source.history))',
    );
  });

  it('brands generated sources without leaking the former fixture', () => {
    expect(readFileSync('examples/contributions-light.svg', 'utf8')).toContain(
      'rails/rails | GitHub snapshot',
    );
    for (const name of ['zero-stars-light.svg', 'one-star-light.svg']) {
      const svg = readFileSync(`examples/${name}`, 'utf8');
      expect(svg).toContain(
        '<title id="sc-contributions-title">Synthetic demonstration:',
      );
      expect(svg).not.toContain('rails/rails');
    }

    const comparison = readFileSync('examples/clustered-bar-light.svg', 'utf8');
    expect(comparison.indexOf('rails/rails')).toBeLessThan(
      comparison.indexOf('rails/propshaft'),
    );
    expect(comparison.indexOf('rails/propshaft')).toBeLessThan(
      comparison.indexOf('rails/sprockets-rails'),
    );

    for (const file of readdirSync('examples').filter((name) =>
      name.endsWith('.svg'),
    )) {
      expect(readFileSync(`examples/${file}`, 'utf8'), file).not.toMatch(
        /leereilly\/star-chart(?:-docs|-examples)?/,
      );
    }
  });
});
