import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
});
