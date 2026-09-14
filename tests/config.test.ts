import { describe, it, expect } from 'vitest';
import { parseInputs, PERIOD_WEEKS } from '../src/config/inputs.js';
import { ConfigError, parseRepositories } from '../src/config/validate.js';
import { configDualTheme, configRepositories } from '../src/config/defaults.js';

function parse(raw: Record<string, string | undefined>, env = {}) {
  return parseInputs({ repository: 'octocat/hello-world', ...raw }, { env });
}

describe('parseInputs defaults', () => {
  it('applies documented defaults', () => {
    const { config } = parse({});
    expect(config.style).toBe('contributions');
    expect(config.theme).toBe('light');
    expect(config.weeks).toBe(52);
    expect(config.period).toBe('1y');
    expect(config.columns).toBe(52);
    expect(config.rows).toBe(26);
    expect(config.width).toBe(900);
    expect(config.height).toBeNull();
    expect(config.output).toBe('assets/star-chart.svg');
    expect(config.scale).toBe('absolute');
    expect(config.logo).toBe(true);
    expect(config.animation.mode).toBe('none');
    expect(config.animation.durationSeconds).toBe(4);
    expect(config.animation.style).toBe('grow');
    expect(config.animation.direction).toBe('chronological');
    expect(config.fontFamily).toContain('-apple-system');
    expect(config.axisFontSize).toBe(10);
  });
});

describe('period / weeks precedence', () => {
  it('maps periods to week counts', () => {
    expect(parse({ period: '3m' }).config.weeks).toBe(PERIOD_WEEKS['3m']);
    expect(parse({ period: '6m' }).config.weeks).toBe(26);
    expect(parse({ period: '2y' }).config.weeks).toBe(104);
    expect(parse({ period: '5y' }).config.weeks).toBe(260);
  });

  it('period wins over weeks with a warning', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      { repository: 'a/b', period: '6m', weeks: '10' },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.weeks).toBe(26);
    expect(config.period).toBe('6m');
    expect(warnings.join(' ')).toMatch(/precedence/);
  });

  it('uses explicit weeks when period is absent', () => {
    const { config } = parse({ weeks: '30' });
    expect(config.weeks).toBe(30);
    expect(config.period).toBeNull();
  });

  it('treats "all" as a large window', () => {
    const { config } = parse({ period: 'all' });
    expect(config.period).toBe('all');
    expect(config.weeks).toBeGreaterThanOrEqual(260);
  });
});

describe('scale input', () => {
  it.each(['absolute', 'visible'])('accepts scale: %s', (scale) => {
    expect(parse({ scale }).config.scale).toBe(scale);
  });

  it('keeps the zero-based default for a blank input', () => {
    expect(parse({ scale: '' }).config.scale).toBe('absolute');
  });

  it('rejects unsupported scales', () => {
    expect(() => parse({ scale: 'relative' })).toThrow(ConfigError);
  });
});

describe('validation', () => {
  it('rejects invalid enums', () => {
    expect(() => parse({ style: 'pie' })).toThrow(ConfigError);
    expect(() => parse({ theme: 'neon' })).toThrow(ConfigError);
  });

  it('rejects out-of-range integers', () => {
    expect(() => parse({ columns: '0' })).toThrow(ConfigError);
    expect(() => parse({ columns: '9999' })).toThrow(ConfigError);
    expect(() => parse({ rows: '-3' })).toThrow(ConfigError);
    expect(() => parse({ width: '10' })).toThrow(ConfigError);
    expect(() => parse({ axis_font_size: '5' })).toThrow(ConfigError);
    expect(() => parse({ axis_font_size: '49' })).toThrow(ConfigError);
    expect(() => parse({ axis_font_size: '12.5' })).toThrow(ConfigError);
  });

  it('accepts an enlarged axis legend within range', () => {
    expect(parse({ axis_font_size: '6' }).config.axisFontSize).toBe(6);
    expect(parse({ axis_font_size: '20' }).config.axisFontSize).toBe(20);
    expect(parse({ axis_font_size: '48' }).config.axisFontSize).toBe(48);
    expect(parse({ axis_font_size: '' }).config.axisFontSize).toBe(10);
  });

  it('allows the maximum columns × rows product', () => {
    // Individual caps (260 × 200) tie the 52,000 product ceiling exactly.
    expect(parse({ columns: '260', rows: '200' }).config.columns).toBe(260);
  });

  it('accepts an explicit row count above the default', () => {
    expect(parse({ rows: '100' }).config.rows).toBe(100);
  });

  it('rejects non-integer and non-boolean inputs', () => {
    expect(() => parse({ columns: '5.5' })).toThrow(ConfigError);
    expect(() => parse({ show_title: 'yes' })).toThrow(ConfigError);
  });

  it('accepts and normalizes hex colours only', () => {
    const { config } = parse({ level_1_color: '#ABCDEF' });
    expect(config.paletteOverrides.level1).toBe('#abcdef');
    expect(() => parse({ level_1_color: 'red' })).toThrow(ConfigError);
    expect(() => parse({ level_1_color: 'rgb(1,2,3)' })).toThrow(ConfigError);
    expect(() => parse({ level_1_color: 'url(#x)' })).toThrow(ConfigError);
  });

  it('background allows transparent and hex, rejects css', () => {
    expect(parse({ background: 'transparent' }).config.background).toBe(
      'transparent',
    );
    expect(parse({ background: '#fff' }).config.background).toBe('#fff');
    expect(() => parse({ background: 'var(--x)' })).toThrow(ConfigError);
  });

  it('infers background from the value when background_mode is blank', () => {
    // Legacy compatibility: no mode preserves magic-value inference.
    expect(parse({ background: '' }).config.background).toBe('transparent');
    expect(parse({ background: 'none' }).config.background).toBe('transparent');
    expect(parse({ background: '#101010' }).config.background).toBe('#101010');
    expect(
      parse({ background_mode: '', background: '#101010' }).config.background,
    ).toBe('#101010');
  });

  it('resolves an explicit solid background from a hex value', () => {
    expect(
      parse({ background_mode: 'solid', background: '#123ABC' }).config
        .background,
    ).toBe('#123abc');
    // Case-insensitive mode.
    expect(
      parse({ background_mode: 'SOLID', background: '#fff' }).config.background,
    ).toBe('#fff');
  });

  it('rejects an explicit solid background without a valid hex value', () => {
    expect(() => parse({ background_mode: 'solid' })).toThrow(ConfigError);
    expect(() => parse({ background_mode: 'solid', background: '' })).toThrow(
      ConfigError,
    );
    expect(() =>
      parse({ background_mode: 'solid', background: 'transparent' }),
    ).toThrow(ConfigError);
    expect(() =>
      parse({ background_mode: 'solid', background: 'none' }),
    ).toThrow(ConfigError);
    expect(() =>
      parse({ background_mode: 'solid', background: 'red' }),
    ).toThrow(ConfigError);
  });

  it('forces transparent and warns when a colour is supplied', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      {
        repository: 'a/b',
        background_mode: 'transparent',
        background: '#123456',
      },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.background).toBe('transparent');
    expect(warnings.join(' ')).toMatch(/ignore/i);
  });

  it('forces transparent without warning for transparent/none values', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      {
        repository: 'a/b',
        background_mode: 'TRANSPARENT',
        background: 'none',
      },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.background).toBe('transparent');
    expect(warnings).toHaveLength(0);
  });

  it('rejects an unknown background_mode', () => {
    expect(() =>
      parse({ background_mode: 'gradient', background: '#fff' }),
    ).toThrow(ConfigError);
  });

  it('validates font-family lists and rejects css injection', () => {
    const { config } = parse({ font_family: 'Inter, "Segoe UI", sans-serif' });
    expect(config.fontFamily).toBe('Inter, "Segoe UI", sans-serif');
    expect(() => parse({ font_family: 'Inter; }body{color:red' })).toThrow(
      ConfigError,
    );
    expect(() => parse({ font_family: 'url(evil)' })).toThrow(ConfigError);
  });

  it('validates repository and rejects urls / extra slashes', () => {
    expect(() => parseInputs({ repository: 'https://x/y' })).toThrow(
      ConfigError,
    );
    expect(() => parseInputs({ repository: 'a/b/c' })).toThrow(ConfigError);
    expect(() => parseInputs({ repository: 'noslash' })).toThrow(ConfigError);
    expect(() => parseInputs({ repository: '' })).toThrow(ConfigError);
  });

  it('rejects unsafe output paths', () => {
    expect(() => parse({ output: '/etc/passwd.svg' })).toThrow();
    expect(() => parse({ output: '../escape.svg' })).toThrow();
    expect(() => parse({ output: 'a\\b.svg' })).toThrow();
    expect(() => parse({ output: 'chart.png' })).toThrow();
    expect(() => parse({ output: '.git/x.svg' })).toThrow();
  });

  it('parses animation durations with units', () => {
    expect(
      parse({ animation_duration: '2s' }).config.animation.durationSeconds,
    ).toBe(2);
    expect(
      parse({ animation_duration: '500ms' }).config.animation.durationSeconds,
    ).toBe(0.5);
    expect(() => parse({ animation_duration: '999s' })).toThrow(ConfigError);
    expect(() => parse({ animation_easing: 'bounce' })).toThrow(ConfigError);
  });

  it('enforces cell_radius <= half cell_size', () => {
    expect(() => parse({ cell_size: '10', cell_radius: '9' })).toThrow(
      ConfigError,
    );
    expect(parse({ cell_size: '10', cell_radius: '5' }).config.cellRadius).toBe(
      5,
    );
  });

  it('rejects control characters in title', () => {
    expect(() => parse({ title: 'bad\u0007title' })).toThrow(ConfigError);
    expect(parse({ title: 'My Chart' }).config.title).toBe('My Chart');
  });
});

describe('token resolution', () => {
  it('prefers input token then env', () => {
    expect(parse({ token: 'abc' }).token).toBe('abc');
    expect(parse({}, { GITHUB_TOKEN: 'envtok' }).token).toBe('envtok');
    expect(parse({}).token).toBe('');
  });

  it('falls back to GITHUB_REPOSITORY', () => {
    const { config } = parseInputs({}, { env: { GITHUB_REPOSITORY: 'a/b' } });
    expect(config.repository).toEqual({ owner: 'a', repo: 'b' });
  });
});

describe('repositories aggregation input', () => {
  it('defaults to the single repository', () => {
    const { config } = parse({});
    expect(config.repositories).toEqual([
      { owner: 'octocat', repo: 'hello-world' },
    ]);
    expect(config.repository).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
    });
  });

  it('parses comma- and newline-separated lists', () => {
    expect(parseRepositories('a/b, c/d')).toEqual([
      { owner: 'a', repo: 'b' },
      { owner: 'c', repo: 'd' },
    ]);
    expect(parseRepositories('a/b\nc/d\n')).toEqual([
      { owner: 'a', repo: 'b' },
      { owner: 'c', repo: 'd' },
    ]);
    expect(parseRepositories(' a/b ,\n\n c/d , ')).toEqual([
      { owner: 'a', repo: 'b' },
      { owner: 'c', repo: 'd' },
    ]);
  });

  it('treats blank input as no list', () => {
    expect(parseRepositories(undefined)).toEqual([]);
    expect(parseRepositories('')).toEqual([]);
    expect(parseRepositories('  \n , \n ')).toEqual([]);
  });

  it('rejects invalid entries with the repository rules', () => {
    expect(() => parseRepositories('a/b, not-a-repo')).toThrow(ConfigError);
    expect(() => parseRepositories('https://github.com/a/b')).toThrow(
      ConfigError,
    );
    expect(() => parseRepositories('a/b/c')).toThrow(ConfigError);
    expect(() => parseRepositories('a/..')).toThrow(ConfigError);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    const warnings: string[] = [];
    const parsed = parseRepositories('Octo/Cat, octo/cat, other/repo', {
      warn: (m) => warnings.push(m),
    });
    expect(parsed).toEqual([
      { owner: 'Octo', repo: 'Cat' },
      { owner: 'other', repo: 'repo' },
    ]);
    expect(warnings.join(' ')).toMatch(/duplicate/i);
  });

  it('caps the list length', () => {
    const many = Array.from({ length: 20 }, (_, i) => `o/r${i}`).join(',');
    expect(parseRepositories(many)).toHaveLength(20);
    expect(() => parseRepositories(`${many},o/r20`)).toThrow(ConfigError);
  });

  it('takes precedence over repository and warns when meaningfully set', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      { repository: 'explicit/one', repositories: 'a/b, c/d' },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.repositories).toEqual([
      { owner: 'a', repo: 'b' },
      { owner: 'c', repo: 'd' },
    ]);
    expect(config.repository).toEqual({ owner: 'a', repo: 'b' });
    expect(warnings.join(' ')).toMatch(/precedence/);
  });

  it('does not warn when repository is just the workflow default', () => {
    const warnings: string[] = [];
    parseInputs(
      { repository: 'octo/cat', repositories: 'a/b, c/d' },
      { env: { GITHUB_REPOSITORY: 'octo/cat' }, warn: (m) => warnings.push(m) },
    );
    expect(warnings).toHaveLength(0);
  });

  it('does not warn when repository is already listed', () => {
    const warnings: string[] = [];
    parseInputs(
      { repository: 'A/B', repositories: 'a/b, c/d' },
      { warn: (m) => warnings.push(m) },
    );
    expect(warnings).toHaveLength(0);
  });

  it('exposes the aggregated list through configRepositories', () => {
    const { config } = parse({ repositories: 'a/b, c/d' });
    expect(configRepositories(config)).toHaveLength(2);
    expect(
      configRepositories({ repository: { owner: 'x', repo: 'y' } }),
    ).toEqual([{ owner: 'x', repo: 'y' }]);
    expect(
      configRepositories({
        repository: { owner: 'x', repo: 'y' },
        repositories: [],
      }),
    ).toEqual([{ owner: 'x', repo: 'y' }]);
  });
});

describe('dual_theme input', () => {
  it('defaults to false and preserves the theme', () => {
    const { config } = parse({ theme: 'dark' });
    expect(config.dualTheme).toBe(false);
    expect(configDualTheme(config)).toBe(false);
    expect(config.theme).toBe('dark');
  });

  it('enables dual mode and warns that theme is ignored', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      { repository: 'a/b', dual_theme: 'true', theme: 'dark' },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.dualTheme).toBe(true);
    expect(configDualTheme(config)).toBe(true);
    expect(warnings.join(' ')).toMatch(/ignored/i);
  });

  it('does not warn for the light default the Action always supplies', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      { repository: 'a/b', dual_theme: 'true', theme: 'light' },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.dualTheme).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('does not warn when no theme was supplied', () => {
    const warnings: string[] = [];
    const { config } = parseInputs(
      { repository: 'a/b', dual_theme: 'TRUE' },
      { warn: (m) => warnings.push(m) },
    );
    expect(config.dualTheme).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('rejects non-boolean values', () => {
    expect(() => parse({ dual_theme: 'yes' })).toThrow(ConfigError);
  });
});
