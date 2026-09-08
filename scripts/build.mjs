import { build } from 'esbuild';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
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

console.log('Build complete: dist/index.js, dist/lib.js');
