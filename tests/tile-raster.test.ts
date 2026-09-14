import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import {
  buildChartModel,
  buildFrameSequence,
  contribGeometry,
} from '../src/lib.js';
import { flattenThemeVars } from '../src/renderers/shared.js';
import {
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
} from './helpers/index.js';

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  await initWasm(
    readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
  );
});

describe('contribution tile rasterization', () => {
  it.each([
    { style: 'contributions', width: 900, rasterWidth: 720, axis: 10 },
    { style: 'contributions', width: 1800, rasterWidth: 1080, axis: 20 },
    { style: 'grid', width: 1800, rasterWidth: 1080, axis: 20 },
  ])(
    'preserves white gutters and rounded squares in $style at $rasterWidth px',
    ({ style, width, rasterWidth, axis }) => {
      const model = buildChartModel(
        makeConfig({
          style,
          width: String(width),
          axis_font_size: String(axis),
          show_title: 'false',
          show_total: 'false',
          show_change: 'false',
          weeks: '52',
        }),
        makeMetadata(),
        historyFromAdds(Array.from({ length: 52 }, () => 1)),
        { asOf: FIXED_NOW },
      );
      const geo = contribGeometry(model);
      const svg = buildFrameSequence(model).frames[0]!.svg;
      const renderer = new Resvg(flattenThemeVars(svg, model, 'light'), {
        background: '#ffffff',
        fitTo: { mode: 'width', value: rasterWidth },
        font: { loadSystemFonts: false },
      });
      const image = renderer.render();
      try {
        const pixels = image.pixels;
        const scale = rasterWidth / width;
        const rgb = (x: number, y: number): number[] => {
          const offset =
            (Math.floor(y * scale) * image.width + Math.floor(x * scale)) * 4;
          return Array.from(pixels.slice(offset, offset + 3));
        };
        // Locate a real empty tile in the emitted SVG, not a geometry-only proxy.
        const tile =
          style === 'contributions'
            ? svg.match(/<pattern[^>]* x="([^"]+)" y="([^"]+)"/)
            : svg.match(/<rect class="sc-empty" x="([^"]+)" y="([^"]+)"/);
        expect(tile).not.toBeNull();
        const x = Number(tile![1]);
        const y = Number(tile![2]);
        expect(rgb(x + geo.cell / 2, y + geo.cell / 2)).toEqual([
          240, 242, 245,
        ]);
        expect(rgb(x + geo.cell + geo.gap / 2, y + geo.cell / 2)).toEqual([
          255, 255, 255,
        ]);
        expect(rgb(x + geo.cell / 2, y + geo.cell + geo.gap / 2)).toEqual([
          255, 255, 255,
        ]);
        const corner = rgb(
          x + geo.pitch,
          y + (style === 'grid' ? -geo.pitch : geo.pitch),
        );
        expect(corner.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(
          740,
        );
        expect(geo.gap * scale).toBeGreaterThanOrEqual(3);
        if (style === 'contributions') {
          for (let column = 1; column < 40; column += 1) {
            expect(
              rgb(x + column * geo.pitch + geo.cell / 2, y + geo.cell / 2),
            ).toEqual([240, 242, 245]);
          }
          const bottomY = y + (geo.rows - 1) * geo.pitch + geo.cell / 2;
          for (let column = 10; column < geo.cols; column += 1) {
            for (const fraction of [0.2, 0.4, 0.6, 0.8]) {
              expect(
                rgb(x + column * geo.pitch + fraction * geo.cell, bottomY),
              ).toEqual([191, 236, 191]);
            }
          }
        }
      } finally {
        image.free();
        renderer.free();
      }
    },
  );
});
