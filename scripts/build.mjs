import { build } from 'esbuild';
import { rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// esbuild is used as the bundler (a maintained, fast equivalent to @vercel/ncc)
// to produce a self-contained ESM bundle that Node 24 runs directly.
const common = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  legalComments: 'none',
  minify: false,
  // Reproducible: no build-time timestamps injected.
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: "import { createRequire as __sc_cr } from 'node:module';const require=__sc_cr(import.meta.url);",
  },
};

await build({
  ...common,
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(dist, 'index.js'),
});

await build({
  ...common,
  entryPoints: [join(root, 'src/lib.ts')],
  outfile: join(dist, 'lib.js'),
  banner: {},
});

// Emit type declarations for the programmatic API.
execFileSync(
  'npx',
  ['tsc', '-p', 'tsconfig.build.json', '--outDir', 'dist-types'],
  { cwd: root, stdio: 'inherit' },
);

// Copy the lib declaration into dist as the published types entry.
const { cpSync } = await import('node:fs');
cpSync(join(root, 'dist-types'), dist, { recursive: true });

// Copy the raster runtime assets the GIF encoder needs at action runtime.
// The published action runs the bundled `dist/` with no node_modules, so the
// resvg WebAssembly binary and the fallback font must live alongside it.
const { cpSync: cpAsset, appendFileSync } = await import('node:fs');
cpAsset(
  join(root, 'node_modules/@resvg/resvg-wasm/index_bg.wasm'),
  join(dist, 'resvg.wasm'),
);
cpAsset(
  join(root, 'assets/fonts/Roboto-Regular.ttf'),
  join(dist, 'roboto.ttf'),
);
cpAsset(
  join(root, 'assets/fonts/StarChartSymbols-Regular.ttf'),
  join(dist, 'symbols.ttf'),
);

// Third-party license notices for bundled dependencies.
try {
  const notices = execFileSync('node', [join(root, 'scripts/licenses.mjs')], {
    cwd: root,
  }).toString();
  writeFileSync(join(dist, 'licenses.txt'), notices);
} catch {
  writeFileSync(
    join(dist, 'licenses.txt'),
    'See package.json for dependencies.\n',
  );
}

// Append the bundled font's license so the raster asset is covered too.
try {
  const fontLicense = readFileSync(
    join(root, 'assets/fonts/LICENSE-Roboto.txt'),
    'utf8',
  ).trim();
  appendFileSync(
    join(dist, 'licenses.txt'),
    '\n\n' +
      '======================================================================\n' +
      'Roboto (bundled as dist/roboto.ttf) (Apache-2.0)\n' +
      '======================================================================\n' +
      fontLicense +
      '\n',
  );
  const symbolLicense = readFileSync(
    join(root, 'assets/fonts/LICENSE-StarChartSymbols.txt'),
    'utf8',
  ).trim();
  appendFileSync(
    join(dist, 'licenses.txt'),
    '\n\n' +
      '======================================================================\n' +
      'StarChartSymbols (bundled as dist/symbols.ttf) (CC0-1.0)\n' +
      '======================================================================\n' +
      symbolLicense +
      '\n',
  );
} catch {
  // Non-fatal: the font license is best-effort supplementary information.
}

console.log('Build complete: dist/index.js, dist/lib.js');
