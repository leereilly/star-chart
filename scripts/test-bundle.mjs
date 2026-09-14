import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  buildMultiRepositoryChartModel,
  normalizeHistory,
  parseInputs,
  renderMultiRepositoryStarChart,
} from '../dist/lib.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist', 'index.js');

if (!existsSync(dist)) {
  console.error('dist/index.js not found. Run `npm run build` first.');
  process.exit(1);
}

const scratch = join(root, '.scratch', 'bundle-smoke');
rmSync(scratch, { recursive: true, force: true });
const workspace = join(scratch, 'ws');
mkdirSync(workspace, { recursive: true });
const outputFile = join(scratch, 'gh_output');
writeFileSync(outputFile, '');

const stub = resolve(root, 'tests/helpers/fetch-stub.mjs');

try {
  execFileSync('node', ['--import', stub, dist], {
    env: {
      ...process.env,
      INPUT_REPOSITORY: 'octocat/hello-world',
      INPUT_TOKEN: '',
      INPUT_OUTPUT: 'assets/chart.svg',
      INPUT_ANIMATION: 'once',
      GITHUB_WORKSPACE: workspace,
      GITHUB_OUTPUT: outputFile,
      GITHUB_REPOSITORY: 'octocat/hello-world',
    },
    stdio: 'inherit',
  });
} catch {
  console.error('Bundle smoke test failed to execute the action.');
  process.exit(1);
}

const svgPath = join(workspace, 'assets/chart.svg');
if (!existsSync(svgPath)) {
  console.error('Bundle smoke test did not produce the SVG.');
  process.exit(1);
}
const svg = readFileSync(svgPath, 'utf8');
const outputs = readFileSync(outputFile, 'utf8');

// Second pass: compare two repositories in a dual light/dark pair.
const dualWorkspace = join(scratch, 'ws-dual');
mkdirSync(dualWorkspace, { recursive: true });
const dualOutputFile = join(scratch, 'gh_output_dual');
writeFileSync(dualOutputFile, '');

try {
  execFileSync('node', ['--import', stub, dist], {
    env: {
      ...process.env,
      INPUT_REPOSITORIES: 'octocat/hello-world, octocat/spoon-knife',
      INPUT_TOKEN: '',
      INPUT_OUTPUT: 'assets/chart.svg',
      INPUT_DUAL_THEME: 'true',
      INPUT_STYLE: 'clustered-bar',
      INPUT_COLUMNS: '8',
      GITHUB_WORKSPACE: dualWorkspace,
      GITHUB_OUTPUT: dualOutputFile,
      GITHUB_REPOSITORY: 'octocat/hello-world',
    },
    stdio: 'inherit',
  });
} catch {
  console.error('Bundle smoke test failed to execute the dual-theme run.');
  process.exit(1);
}

const lightPath = join(dualWorkspace, 'assets/chart-light.svg');
const darkPath = join(dualWorkspace, 'assets/chart-dark.svg');
const dualOutputs = readFileSync(dualOutputFile, 'utf8');

const checks = [
  [svg.startsWith('<svg'), 'SVG output is well-formed'],
  [/stars<<[^\n]+\n4321\n/.test(outputs), 'stars output set'],
  [
    /chart_path<<[^\n]+\nassets\/chart\.svg\n/.test(outputs),
    'chart_path output set',
  ],
  [/growth_percentage<<[^\n]+\n/.test(outputs), 'growth_percentage set'],
  [/peak_gain<<[^\n]+\n\d+\n/.test(outputs), 'peak_gain set'],
  [existsSync(lightPath), 'dual light SVG written'],
  [existsSync(darkPath), 'dual dark SVG written'],
  [
    existsSync(lightPath) &&
      readFileSync(lightPath, 'utf8').includes(
        'data-repository="octocat/spoon-knife"',
      ),
    'bundled action preserves independent comparison series',
  ],
  [
    !existsSync(join(dualWorkspace, 'assets/chart.svg')),
    'dual mode writes no single-theme file',
  ],
  [
    existsSync(lightPath) &&
      existsSync(darkPath) &&
      readFileSync(lightPath, 'utf8') !== readFileSync(darkPath, 'utf8'),
    'dual themes differ',
  ],
  // 4321 + 1000 stubbed stars across the two aggregated repositories.
  [/stars<<[^\n]+\n5321\n/.test(dualOutputs), 'aggregate stars summed'],
  [
    /chart_path_dark<<[^\n]+\nassets\/chart-dark\.svg\n/.test(dualOutputs),
    'chart_path_dark output set',
  ],
  [
    dualOutputs.includes('<source media="(prefers-color-scheme: dark)"'),
    'picture_snippet output set',
  ],
];
const asOf = Date.UTC(2026, 8, 6);
const sources = [1, 2].map((index) => ({
  metadata: {
    owner: 'example',
    repo: `repo-${index}`,
    fullName: `example/repo-${index}`,
    createdAt: '2026-01-01T00:00:00Z',
    stargazersCount: index * 100,
  },
  history: normalizeHistory(
    [
      {
        timestamp: '2026-08-23T00:00:00Z',
        total: index * 10,
        days: [index * 10, 0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: '2026-08-30T00:00:00Z',
        total: index * 20,
        days: [index * 20, 0, 0, 0, 0, 0, 0],
      },
    ],
    { asOf },
  ),
}));
for (const style of [
  'grid',
  'step-line',
  'milestone-scatter',
  'milestone-area',
  'clustered-bar',
  'neon-glow',
  'neon-glow-stream',
  'ascii-terminal',
  'hand-drawn',
]) {
  const { config } = parseInputs({
    repository: 'example/repo-1',
    style,
    columns: '8',
  });
  const model = buildMultiRepositoryChartModel(config, sources, { asOf });
  const svg = renderMultiRepositoryStarChart(config, sources, asOf);
  checks.push([
    model.series.length === 2 &&
      svg.startsWith('<svg') &&
      !/NaN|Infinity/.test(svg),
    `bundled library renders ${style} with aligned series`,
  ]);
}
let ok = true;
for (const [pass, label] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}`);
  if (!pass) ok = false;
}

rmSync(scratch, { recursive: true, force: true });
if (!ok) {
  process.exit(1);
}
console.log('Bundle smoke test passed.');
