import type {
  ChartConfig,
  ChartModel,
  ChartOutputs,
  RepositoryRef,
  RepositoryHistorySource,
} from './models/index.js';
import type { ApiClient, RetryOptions } from './api/client.js';
import { parseInputs, type RawInputs } from './config/inputs.js';
import { configDualTheme, configRepositories } from './config/defaults.js';
import { fetchRepository } from './api/repository.js';
import { fetchHistory } from './api/history.js';
import { normalizeHistory } from './history/normalize.js';
import { buildMultiRepositoryChartModel } from './history/multi.js';
import { renderChart, SIZE_LIMITS } from './renderers/index.js';
import { deriveDualPaths } from './utils/path.js';
import { writeChartFiles, type ChartFile } from './utils/write.js';
import { buildOutputs, outputEntries } from './outputs.js';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

export const INPUT_NAMES = [
  'token',
  'repository',
  'repositories',
  'output',
  'style',
  'theme',
  'dual_theme',
  'period',
  'weeks',
  'columns',
  'rows',
  'width',
  'height',
  'show_title',
  'show_total',
  'show_change',
  'show_dates',
  'show_x_axis',
  'show_y_axis',
  'show_legend',
  'title',
  'date_format',
  'axis_font_size',
  'cell_size',
  'cell_gap',
  'cell_radius',
  'background_mode',
  'background',
  'empty_color',
  'level_1_color',
  'level_2_color',
  'level_3_color',
  'level_4_color',
  'font_family',
  'scale',
  'logo',
  'animation',
  'animation_duration',
  'animation_pause',
  'animation_delay',
  'animation_style',
  'animation_direction',
  'animation_easing',
  'animate_total',
] as const;

/** Injectable dependencies for the orchestration. */
export interface RunDeps {
  getInput(name: string): string;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  debug(message: string): void;
  setSecret(secret: string): void;
  createClient(token: string): ApiClient;
  now(): number;
  workspace: string;
  env: NodeJS.ProcessEnv;
  fsImpl?: typeof fs;
  fspImpl?: typeof fsp;
  retry?: RetryOptions;
}

/**
 * Runs the full pipeline: parse inputs, fetch, transform, render, write, and
 * set outputs. Returns the outputs on success, or null on handled failure.
 *
 * One repository or many, one output file or a light/dark pair: the data is
 * fetched and modelled exactly once either way, and no output is set until
 * every file has been written.
 */
export async function run(deps: RunDeps): Promise<ChartOutputs | null> {
  try {
    const raw: RawInputs = {};
    for (const name of INPUT_NAMES) {
      const value = deps.getInput(name);
      if (value !== '') {
        raw[name] = value;
      }
    }

    const { config, token } = parseInputs(raw, {
      env: deps.env,
      warn: (message) => deps.warning(message),
    });

    if (token) {
      deps.setSecret(token);
    } else {
      deps.info('No token provided; using unauthenticated public access.');
    }

    const client = deps.createClient(token);
    const startedAt = deps.now();
    const retry: RetryOptions = { startedAt, ...deps.retry };

    const repositories = configRepositories(config);
    const sources = await collect(client, repositories, token, retry, deps);

    const asOf = deps.now();
    const model = buildMultiRepositoryChartModel(config, sources, { asOf });
    if (model.hasSyntheticWeeks) {
      deps.warning(
        'Chart includes weeks with no recorded data (shown as zero additions).',
      );
    }

    const files = renderFiles(model, config, deps);

    const results = await writeChartFiles(files, {
      workspace: deps.workspace,
      fsImpl: deps.fsImpl,
      fspImpl: deps.fspImpl,
    });

    for (const [index, result] of results.entries()) {
      const bytes = files[index]?.bytes ?? 0;
      if (result.changed) {
        deps.info(`Wrote ${result.relativePath} (${bytes} bytes).`);
      } else {
        deps.info(`${result.relativePath} is unchanged; skipped write.`);
      }
    }

    const primary = results[0];
    if (!primary) {
      throw new Error('No chart file was written.');
    }
    const dual = configDualTheme(config);
    const outputs = buildOutputs(model, {
      chartPath: primary.relativePath,
      chartPathLight: dual ? primary.relativePath : '',
      chartPathDark: dual ? (results[1]?.relativePath ?? '') : '',
    });

    for (const [name, value] of outputEntries(outputs)) {
      deps.setOutput(name, value);
    }

    return outputs;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error generating chart.';
    deps.setFailed(message);
    return null;
  }
}

interface RenderedFile extends ChartFile {
  readonly bytes: number;
}

/**
 * Fetches every repository through the same API flow, sharing one retry and
 * time budget. Requests are issued one repository at a time so a wide
 * aggregate stays rate-limit friendly, and any failure aborts the whole run —
 * before a single file is written — naming the repository that failed.
 */
async function collect(
  client: ApiClient,
  repositories: readonly RepositoryRef[],
  token: string,
  retry: RetryOptions,
  deps: RunDeps,
): Promise<RepositoryHistorySource[]> {
  const sources: RepositoryHistorySource[] = [];

  for (const repository of repositories) {
    const fullName = `${repository.owner}/${repository.repo}`;
    try {
      deps.info(`Fetching metadata for ${fullName}...`);
      const metadata = await fetchRepository(client, repository, token, retry);

      deps.info(`Fetching star history for ${fullName}...`);
      const rawHistory = await fetchHistory(client, repository, token, retry);
      sources.push({
        metadata,
        history: normalizeHistory(rawHistory, {
          asOf: deps.now(),
          warn: (message) => deps.warning(`${fullName}: ${message}`),
        }),
      });
    } catch (error) {
      throw describeRepositoryFailure(error, fullName);
    }
  }

  if (repositories.length > 1) {
    deps.info(`Aggregating ${repositories.length} repositories.`);
  }

  return sources;
}

function describeRepositoryFailure(error: unknown, fullName: string): Error {
  if (error instanceof Error) {
    return error.message.includes(fullName)
      ? error
      : new Error(`${fullName}: ${error.message}`, { cause: error });
  }
  const message =
    typeof error === 'string' && error !== '' ? error : 'unknown error';
  return new Error(`${fullName}: ${message}`, { cause: error });
}

/**
 * Renders the model once per output file: a single file in the configured
 * theme, or a fixed light and a fixed dark file in dual mode.
 */
function renderFiles(
  model: ChartModel,
  config: ChartConfig,
  deps: RunDeps,
): RenderedFile[] {
  if (!configDualTheme(config)) {
    return [renderOne(model, config.output, config.theme, deps)];
  }

  const paths = deriveDualPaths(config.output);
  return [
    renderOne(model, paths.light, 'light', deps),
    renderOne(model, paths.dark, 'dark', deps),
  ];
}

function renderOne(
  model: ChartModel,
  outputPath: string,
  theme: ChartConfig['theme'],
  deps: RunDeps,
): RenderedFile {
  const themed: ChartModel =
    model.config.theme === theme && model.config.output === outputPath
      ? model
      : {
          ...model,
          config: { ...model.config, theme, output: outputPath },
        };
  const { svg, bytes } = renderChart(themed);

  if (themed.config.animation.mode !== 'none') {
    if (bytes > SIZE_LIMITS.animatedWarn) {
      deps.warning(
        `Animated SVG ${outputPath} is ${bytes} bytes ` +
          `(soft limit ${SIZE_LIMITS.animatedWarn}).`,
      );
    }
  } else if (bytes > SIZE_LIMITS.staticWarn) {
    deps.warning(
      `Static SVG ${outputPath} is ${bytes} bytes ` +
        `(soft limit ${SIZE_LIMITS.staticWarn}).`,
    );
  }

  return { path: outputPath, content: svg, bytes };
}
