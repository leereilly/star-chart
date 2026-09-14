import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {});
const modulesDir = join(root, 'node_modules');

const collected = new Set();
const out = [];

function collect(name) {
  if (collected.has(name)) return;
  collected.add(name);
  const dir = join(modulesDir, name);
  if (!existsSync(dir)) return;
  let meta;
  try {
    meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const licenseFile = ['LICENSE', 'LICENSE.md', 'license', 'LICENSE.txt'].find(
    (f) => existsSync(join(dir, f)),
  );
  const text = licenseFile
    ? readFileSync(join(dir, licenseFile), 'utf8').trim()
    : `License: ${meta.license ?? 'see package'}`;
  out.push(
    `======================================================================\n` +
      `${meta.name}@${meta.version} (${meta.license ?? 'unknown'})\n` +
      `======================================================================\n${text}\n`,
  );
  for (const dep of Object.keys(meta.dependencies ?? {})) {
    collect(dep);
  }
}

for (const dep of deps) collect(dep);

process.stdout.write(
  'Star Chart bundles the following third-party packages.\n\n' +
    out.sort().join('\n'),
);
