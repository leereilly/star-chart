import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { parse as parseYaml } from 'yaml';
import { checkSvg, withoutLegend } from './helpers/index.js';
import { parseInputs } from '../src/config/inputs.js';

type Page = ReturnType<DOMParser['parseFromString']>;
interface Example {
  repository: string;
  branch: string;
  style: string;
  workflow: string;
  embed: string;
  repoUrl: string;
  workflowUrl: string;
  readmeUrl: string;
}
interface Website {
  normalizeRepository(value: string): string;
  normalizeBranch(value: string): string;
  buildExample(
    repository: string,
    branch: string,
    options?: string | Record<string, string | boolean>,
  ): Example;
  updateExamples(document: Page, example: Example, theme: string): void;
  updateTheme(document: Page, theme: string): void;
  mount(document: Page): void;
  copySnippet(
    document: Page,
    name: string,
    clipboard?: { writeText(text: string): Promise<void> },
  ): Promise<void>;
}
const moduleUrl = pathToFileURL(resolve('docs/site.mjs')).href;
const site: Website = await import(moduleUrl);
const html = readFileSync('docs/index.html', 'utf8');
const page = (): Page => new DOMParser().parseFromString(html, 'text/html');
const actionInputs = parseYaml(readFileSync('action.yml', 'utf8'))
  .inputs as Record<string, { default: string }>;
const workflowInputs = (options: Record<string, string | boolean> = {}) =>
  parseYaml(site.buildExample('acme/widgets', 'main', options).workflow).jobs
    .chart.steps[1].with as Record<string, string | boolean | number>;
const parseGenerated = (options: Record<string, string | boolean> = {}) =>
  parseInputs(
    Object.fromEntries(
      Object.entries(workflowInputs(options)).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  ).config;
function mountedPage() {
  const document = page();
  const listeners = new Map<string, () => void>();
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    Object.assign(element, {
      value: element.getAttribute('value') || '',
      addEventListener: (type: string, listener: () => void) =>
        listeners.set(`${element.getAttribute('id')}:${type}`, listener),
    });
  }
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  site.mount(document);
  const control = (id: string) =>
    document.getElementById(id)! as NonNullable<
      ReturnType<Page['getElementById']>
    > & { value: string; checked: boolean; disabled: boolean; hidden: boolean };
  const update = (name: string, value: string | boolean) => {
    Object.assign(
      control(name),
      typeof value === 'boolean' ? { checked: value } : { value },
    );
    listeners.get('repository-form:input')!();
  };
  return { document, control, update };
}

describe('documentation website', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round trips independent axes and style-aware legend defaults', () => {
    for (const style of ['contributions', 'sparkline', 'clustered-bar']) {
      expect(parseGenerated({ style })).toMatchObject({
        showXAxis: true,
        showYAxis: style !== 'sparkline',
        showLegend: style !== 'sparkline',
      });
      expect(
        parseGenerated({
          style,
          show_x_axis: false,
          show_y_axis: true,
          show_legend: false,
        }),
      ).toMatchObject({
        showXAxis: false,
        showYAxis: true,
        showLegend: false,
      });
    }
    const { control, update } = mountedPage();
    update('chart-style', 'sparkline');
    expect(control('config-show_y_axis').value).toBe('');
    expect(control('config-show_legend').value).toBe('');
    update('config-show_y_axis', 'true');
    update('config-show_legend', 'false');
    const inputs = parseYaml(control('workflow-code').textContent!).jobs.chart
      .steps[1].with;
    expect(
      parseInputs(
        Object.fromEntries(
          Object.entries(inputs).map(([k, v]) => [k, String(v)]),
        ),
      ).config,
    ).toMatchObject({
      showYAxis: true,
      showLegend: false,
    });
    for (const flag of ['show_x_axis', 'show_y_axis', 'show_legend']) {
      expect(() => workflowInputs({ [flag]: 'sometimes' })).toThrow();
    }
  });

  it('exposes every action input with labeled controls and a fixed token', () => {
    const { document, control } = mountedPage();
    const elements = Array.from(document.getElementsByTagName('*')).filter(
      (element) => element.hasAttribute('data-action-input'),
    );
    expect(
      elements
        .map((element) => element.getAttribute('data-action-input'))
        .sort(),
    ).toEqual(Object.keys(actionInputs).sort());
    expect(elements).toHaveLength(Object.keys(actionInputs).length);
    const labels = Array.from(document.getElementsByTagName('label'));
    for (const element of elements) {
      const name = element.getAttribute('data-action-input')!;
      if (name === 'token') {
        expect(element.tagName).toBe('code');
        expect(element.textContent).toBe('${{ github.token }}');
        continue;
      }
      expect(
        labels.some(
          (label) => label.getAttribute('for') === element.getAttribute('id'),
        ),
        name,
      ).toBe(true);
      expect(element.getAttribute('aria-describedby')).toContain('input-error');
      const overrides: Record<string, string> = {
        repository: '',
        period: 'all',
        animation: 'once',
        dual_theme: 'true',
      };
      const input = control(element.getAttribute('id')!);
      expect(
        String(
          element.getAttribute('type') === 'checkbox'
            ? input.checked
            : input.value,
        ),
        name,
      ).toBe(overrides[name] ?? actionInputs[name]!.default);
    }
    expect(control('config-theme').disabled).toBe(true);
    expect(control('config-weeks').disabled).toBe(true);
    expect(control('chart-preview').getAttribute('src')).toBe(
      'samples/contributions-animated-once-light.svg',
    );
    expect(control('chart-preview').getAttribute('height')).toBe('504');
    expect(control('preview-caption').textContent).toContain(
      'does not render your settings or full history',
    );
    for (const details of Array.from(
      control('chart-options').getElementsByTagName('details'),
    )) {
      expect(details.hasAttribute('open')).toBe(false);
    }
  });

  it('offers all 14 styles, producing valid YAML and existing previews', () => {
    const { document, update, control } = mountedPage();
    const styles = Array.from(
      control('chart-style').getElementsByTagName('option'),
    ).map((option) => option.getAttribute('value')!);
    expect(styles).toHaveLength(14);
    for (const style of styles) {
      update('chart-style', style);
      const example = site.buildExample('acme/widgets', 'main', { style });
      expect(parseGenerated({ style }).style).toBe(style);
      expect(control('generated-examples').hidden).toBe(false);
      for (const theme of ['light', 'dark']) {
        site.updateExamples(document, example, theme);
        const src = control('chart-preview').getAttribute('src');
        expect(checkSvg(readFileSync(`docs/${src}`, 'utf8')).errors).toEqual(
          [],
        );
      }
    }
  });

  it('gates invalid advanced settings accessibly and restores synchronized actions', () => {
    const { control, update } = mountedPage();
    update('config-period', 'custom');
    expect(control('config-weeks').disabled).toBe(false);
    expect(control('config-weeks').getAttribute('aria-invalid')).toBe('true');
    expect(control('generated-examples').hidden).toBe(true);
    expect(control('input-error').hidden).toBe(false);
    expect(control('readme-cta').getAttribute('aria-disabled')).toBe('true');
    for (const name of ['workflow', 'readme']) {
      expect(control(`copy-${name}`).disabled).toBe(true);
      expect(control(`${name}-link`).hasAttribute('href')).toBe(false);
      expect(control(`${name}-code`).textContent).toBe('');
    }
    update('config-weeks', '3000');
    expect(control('config-weeks').hasAttribute('aria-invalid')).toBe(false);
    expect(control('generated-examples').hidden).toBe(false);
    expect(control('input-error').hidden).toBe(true);
    update('config-dual_theme', false);
    expect(control('config-theme').disabled).toBe(false);
    update('config-theme', 'dark');
    update('config-output', 'custom/chart.svg');
    const workflow = parseYaml(control('workflow-code').textContent!);
    expect(workflow.jobs.chart.steps[1].with).toMatchObject({
      weeks: '3000',
      theme: 'dark',
      dual_theme: false,
      output: 'custom/chart.svg',
    });
    expect(workflow.jobs.chart.steps[1].with).not.toHaveProperty('period');
    expect(control('readme-code').textContent).not.toContain('<picture>');
    expect(control('readme-code').textContent).toContain('/custom/chart.svg');
    expect(control('chart-preview').getAttribute('src')).toContain('-dark.svg');
    expect(
      new URL(control('workflow-link').getAttribute('href')!).searchParams.get(
        'value',
      ),
    ).toBe(control('workflow-code').textContent);
    expect(control('copy-workflow').disabled).toBe(false);
    expect(control('readme-cta').hasAttribute('aria-disabled')).toBe(false);
    update('config-background_mode', 'solid');
    expect(control('config-background').getAttribute('aria-invalid')).toBe(
      'true',
    );
    update('config-background', '#abcdef');
    expect(control('generated-examples').hidden).toBe(false);
    update('config-background_mode', 'transparent');
    expect(control('config-background').disabled).toBe(true);
    update('config-repositories', 'one/repo, ONE/repo, two/repo');
    expect(control('preview-caption').textContent).toContain(
      'one/repo, two/repo',
    );
    expect(control('repo-link').textContent).toBe('octocat/hello-world');
  });

  it('defaults to animated contributions from day zero without changing action defaults', () => {
    const inputs = workflowInputs();
    expect(inputs).toMatchObject({
      token: '${{ github.token }}',
      repository: 'acme/widgets',
      style: 'contributions',
      period: 'all',
      animation: 'once',
      dual_theme: true,
    });
    const overrides: Record<string, string> = {
      repository: 'acme/widgets',
      period: 'all',
      animation: 'once',
      dual_theme: 'true',
    };
    for (const [key, input] of Object.entries(actionInputs)) {
      if (key === 'weeks') continue;
      expect(String(inputs[key]), key).toBe(overrides[key] ?? input.default);
    }
    expect(parseGenerated()).toMatchObject({
      style: 'contributions',
      period: 'all',
      weeks: 3000,
      dualTheme: true,
      animation: { mode: 'once' },
    });
  });

  it('round trips advanced settings through YAML and the action parser', () => {
    const options = {
      repository: 'other/source',
      repositories: 'one/project, ONE/project\ntwo/project',
      output: 'charts/My stars.SVG',
      theme: 'auto',
      dual_theme: false,
      period: 'custom',
      weeks: '123',
      columns: '260',
      rows: '200',
      width: '2400',
      height: '4800',
      show_title: false,
      show_total: false,
      show_change: false,
      show_dates: false,
      title: 'Stars: "quoted" & <safe> \'title\'\nnext line',
      date_format: 'iso',
      axis_font_size: '48',
      cell_size: '32',
      cell_gap: '0',
      cell_radius: '16',
      background_mode: 'solid',
      background: '#abcd',
      empty_color: '#123',
      level_1_color: '#1234',
      level_2_color: '#123456',
      level_3_color: '#12345678',
      level_4_color: '#abcdef',
      font_family: '"My Font", monospace',
      scale: 'visible',
      logo: false,
      animation: 'loop',
      animation_duration: '200ms',
      animation_pause: '0',
      animation_delay: '60s',
      animation_style: 'cascade',
      animation_direction: 'simultaneous',
      animation_easing: 'ease-in-out',
      animate_total: true,
    };
    const inputs = workflowInputs(options);
    expect(inputs).not.toHaveProperty('period');
    expect(inputs.repositories).toBe('one/project, two/project');
    const config = parseGenerated(options);
    expect(config).toEqual(
      parseInputs({
        ...Object.fromEntries(
          Object.entries(options).map(([key, value]) => [key, String(value)]),
        ),
        period: '',
      }).config,
    );
    expect(config).toMatchObject({
      repositories: [
        { owner: 'one', repo: 'project' },
        { owner: 'two', repo: 'project' },
      ],
      weeks: 123,
      period: null,
      cellGap: 0,
      showTotal: false,
      background: '#abcd',
      animation: { durationSeconds: 0.2, pauseSeconds: 0, delaySeconds: 60 },
    });
    const example = site.buildExample('acme/widgets', 'main', options);
    expect(example.workflowUrl).toContain('github.com/acme/widgets/new/');
    expect(example.embed).not.toContain('<picture>');
    expect(example.embed).toContain('/charts/My%20stars.SVG');
    expect(example.embed).toContain('one/project');
    expect(example.embed).not.toContain('other/source');
  });

  it.each([
    ['theme', ['light', 'dark', 'auto']],
    ['period', ['3m', '6m', '1y', '2y', '5y', 'all']],
    ['scale', ['absolute', 'visible']],
    ['date_format', ['short', 'long', 'iso']],
    ['animation', ['none', 'once', 'loop']],
    ['animation_style', ['grow', 'reveal', 'cascade']],
    ['animation_direction', ['chronological', 'simultaneous']],
    ['animation_easing', ['linear', 'ease-in', 'ease-out', 'ease-in-out']],
  ] as const)('accepts every %s option', (key, values) => {
    for (const value of values) {
      expect(() =>
        parseGenerated({ [key]: value, dual_theme: false }),
      ).not.toThrow();
    }
    expect(() => workflowInputs({ [key]: 'invalid' })).toThrow();
  });

  it.each([
    { columns: '0' },
    { columns: '261' },
    { rows: '201' },
    { rows: '0' },
    { width: '239' },
    { width: '2401' },
    { height: '119' },
    { height: '4801' },
    { cell_size: '0' },
    { cell_size: '33' },
    { cell_gap: '-1' },
    { cell_gap: '13' },
    { cell_radius: '17' },
    { cell_radius: '-1' },
    { cell_size: '5', cell_radius: '3' },
    { axis_font_size: '5' },
    { axis_font_size: '49' },
    { columns: '1.5' },
    { period: 'custom', weeks: '0' },
    { period: 'custom', weeks: '3001' },
    { period: 'custom', weeks: '' },
    { animation_duration: '199ms' },
    { animation_duration: '61' },
    { animation_pause: '-1' },
    { animation_delay: '60001ms' },
    { show_title: 'yes' },
    { title: 'a'.repeat(201) },
    { font_family: 'url(evil)' },
    { font_family: 'a'.repeat(201) },
    { font_family: 'Arial,,sans-serif' },
    { font_family: 'Arial,\nmonospace' },
    { font_family: 'Arial,\tmonospace' },
    { empty_color: 'red' },
    { background_mode: 'solid', background: 'transparent' },
    { background_mode: 'solid', background: '' },
    { background: '#12345' },
    { output: '/absolute.svg' },
    { output: '../escape.svg' },
    { output: 'a/.git/chart.svg' },
    { output: 'a\\chart.svg' },
    { output: 'C:/chart.svg' },
    { output: 'chart.png' },
    { output: '.svg' },
    { output: `a/${'x'.repeat(389)}.svg` },
    { title: '${{ secrets.TOKEN }}' },
    { output: '${{ github.token }}.svg' },
    {
      repositories: Array.from({ length: 21 }, (_, i) => `owner/repo${i}`).join(
        ',',
      ),
    },
  ])('rejects invalid settings %j', (options) => {
    expect(() => workflowInputs(options)).toThrow();
  });

  it('handles inferred and transparent backgrounds and safe output serialization', () => {
    expect(parseGenerated({ background: '#123' }).background).toBe('#123');
    expect(parseGenerated({ background: 'none' }).background).toBe(
      'transparent',
    );
    expect(
      parseGenerated({
        background_mode: 'transparent',
        background: 'ignored',
      }).background,
    ).toBe('transparent');
    const example = site.buildExample('acme/widgets', 'main', {
      output: "./charts/a'b & [*].SVG",
      title: 'Something "quoted"',
    });

    const workflow = parseYaml(example.workflow);
    expect(workflow.jobs.chart.steps[1].with.output).toBe(
      "charts/a'b & [*].SVG",
    );
    expect(workflow.jobs.chart.steps[2].run).toContain(
      "git --literal-pathspecs add -- 'charts/a'\"'\"'b & [*]-light.SVG'",
    );
    expect(example.embed).toContain('charts/a%27b%20%26%20%5B*%5D-light.SVG');
    expect(new URL(example.workflowUrl).searchParams.get('value')).toBe(
      example.workflow,
    );
    const unicodeTitle = 'Stars\u0085across\u2028lines\u2029too';
    expect(workflowInputs({ title: unicodeTitle }).title).toBe(unicodeTitle);
    expect(
      parseGenerated({
        repository: 'ignored invalid source',
        repositories: 'one/repo, two/repo',
      }).repositories,
    ).toHaveLength(2);
  });

  it('accepts numeric boundaries, auto sizing and explicit false for every boolean', () => {
    for (const options of [
      {
        columns: '1',
        rows: '1',
        width: '240',
        height: '120',
        cell_size: '1',
        cell_gap: '0',
        cell_radius: '0',
        axis_font_size: '6',
        period: 'custom',
        weeks: '1',
      },
      {
        columns: '260',
        rows: '200',
        width: '2400',
        height: '4800',
        cell_size: '32',
        cell_gap: '12',
        cell_radius: '16',
        axis_font_size: '48',
        period: 'custom',
        weeks: '3000',
      },
      {
        height: 'auto',
        cell_size: 'auto',
        cell_gap: 'auto',
        cell_radius: 'auto',
        animation_duration: '60',
        animation_pause: '60s',
        animation_delay: '0ms',
      },
    ])
      expect(() => parseGenerated(options)).not.toThrow();
    for (const name of [
      'show_title',
      'show_total',
      'show_change',
      'show_dates',
      'logo',
      'dual_theme',
      'animate_total',
    ]) {
      expect(workflowInputs({ [name]: false })[name]).toBe(false);
      expect(workflowInputs({ [name]: true })[name]).toBe(true);
    }
    expect(workflowInputs({ token: 'never-used' }).token).toBe(
      '${{ github.token }}',
    );
  });

  it('shows an animated hero before configuration and an ungated full gallery', () => {
    const document = page();
    const hero = document.getElementById('hero-preview');
    const gallery = document.getElementById('example-gallery');
    expect(hero).not.toBeNull();
    expect(gallery).not.toBeNull();
    expect(html.indexOf('id="hero-preview"')).toBeLessThan(
      html.indexOf('id="configure-title"'),
    );
    expect(hero?.getAttribute('src')).toBe(
      'samples/contributions-animated-once-light.svg',
    );
    expect(hero?.getAttribute('loading')).not.toBe('lazy');
    for (const element of [hero, gallery]) {
      for (let node = element; node; node = node.parentNode as typeof node) {
        expect(node.hasAttribute?.('hidden')).not.toBe(true);
        expect(node.getAttribute?.('id')).not.toBe('generated-examples');
      }
    }
    const images = Array.from(gallery!.getElementsByTagName('img'));
    const paths = new Set<string>();
    for (const image of images) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('alt')).toMatch(/synthetic/i);
      expect(image.parentNode?.parentNode?.textContent?.trim()).not.toBe('');
      for (const attribute of ['src', 'data-light-src', 'data-dark-src']) {
        const path = image.getAttribute(attribute);
        if (path) paths.add(path);
      }
    }
    const catalog = readdirSync('examples').filter((file) =>
      file.endsWith('.svg'),
    );
    expect([...paths].sort()).toEqual(
      catalog.map((file) => `samples/${file}`).sort(),
    );
    for (const path of paths) {
      expect(path).toMatch(/^samples\/[\w-]+\.svg$/);
      const svg = readFileSync(`docs/${path}`, 'utf8');
      expect(checkSvg(svg).errors, path).toEqual([]);
      expect(svg).toContain('Synthetic demonstration');
      expect(svg).not.toContain('leereilly/star-chart');
    }
  });

  it('switches paired examples without changing fixed or automatic themes', () => {
    const document = page();
    const images = Array.from(document.getElementsByTagName('img'));
    const original = images.map((image) => image.getAttribute('src'));
    for (const theme of ['dark', 'light']) {
      site.updateTheme(document, theme);
      for (const [index, image] of images.entries()) {
        expect(image.getAttribute('src')).toBe(
          image.getAttribute(`data-${theme}-src`) || original[index],
        );
      }
      expect(document.documentElement?.getAttribute('data-color-mode')).toBe(
        theme,
      );
    }
    expect(document.getElementById('example-gallery')?.textContent).toContain(
      'Fixed dark',
    );
    expect(document.getElementById('example-gallery')?.textContent).toContain(
      'Fixed light',
    );
    expect(document.getElementById('example-gallery')?.textContent).toContain(
      'system preference',
    );
  });

  it('keeps hero and gallery visible and themeable during invalid input', () => {
    const document = page();
    const listeners = new Map<string, () => void>();
    for (const element of Array.from(document.getElementsByTagName('*'))) {
      Object.assign(element, {
        value:
          element.getAttribute('value') ||
          (element.getAttribute('id') === 'chart-style' ? 'contributions' : ''),
        addEventListener: (type: string, listener: () => void) =>
          listeners.set(`${element.getAttribute('id')}:${type}`, listener),
      });
    }
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('localStorage', {
      getItem: () => 'dark',
      setItem: vi.fn(),
    });
    const repository = document.getElementById('repository')!;
    Object.assign(repository, { value: '' });
    site.mount(document);
    expect(document.getElementById('hero-preview')?.getAttribute('src')).toBe(
      'samples/contributions-animated-once-dark.svg',
    );
    for (const input of ['', 'not a repository', 'acme/widgets']) {
      Object.assign(repository, { value: input });
      listeners.get('repository-form:input')!();
      listeners.get('theme-toggle:click')!();
      const theme = document.documentElement?.getAttribute('data-color-mode');
      expect(document.getElementById('hero-preview')?.getAttribute('src')).toBe(
        `samples/contributions-animated-once-${theme}.svg`,
      );
      for (const id of ['hero-preview', 'example-gallery']) {
        expect(
          (document.getElementById(id) as unknown as { hidden: boolean })
            .hidden,
        ).not.toBe(true);
      }
      expect(
        (
          document.getElementById('generated-examples') as unknown as {
            hidden: boolean;
          }
        ).hidden,
      ).toBe(input !== 'acme/widgets');
    }
  });

  it('states the access and workflow permissions assumption beside setup', () => {
    const text = page()
      .getElementById('workflow-link')
      ?.parentNode?.parentNode?.textContent?.replace(/\s+/g, ' ');
    expect(text).toContain(
      'Assumes you have access to this repository and permission to add workflows and commit changes.',
    );
  });

  it.each([
    'octocat/Hello-World',
    ' octocat/Hello-World/ ',
    'octocat/Hello-World.git',
    'github.com/octocat/Hello-World',
    'www.github.com/octocat/Hello-World/',
    'https://github.com/octocat/Hello-World.git/',
    'http://www.github.com/octocat/Hello-World',
    'HTTPS://GITHUB.COM/octocat/Hello-World',
  ])('normalizes %s without fetching a repository', (input) => {
    expect(site.normalizeRepository(input)).toBe('octocat/Hello-World');
  });

  it.each([
    '',
    'octocat',
    'https://example.com/octocat/repo',
    'https://github.com.evil.test/octocat/repo',
    'https://evil.test@github.com/octocat/repo',
    'https://github.com/octocat/repo?token=secret',
    'https://github.com/octocat/repo#readme',
    'ftp://github.com/octocat/repo',
    '//github.com/octocat/repo',
    'octocat/repo/issues',
    'github.com/octocat/repo/tree/main',
    'octocat/..',
    '-bad/repo',
    'bad_owner/repo',
    'octocat/<script>',
    'https://github.com/octocat%2Fevil/repo',
    'octocat/repo//',
    'https://github.com/other/../octocat/repo',
    'https://github.com/octocat\\repo',
    'https://git\thub.com/octocat/repo',
  ])('rejects unsafe or ambiguous repository input %s', (input) => {
    expect(() => site.normalizeRepository(input)).toThrow();
  });

  it.each(['main', 'master', 'release/docs', 'my-branch.v2'])(
    'accepts branch %s',
    (branch) => {
      expect(site.normalizeBranch(branch)).toBe(branch);
    },
  );

  it.each([
    '',
    '../main',
    'main\nrun: evil',
    'main;echo bad',
    '-main',
    'heads//main',
    'branch.lock',
    'branch/',
    '.private',
    'main..next',
  ])('rejects unsafe branch %s', (branch) => {
    expect(() => site.normalizeBranch(branch)).toThrow();
  });

  it('derives workflow, image URLs and installation links from one state', () => {
    const example = site.buildExample(
      'www.github.com/acme/widgets.git/',
      'release/docs',
      'neon-glow',
    );
    expect(example.repository).toBe('acme/widgets');
    const workflow = parseYaml(example.workflow);
    expect(workflow.jobs.chart.steps[0].with.ref).toBe('release/docs');
    expect(workflow.jobs.chart.steps[1].with.repository).toBe('acme/widgets');
    expect(workflow.jobs.chart.steps[1].with.style).toBe('neon-glow');
    expect(workflow.jobs.chart.steps[1].with.dual_theme).toBe(true);
    expect(workflow.jobs.chart.steps[1].with.output).toBe(
      'assets/star-chart.svg',
    );
    expect(example.embed).toContain(
      'acme/widgets/release%2Fdocs/assets/star-chart-light.svg',
    );
    expect(example.embed).toContain(
      'acme/widgets/release%2Fdocs/assets/star-chart-dark.svg',
    );
    expect(example.workflowUrl).toContain(
      'github.com/acme/widgets/new/release%2Fdocs',
    );
    expect(new URL(example.workflowUrl).searchParams.get('value')).toBe(
      example.workflow,
    );
    expect(example.readmeUrl).toBe(
      'https://github.com/acme/widgets/edit/release%2Fdocs/README.md',
    );
    expect(() =>
      site.buildExample('acme/widgets', 'main', 'invented'),
    ).toThrow();
  });

  it('updates actual DOM snippets, preview labels, repository links, and theme together', () => {
    const document = page();
    for (const repository of ['octocat/hello-world', 'acme/widgets']) {
      const example = site.buildExample(repository, 'master', 'line');
      site.updateExamples(document, example, 'dark');
      expect(document.getElementById('workflow-code')?.textContent).toBe(
        example.workflow,
      );
      expect(document.getElementById('readme-code')?.textContent).toBe(
        example.embed,
      );
      expect(document.getElementById('repo-link')?.getAttribute('href')).toBe(
        example.repoUrl,
      );
      expect(
        document.getElementById('workflow-link')?.getAttribute('href'),
      ).toBe(example.workflowUrl);
      expect(document.getElementById('readme-link')?.getAttribute('href')).toBe(
        example.readmeUrl,
      );
      expect(document.getElementById('preview-caption')?.textContent).toContain(
        repository,
      );
      expect(
        document.getElementById('chart-preview')?.getAttribute('src'),
      ).toBe('samples/line-dark.svg');
      expect(
        document.getElementById('chart-preview')?.getAttribute('alt'),
      ).toContain(repository);
      expect(document.documentElement?.getAttribute('data-color-mode')).toBe(
        'dark',
      );
    }
  });

  it('copies current DOM content and gives truthful clipboard feedback', async () => {
    const document = page();
    const example = site.buildExample('acme/widgets', 'main', 'contributions');
    site.updateExamples(document, example, 'light');
    const copies: string[] = [];
    await site.copySnippet(document, 'workflow', {
      writeText: async (text) => {
        copies.push(text);
      },
    });
    expect(copies).toEqual([example.workflow]);
    expect(document.getElementById('copy-status')?.textContent).toContain(
      'copied',
    );
    await site.copySnippet(document, 'readme', {
      writeText: async () => {
        throw new Error('Permission denied');
      },
    });
    expect(document.getElementById('copy-status')?.textContent).toContain(
      'Select and copy',
    );
    await site.copySnippet(document, 'readme');
    expect(document.getElementById('copy-status')?.textContent).not.toContain(
      'copied',
    );
  });

  it('uses real pinned Primer assets, accessible labels, and no em dashes', () => {
    expect(html).toContain(
      'https://unpkg.com/@primer/css@21.5.1/dist/primer.css',
    );
    expect(html).toContain('integrity="sha384-');
    expect(html).toContain('data-light-theme="light"');
    expect(html).toContain('data-dark-theme="dark"');
    expect(html).toContain('Add this to your repo’s README');
    expect(html).toContain('for="repository"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Synthetic');
    expect(html).not.toContain('\u2014');
    expect(readFileSync('docs/site.mjs', 'utf8')).not.toContain('\u2014');
  });

  it('ships valid theme-matched previews with no repository-specific fixture branding', () => {
    for (const style of ['contributions', 'line', 'neon-glow']) {
      for (const theme of ['light', 'dark']) {
        const svg = readFileSync(`docs/samples/${style}-${theme}.svg`, 'utf8');
        expect(checkSvg(svg).errors).toEqual([]);
        expect(svg).toContain('Synthetic demonstration');
        expect(svg).not.toContain('leereilly/star-chart');
      }
    }
  });

  it('preserves the original histories in aggregate and comparison examples', () => {
    for (const name of [
      'aggregate-contributions-light',
      'aggregate-contributions-dark',
      'aggregate-line-light',
      'clustered-bar-light',
      'clustered-bar-dark',
    ]) {
      const svg = readFileSync(`docs/samples/${name}.svg`, 'utf8');
      const original = readFileSync(`examples/${name}.svg`, 'utf8');
      const geometry = (source: string) =>
        Array.from(
          new DOMParser()
            .parseFromString(withoutLegend(source), 'image/svg+xml')
            .getElementsByTagName('*'),
        )
          .filter((element) =>
            ['path', 'rect', 'line', 'circle'].includes(element.tagName),
          )
          .map((element) =>
            [
              'd',
              'x',
              'y',
              'width',
              'height',
              'x1',
              'y1',
              'x2',
              'y2',
              'cx',
              'cy',
              'r',
            ]
              .map((attribute) => element.getAttribute(attribute))
              .join('|'),
          );
      expect(geometry(svg), name).toEqual(geometry(original));
      expect(svg).toContain('Synthetic demonstration + 2 more repositories');
      if (name.startsWith('clustered-bar')) {
        expect(svg).toContain('Synthetic demonstration 2');
        expect(svg).toContain('Synthetic demonstration 3');
      }
    }
  });
});
