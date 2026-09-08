import type { ChartOutputs } from './models/index.js';
import type { ApiClient, RetryOptions } from './api/client.js';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
export declare const INPUT_NAMES: readonly ["token", "repository", "repositories", "output", "style", "theme", "dual_theme", "period", "weeks", "columns", "rows", "width", "height", "show_title", "show_total", "show_change", "show_dates", "show_x_axis", "show_y_axis", "show_legend", "title", "date_format", "axis_font_size", "cell_size", "cell_gap", "cell_radius", "background_mode", "background", "empty_color", "level_1_color", "level_2_color", "level_3_color", "level_4_color", "font_family", "scale", "logo", "animation", "animation_duration", "animation_pause", "animation_delay", "animation_style", "animation_direction", "animation_easing", "animate_total"];
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
export declare function run(deps: RunDeps): Promise<ChartOutputs | null>;
