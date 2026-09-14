const STYLES = [
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
const choice = (name, label, value, choices, help = '') => ({
  name,
  label,
  value,
  choices,
  help,
  type: 'select',
});
const text = (name, label, value, help = '', type = 'text') => ({
  name,
  label,
  value,
  help,
  type,
});
const integer = (name, label, value, min, max, auto = false) => ({
  name,
  label,
  value,
  min,
  max,
  auto,
  type: auto ? 'text' : 'number',
  help: `${min}-${max}${auto ? ', or auto' : ''}.`,
});
const boolean = (name, label, value, help = '') => ({
  name,
  label,
  value,
  help,
  type: 'checkbox',
});

// Keep these browser-only controls aligned with action.yml and src/config/inputs.ts.
// Tests round trip their values through the real action parser.
const GROUPS = [
  [
    'Basics',
    [
      choice('style', 'Chart style', 'contributions', STYLES),
      choice(
        'period',
        'History window',
        'all',
        ['3m', '6m', '1y', '2y', '5y', 'all', 'custom'],
        'All available history starts at day zero, within GitHub’s available history (up to 3,000 weeks).',
      ),
      integer('weeks', 'Custom trailing weeks', '', 1, 3000),
      choice('animation', 'Animation', 'once', ['none', 'once', 'loop']),
      boolean(
        'dual_theme',
        'Generate light and dark files',
        true,
        'Recommended for READMEs. The theme setting is ignored in dual-theme mode.',
      ),
      text(
        'output',
        'Output SVG path',
        'assets/star-chart.svg',
        'Workspace-relative .svg path. Dual mode adds -light and -dark before the extension.',
      ),
    ],
  ],
  [
    'Sources and theme',
    [
      text(
        'repository',
        'Repository to chart',
        '',
        'Blank uses the installation repository above. Accepts owner/repo or a GitHub URL. Ignored when an aggregate/comparison list is supplied.',
      ),
      text(
        'repositories',
        'Aggregate or compare repositories',
        '',
        'Comma- or newline-separated owner/repo values, maximum 20 unique repositories. Overrides the chart source, not the installation destination. Clustered bar compares sources; other styles aggregate them.',
        'textarea',
      ),
      choice(
        'theme',
        'Single-file theme',
        'light',
        ['light', 'dark', 'auto'],
        'Auto follows the viewer’s system preference. Disabled when generating both themes.',
      ),
      choice(
        'scale',
        'Vertical scale',
        'absolute',
        ['absolute', 'visible'],
        'Absolute starts at zero; visible starts at the window baseline.',
      ),
    ],
  ],
  [
    'Layout and cells',
    [
      integer('columns', 'Columns (blocks)', '52', 1, 260),
      integer('rows', 'Rows (blocks)', '26', 1, 200),
      integer('width', 'Width (pixels)', '900', 240, 2400),
      integer('height', 'Height (pixels)', 'auto', 120, 4800, true),
      integer('cell_size', 'Cell size (pixels)', 'auto', 1, 32, true),
      integer('cell_gap', 'Cell gap (pixels)', 'auto', 0, 12, true),
      integer('cell_radius', 'Cell radius (pixels)', 'auto', 0, 16, true),
    ],
  ],
  [
    'Labels and typography',
    [
      boolean('show_title', 'Show title', true),
      boolean('show_total', 'Show star total', true),
      boolean('show_change', 'Show period additions', true),
      boolean('show_dates', 'Show dates', true),
      boolean(
        'show_x_axis',
        'Show X axis',
        true,
        'Hiding this axis also hides dates.',
      ),
      choice(
        'show_y_axis',
        'Show Y axis',
        '',
        ['', 'true', 'false'],
        'Blank: on except for sparkline. Numeric recorded-star counts.',
      ),
      choice(
        'show_legend',
        'Show legend',
        '',
        ['', 'true', 'false'],
        'Blank: on except for sparkline. Independent of the axes.',
      ),
      boolean('logo', 'Show Star Chart wordmark', true),
      text(
        'title',
        'Custom title',
        '',
        'Maximum 200 characters. Blank derives the repository title.',
      ),
      choice('date_format', 'Date format', 'short', ['short', 'long', 'iso']),
      integer('axis_font_size', 'Axis font size (pixels)', '10', 6, 48),
      text(
        'font_family',
        'Font family',
        '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'Comma-separated font names, optionally quoted. Maximum 200 characters.',
      ),
    ],
  ],
  [
    'Background and palette',
    [
      choice(
        'background_mode',
        'Background mode',
        '',
        ['', 'transparent', 'solid'],
        'Inferred uses the background value. Solid requires a hex colour. Transparent ignores the background value.',
      ),
      text(
        'background',
        'Background colour',
        'transparent',
        'Hex (#RGB, #RGBA, #RRGGBB or #RRGGBBAA), transparent, none, or blank when inferred.',
      ),
      ...[
        'empty_color',
        'level_1_color',
        'level_2_color',
        'level_3_color',
        'level_4_color',
      ].map((name) =>
        text(
          name,
          name.replaceAll('_', ' '),
          '',
          'Optional hex colour: #RGB, #RGBA, #RRGGBB or #RRGGBBAA.',
        ),
      ),
    ],
  ],
  [
    'Animation details',
    [
      text(
        'animation_duration',
        'Build duration',
        '4s',
        '0.2-60 seconds. Accepts 4, 4s, or 500ms.',
      ),
      text(
        'animation_pause',
        'Loop pause',
        '2s',
        '0-60 seconds. Used only in loop mode.',
      ),
      text(
        'animation_delay',
        'Initial delay',
        '0s',
        '0-60 seconds. Accepts seconds, s, or ms.',
      ),
      choice('animation_style', 'Animation style', 'grow', [
        'grow',
        'reveal',
        'cascade',
      ]),
      choice('animation_direction', 'Animation direction', 'chronological', [
        'chronological',
        'simultaneous',
      ]),
      choice('animation_easing', 'Animation easing', 'ease-out', [
        'linear',
        'ease-in',
        'ease-out',
        'ease-in-out',
      ]),
      boolean('animate_total', 'Animate the header total', false),
    ],
  ],
];
const FIELDS = GROUPS.flatMap(([, fields]) => fields);
const fieldId = (name) => (name === 'style' ? 'chart-style' : `config-${name}`);
const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const REPOSITORY_ERROR =
  'Enter owner/repo or a GitHub repository URL, without extra paths, queries, or fragments.';

export function normalizeRepository(input) {
  let path = input.trim();
  if (
    Array.from(path).some((character) => character.charCodeAt(0) <= 32) ||
    /[\\%]/.test(path) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)
  ) {
    throw new Error(REPOSITORY_ERROR);
  }
  if (/^(?:https?:\/\/|(?:www\.)?github\.com\/)/i.test(path)) {
    const url = new URL(/^https?:\/\//i.test(path) ? path : `https://${path}`);
    if (
      !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      throw new Error(REPOSITORY_ERROR);
    }
    path = url.pathname.slice(1);
  }
  path = path.replace(/\/$/, '').replace(/\.git$/i, '');
  const parts = path.split('/');
  const [owner, repo] = parts;
  if (
    parts.length !== 2 ||
    !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner ?? '') ||
    owner.includes('--') ||
    !/^[a-z\d_.-]{1,100}$/i.test(repo ?? '') ||
    repo === '.' ||
    repo === '..'
  ) {
    throw new Error(REPOSITORY_ERROR);
  }
  return `${owner}/${repo}`;
}

export function normalizeBranch(input) {
  const branch = input.trim();
  if (
    !/^[a-z\d][a-z\d._/-]{0,199}$/i.test(branch) ||
    branch.includes('..') ||
    branch
      .split('/')
      .some(
        (part) =>
          !part ||
          part.startsWith('.') ||
          part.endsWith('.') ||
          part.endsWith('.lock'),
      )
  ) {
    throw new Error(
      'Enter a default branch such as main, master, or release/docs. Spaces and shell characters are not supported.',
    );
  }
  return branch;
}

function invalid(field, message) {
  const error = new Error(`${field}: ${message}`);
  error.field = fieldId(field);
  throw error;
}

function validatePath(raw) {
  const value = raw.trim();
  if (
    !value ||
    value.length > 400 ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32) ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[a-z]:/i.test(value) ||
    !/\.svg$/i.test(value) ||
    value.split('/').some((part) => part === '..' || part === '.git')
  ) {
    invalid(
      'output',
      'Use a workspace-relative .svg path, max 400 characters, without traversal, .git, backslashes, or control characters.',
    );
  }
  const normalized = value
    .split('/')
    .filter((part) => part && part !== '.')
    .join('/');
  if (normalized.startsWith('..'))
    invalid('output', 'Path escapes the workspace.');
  return normalized;
}

function validateOptions(options, installation) {
  const values = {};
  for (const field of FIELDS) {
    const { name, value: fallback } = field;
    let value = String(options[name] ?? fallback).trim();
    if (value.includes('${{'))
      invalid(name, 'GitHub expressions are not allowed in settings.');
    if (field.type === 'checkbox') {
      value = value.toLowerCase() || String(fallback);
      if (!['true', 'false'].includes(value))
        invalid(name, 'Choose true or false.');
      values[name] = value === 'true';
      continue;
    }
    if (field.choices) {
      value = value.toLowerCase() || String(fallback);
      if (!field.choices.includes(value))
        invalid(
          name,
          `Choose ${field.choices.map((choice) => choice || 'blank (default)').join(', ')}.`,
        );
    }
    if (field.min !== undefined) {
      if (name === 'weeks' && values.period !== 'custom') continue;
      value = value || String(fallback);
      if (field.auto && value === 'auto') {
        values[name] = value;
        continue;
      }
      if (
        !/^-?\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < field.min ||
        Number(value) > field.max
      ) {
        invalid(
          name,
          `Enter an integer from ${field.min} to ${field.max}${field.auto ? ', or auto' : ''}.`,
        );
      }
      value = String(Number(value));
    }
    values[name] = value;
  }
  if (values.period === 'custom') delete values.period;
  if (Number(values.columns) * Number(values.rows) > 52000)
    invalid('rows', 'Columns × rows must not exceed 52,000.');
  if (
    values.cell_size !== 'auto' &&
    values.cell_radius !== 'auto' &&
    Number(values.cell_radius) > Math.floor(Number(values.cell_size) / 2)
  )
    invalid('cell_radius', 'Must not exceed half of cell_size.');
  const seen = new Set();
  values.repositories = values.repositories
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      if (
        !/^[a-z\d._-]+\/[a-z\d._-]+$/i.test(entry) ||
        ['.', '..'].includes(entry.split('/')[1])
      )
        invalid(
          'repositories',
          'Use comma- or newline-separated owner/repo values.',
        );
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
  if (seen.size > 20)
    invalid('repositories', 'Choose at most 20 unique repositories.');
  try {
    values.repository = values.repositories
      ? installation
      : normalizeRepository(values.repository || installation);
  } catch (error) {
    invalid('repository', error.message);
  }
  values.output = validatePath(values.output);
  if (
    values.title.length > 200 ||
    Array.from(values.title).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && ![9, 10, 13].includes(code);
    })
  )
    invalid('title', 'Use at most 200 characters without control characters.');
  values.font_family ||= FIELDS.find(
    (field) => field.name === 'font_family',
  ).value;
  if (
    values.font_family.length > 200 ||
    Array.from(values.font_family).some(
      (character) => character.charCodeAt(0) < 32,
    ) ||
    values.font_family.split(',').some((family) => {
      const trimmed = family.trim();
      const inner = /^(['"]).*\1$/.test(trimmed)
        ? trimmed.slice(1, -1)
        : trimmed;
      return !/^[a-z\d _-]+$/i.test(inner);
    })
  )
    invalid(
      'font_family',
      'Use a comma-separated font list, at most 200 characters, without CSS syntax.',
    );
  for (const name of [
    'empty_color',
    'level_1_color',
    'level_2_color',
    'level_3_color',
    'level_4_color',
  ]) {
    if (values[name] && !HEX_COLOR.test(values[name]))
      invalid(name, 'Enter a 3, 4, 6, or 8 digit hex colour.');
  }
  if (values.background_mode === 'transparent') {
    values.background = 'transparent';
  } else if (
    !HEX_COLOR.test(values.background) &&
    (values.background_mode === 'solid' ||
      !['', 'none', 'transparent'].includes(values.background.toLowerCase()))
  ) {
    invalid('background', 'Enter a hex colour; solid mode requires one.');
  }
  for (const name of [
    'animation_duration',
    'animation_pause',
    'animation_delay',
  ]) {
    values[name] ||= FIELDS.find((field) => field.name === name).value;
    const match = /^(\d+(?:\.\d+)?)(ms|s)?$/i.exec(values[name]);
    const seconds = match
      ? Number(match[1]) / (match[2]?.toLowerCase() === 'ms' ? 1000 : 1)
      : NaN;
    const min = name === 'animation_duration' ? 0.2 : 0;
    if (!Number.isFinite(seconds) || seconds < min || seconds > 60)
      invalid(name, `Enter ${min}-60 seconds, optionally ending in s or ms.`);
  }
  return values;
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;
const yamlValue = (value) =>
  typeof value === 'boolean' ? String(value) : JSON.stringify(value);
const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const encodeSegment = (value) =>
  encodeURIComponent(value).replaceAll("'", '%27');

export function buildExample(repositoryInput, branchInput, options = {}) {
  const repository = normalizeRepository(repositoryInput);
  const branch = normalizeBranch(branchInput);
  const values = validateOptions(
    typeof options === 'string' ? { style: options } : options,
    repository,
  );
  const style = values.style;
  const extensionIndex = values.output.lastIndexOf('.');
  const stem = values.output.slice(0, extensionIndex);
  const extension = values.output.slice(extensionIndex);
  if (values.dual_theme && !stem.split('/').pop())
    invalid('output', 'Dual-theme output requires a file name before .svg.');
  const paths = values.dual_theme
    ? ['light', 'dark'].map((theme) =>
        validatePath(`${stem}-${theme}${extension}`),
      )
    : [values.output];
  const repoUrl = `https://github.com/${repository}`;
  const ref = encodeURIComponent(branch);
  const rawUrl = (path) =>
    escapeHtml(
      `https://raw.githubusercontent.com/${repository}/${ref}/${path.split('/').map(encodeSegment).join('/')}`,
    );
  const chartSources = values.repositories || values.repository;
  const alt = escapeHtml(`Star history for ${chartSources}`);
  const workflow = `name: Star Chart
on:
  schedule:
    - cron: '17 4 * * *'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: star-chart
  cancel-in-progress: true

jobs:
  chart:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: '${branch}'

      - uses: leereilly/star-chart@main
        with:
          token: \${{ github.token }}
${Object.entries(values)
  .map(([name, value]) => `          ${name}: ${yamlValue(value)}`)
  .join('\n')}

      - name: Commit updated charts
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git --literal-pathspecs add -- ${paths.map(shellQuote).join(' ')}
          if ! git diff --cached --quiet; then
            git commit -m 'chore: update star charts'
            git push origin HEAD:'${branch}'
          fi
`;
  const embed = values.dual_theme
    ? `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${rawUrl(paths[1])}">
  <img alt="${alt}" src="${rawUrl(paths[0])}">
</picture>`
    : `<img alt="${alt}" src="${rawUrl(paths[0])}">`;
  const query = new URLSearchParams({
    filename: '.github/workflows/star-chart.yml',
    value: workflow,
  });
  return {
    repository,
    branch,
    style,
    options: values,
    workflow,
    embed,
    repoUrl,
    workflowUrl: `${repoUrl}/new/${ref}?${query}`,
    readmeUrl: `${repoUrl}/edit/${ref}/README.md`,
  };
}

export function updateTheme(document, theme) {
  document.documentElement.setAttribute('data-color-mode', theme);
  document
    .getElementById('theme-toggle')
    .setAttribute('aria-pressed', String(theme === 'dark'));
  for (const image of document.getElementsByTagName('img')) {
    const source = image.getAttribute(`data-${theme}-src`);
    if (source && image.getAttribute('src') !== source) {
      image.setAttribute('src', source);
    }
  }
}

export function updateExamples(document, example, theme) {
  const get = (id) => document.getElementById(id);
  updateTheme(document, theme);
  get('workflow-code').textContent = example.workflow;
  get('readme-code').textContent = example.embed;
  get('repo-link').textContent = example.repository;
  get('repo-link').setAttribute('href', example.repoUrl);
  get('branch-name').textContent = example.branch;
  get('workflow-link').setAttribute('href', example.workflowUrl);
  get('readme-link').setAttribute('href', example.readmeUrl);
  const previewTheme =
    example.options.dual_theme || example.options.theme === 'auto'
      ? theme
      : example.options.theme;
  const animated =
    example.style === 'contributions' && example.options.animation !== 'none';
  const previewStyle = animated
    ? `contributions-animated-${example.options.animation}`
    : example.style;
  get('chart-preview').setAttribute(
    'src',
    `samples/${previewStyle}-${previewTheme}.svg`,
  );
  get('chart-preview').setAttribute(
    'alt',
    `Synthetic ${example.style} illustration for ${example.options.repositories || example.options.repository}`,
  );
  get('preview-caption').textContent =
    `Synthetic ${example.style} illustration for ${example.options.repositories || example.options.repository}. ` +
    `This sample does not render your settings or full history. The workflow uses ${
      example.options.period === 'all'
        ? 'all available history from day zero'
        : example.options.period || `${example.options.weeks} trailing weeks`
    }.`;
}

function createControls(document) {
  const root = document.getElementById('chart-options');
  if (document.getElementById('chart-style')) return;
  for (const [index, [title, fields]] of GROUPS.entries()) {
    let parent = root;
    if (index > 0) {
      parent = document.createElement('details');
      parent.setAttribute('class', 'Box p-3 mt-3');
      const summary = document.createElement('summary');
      summary.textContent = title;
      parent.appendChild(summary);
      root.appendChild(parent);
    }
    const grid = document.createElement('div');
    grid.setAttribute('class', 'configuration-grid mt-3');
    parent.appendChild(grid);
    for (const field of fields) {
      const id = fieldId(field.name);
      const wrapper = document.createElement('div');
      wrapper.setAttribute('class', 'form-group my-0');
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = field.label;
      wrapper.appendChild(label);
      const control = document.createElement(
        field.type === 'select'
          ? 'select'
          : field.type === 'textarea'
            ? 'textarea'
            : 'input',
      );
      control.setAttribute('id', id);
      control.setAttribute('name', field.name);
      control.setAttribute('data-action-input', field.name);
      control.setAttribute('aria-describedby', `${id}-help input-error`);
      control.setAttribute(
        'class',
        field.type === 'checkbox'
          ? 'ml-2'
          : `${field.type === 'select' ? 'form-select' : 'form-control'} width-full mt-2`,
      );
      if (field.choices) {
        for (const value of field.choices) {
          const option = document.createElement('option');
          option.setAttribute('value', value);
          option.textContent =
            value === ''
              ? field.name === 'show_y_axis' || field.name === 'show_legend'
                ? 'Style default'
                : 'Inferred'
              : value === 'all'
                ? 'All available history (day zero)'
                : value === 'custom'
                  ? 'Custom weeks'
                  : value;
          if (value === field.value) option.setAttribute('selected', '');
          control.appendChild(option);
        }
      } else if (field.type !== 'textarea') {
        control.setAttribute('type', field.type);
        if (field.type === 'checkbox') {
          control.checked = field.value;
          if (field.value) control.setAttribute('checked', '');
        } else control.setAttribute('value', field.value);
        if (field.min !== undefined && !field.auto) {
          control.setAttribute('min', String(field.min));
          control.setAttribute('max', String(field.max));
          control.setAttribute('step', '1');
        }
      }
      control.value = String(field.value);
      wrapper.appendChild(control);
      const help = document.createElement('p');
      help.setAttribute('class', 'note');
      help.setAttribute('id', `${id}-help`);
      help.textContent = `${field.help ? `${field.help} ` : ''}Action input: ${field.name}.`;
      wrapper.appendChild(help);
      grid.appendChild(wrapper);
    }
  }
}

export async function copySnippet(document, name, clipboard) {
  const status = document.getElementById('copy-status');
  const text = document.getElementById(`${name}-code`).textContent;
  status.textContent = '';
  try {
    if (!clipboard?.writeText) throw new Error('Clipboard is unavailable.');
    await clipboard.writeText(text);
    status.textContent = `${name === 'workflow' ? 'Workflow' : 'README snippet'} copied.`;
  } catch {
    status.textContent = 'Copy unavailable. Select and copy the snippet below.';
    const code = document.getElementById(`${name}-code`);
    // Reveal collapsed code when clipboard permission is unavailable.
    const details = code.closest?.('details');
    if (details) details.open = true;
  }
}

export function mount(document) {
  const get = (id) => document.getElementById(id);
  createControls(document);
  let theme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  try {
    const saved = globalThis.localStorage.getItem('star-chart-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch {
    // Theme switching still works when storage is disabled.
  }
  let example;
  function refresh() {
    for (const id of [
      'repository',
      'branch',
      ...FIELDS.map((field) => fieldId(field.name)),
    ])
      get(id).removeAttribute('aria-invalid');
    const options = Object.fromEntries(
      FIELDS.map((field) => [
        field.name,
        field.type === 'checkbox'
          ? get(fieldId(field.name)).checked
          : get(fieldId(field.name)).value,
      ]),
    );
    get(fieldId('theme')).disabled = options.dual_theme;
    get(fieldId('weeks')).disabled = options.period !== 'custom';
    get(fieldId('repository')).disabled = options.repositories
      .split(/[\n,]/)
      .some((entry) => entry.trim());
    get(fieldId('background')).disabled =
      options.background_mode === 'transparent';
    get('copy-status').textContent = '';
    try {
      let repository;
      let branch;
      try {
        repository = normalizeRepository(get('repository').value);
      } catch (error) {
        get('repository').setAttribute('aria-invalid', 'true');
        throw error;
      }
      try {
        branch = normalizeBranch(get('branch').value);
      } catch (error) {
        get('branch').setAttribute('aria-invalid', 'true');
        throw error;
      }
      example = buildExample(repository, branch, options);
      updateExamples(document, example, theme);
      get('input-error').hidden = true;
      get('generated-examples').hidden = false;
      get('readme-cta').setAttribute('href', '#setup');
      get('readme-cta').removeAttribute('aria-disabled');
      for (const name of ['workflow', 'readme']) {
        get(`copy-${name}`).disabled = false;
        get(`${name}-link`).removeAttribute('aria-disabled');
      }
    } catch (error) {
      example = undefined;
      if (error.field) {
        const control = get(error.field);
        control.setAttribute('aria-invalid', 'true');
        for (
          let parent = control.parentNode;
          parent;
          parent = parent.parentNode
        ) {
          if (parent.tagName?.toLowerCase() === 'details') parent.open = true;
        }
      }
      get('input-error').textContent = error.message;
      get('input-error').hidden = false;
      get('generated-examples').hidden = true;
      get('readme-cta').removeAttribute('href');
      get('readme-cta').setAttribute('aria-disabled', 'true');
      for (const name of ['workflow', 'readme']) {
        get(`copy-${name}`).disabled = true;
        get(`${name}-link`).removeAttribute('href');
        get(`${name}-link`).setAttribute('aria-disabled', 'true');
        get(`${name}-code`).textContent = '';
      }
    }
  }
  get('repository-form').addEventListener('input', refresh);
  get('repository-form').addEventListener('change', refresh);
  get('repository-form').addEventListener('submit', (event) => {
    event.preventDefault();
    refresh();
    if (example) get('repository').value = example.repository;
  });
  get('theme-toggle').addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    updateTheme(document, theme);
    if (example) updateExamples(document, example, theme);
    try {
      globalThis.localStorage.setItem('star-chart-theme', theme);
    } catch {
      // Do not require browser storage to use the site.
    }
  });
  get('readme-cta').addEventListener('click', (event) => {
    event.preventDefault();
    if (!example) {
      get('repository').focus();
    } else {
      get('setup').scrollIntoView({ block: 'start' });
      get('setup-title').focus({ preventScroll: true });
    }
  });
  for (const name of ['workflow', 'readme']) {
    get(`copy-${name}`).addEventListener('click', () => {
      if (example)
        void copySnippet(document, name, globalThis.navigator.clipboard);
    });
  }
  updateTheme(document, theme);
  refresh();
}

if (globalThis.document) mount(globalThis.document);
