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
    expect(trackedText).toContain('uses: leereilly/star-chart@v1');
  });

  it('documents v1 without pre-release or local-workaround caveats', () => {
    for (const [name, content] of [
      ['README.md', readme],
      ['docs/index.html', docs],
    ] as const) {
      expect(content, name).not.toMatch(
        /(?:v1.{0,80}(?:not (?:yet )?published|unpublished|unavailable)|use \.\/ locally|release status note|pin a reviewed commit SHA)/is,
      );
    }
  });
});

describe('example generator fixtures', () => {
  it('uses Rails repositories for default and edge-case source metadata', () => {
    expect(generator).toContain("repository: 'rails/rails'");
    expect(generator).toContain("owner: 'rails'");
    expect(generator).toContain("repo: 'rails'");
    expect(generator).toContain("fullName: 'rails/rails'");
    expect(generator).not.toContain("repository: 'leereilly/star-chart'");
    expect(generator).not.toContain('fullName: `sample/${name}`');
  });

  it('aggregates rails, propshaft, and sprockets-rails in stable order', () => {
    const rails = generator.indexOf("fullName: 'rails/rails'");
    const propshaft = generator.indexOf("fullName: 'rails/propshaft'");
    const sprockets = generator.indexOf("fullName: 'rails/sprockets-rails'");

    expect(rails).toBeGreaterThan(-1);
    expect(propshaft).toBeGreaterThan(rails);
    expect(sprockets).toBeGreaterThan(propshaft);
  });

  it('brands generated sources without leaking the former fixture', () => {
    for (const name of [
      'contributions-light.svg',
      'zero-stars-light.svg',
      'one-star-light.svg',
    ]) {
      expect(readFileSync(`examples/${name}`, 'utf8')).toContain(
        '<title id="sc-contributions-title">rails/rails</title>',
      );
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
