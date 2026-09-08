import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

import type { ChartModel } from '../models/index.js';
import {
  normalizeChartModel,
  type ChartModelInput,
} from '../config/defaults.js';
import { flattenThemeVars } from './shared.js';
import { buildFrameSequence, type FrameOptions } from './frames.js';

/** The default background composited behind an otherwise transparent chart. */
const THEME_BACKGROUND: Record<'light' | 'dark', string> = {
  light: '#ffffff',
  dark: '#0d1117',
};

/** Family name embedded in the bundled fallback font. */
const FALLBACK_FONT_FAMILY = 'Roboto';

/** Lower/upper bounds for the rasterized frame width. */
const MIN_WIDTH = 100;
const MAX_WIDTH = 2400;

export interface GifResult {
  readonly buffer: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly loop: boolean;
  readonly bytes: number;
}

export interface GifOptions extends FrameOptions {
  /** Rasterized frame width in px; defaults to the chart's configured width. */
  readonly width?: number;
}

let wasmReady: Promise<void> | null = null;
let fontBuffer: Uint8Array | null = null;
let symbolFontBuffer: Uint8Array | null = null;

/**
 * Renders a chart model to an animated GIF.
 *
 * Frames are produced from the chart's own animation schedule, rasterized with
 * resvg (a WebAssembly SVG renderer), and encoded with a shared 256-colour
 * palette. Because raster back-ends do not evaluate CSS custom properties or
 * media queries, each frame is flattened to its concrete theme colours first,
 * so a GIF always paints one fixed theme (light unless `theme: dark`).
 */
export async function renderChartGif(
  input: ChartModelInput,
  options: GifOptions = {},
): Promise<GifResult> {
  const model = normalizeChartModel(input);
  await ensureRuntime();

  const sequence = buildFrameSequence(model, options);
  const background = resolveBackground(model, sequence.theme);
  const targetWidth = clampWidth(options.width ?? model.config.width);
  // Roboto lacks the star glyphs (U+2605/U+2606) used by the header total and
  // logo; the symbol font supplies them so they don't rasterise as tofu.
  const fontBuffers = [fontBuffer, symbolFontBuffer].filter(
    (buffer): buffer is Uint8Array => buffer !== null,
  );

  const rendered = sequence.frames.map((frame) => {
    const flattened = flattenThemeVars(frame.svg, model, sequence.theme);
    const resvg = new Resvg(flattened, {
      background,
      fitTo: { mode: 'width', value: targetWidth },
      font:
        fontBuffers.length > 0
          ? {
              fontBuffers,
              defaultFontFamily: FALLBACK_FONT_FAMILY,
              loadSystemFonts: false,
            }
          : { loadSystemFonts: false },
    });
    const image = resvg.render();
    const pixels = new Uint8Array(image.pixels);
    const result = {
      pixels,
      width: image.width,
      height: image.height,
      delayMs: frame.delayMs,
    };
    image.free();
    resvg.free();
    return result;
  });

  const first = rendered[0];
  if (!first) {
    throw new Error('GIF rendering produced no frames.');
  }
  const { width, height } = first;

  // One global palette derived from the final, fully built frame keeps the
  // colour table stable across the animation and avoids per-frame flicker.
  const paletteSource = rendered[rendered.length - 1] ?? first;
  const palette = quantize(paletteSource.pixels, 256, { format: 'rgb565' });

  const encoder = GIFEncoder();
  rendered.forEach((frame, index) => {
    const indexed = applyPalette(frame.pixels, palette, 'rgb565');
    encoder.writeFrame(indexed, frame.width, frame.height, {
      ...(index === 0
        ? { palette, repeat: sequence.loop ? 0 : -1, first: true }
        : {}),
      delay: frame.delayMs,
    });
  });
  encoder.finish();

  const buffer = encoder.bytes();
  return {
    buffer,
    width,
    height,
    frameCount: rendered.length,
    loop: sequence.loop,
    bytes: buffer.byteLength,
  };
}

/** Resolves the opaque background a GIF frame is composited onto. */
function resolveBackground(model: ChartModel, theme: 'light' | 'dark'): string {
  return model.config.background === 'transparent'
    ? THEME_BACKGROUND[theme]
    : model.config.background;
}

function clampWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return MIN_WIDTH;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

/** Initializes the resvg WebAssembly module and loads the fallback font once. */
async function ensureRuntime(): Promise<void> {
  if (!wasmReady) {
    wasmReady = loadWasm();
  }
  await wasmReady;
}

async function loadWasm(): Promise<void> {
  const wasm = await loadAsset(['resvg.wasm'], () =>
    resolveFromNodeModules('@resvg/resvg-wasm', 'index_bg.wasm'),
  );
  await initWasm(wasm);
  fontBuffer = await loadAsset(
    [
      'roboto.ttf',
      '../assets/fonts/Roboto-Regular.ttf',
      '../../assets/fonts/Roboto-Regular.ttf',
    ],
    () => undefined,
  ).catch(() => null);
  symbolFontBuffer = await loadAsset(
    [
      'symbols.ttf',
      '../assets/fonts/StarChartSymbols-Regular.ttf',
      '../../assets/fonts/StarChartSymbols-Regular.ttf',
    ],
    () => undefined,
  ).catch(() => null);
}

/**
 * Reads a bundled asset by trying paths relative to this module (the committed
 * `dist/` layout at runtime, `src/renderers/` during tests) before an optional
 * node_modules fallback used only in a dev tree.
 */
async function loadAsset(
  relativePaths: readonly string[],
  fallback: () => string | undefined,
): Promise<Uint8Array> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = relativePaths.map((rel) => path.resolve(here, rel));
  const extra = fallback();
  if (extra) {
    candidates.push(extra);
  }
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `Could not locate a required GIF asset (tried: ${candidates.join(', ')}).`,
  );
}

/** Best-effort resolution of a package-relative asset in a dev node_modules. */
function resolveFromNodeModules(pkg: string, file: string): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    // Concatenated so bundlers do not statically inline the asset path.
    return require.resolve(pkg + '/' + file);
  } catch {
    return undefined;
  }
}
