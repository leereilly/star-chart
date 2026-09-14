import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Emits a small HTML gallery that embeds each generated example SVG as an
// <img>, matching how GitHub renders README charts. Output is ignored by git.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const examples = join(root, 'examples');
const previewDir = join(root, 'preview');
mkdirSync(previewDir, { recursive: true });

const files = readdirSync(examples).filter((f) => f.endsWith('.svg'));
const cards = files
  .map((f) => {
    const isHero = f.includes('animated-once');
    const width = isHero ? 540 : f.startsWith('sparkline') ? 320 : 480;
    return (
      `<figure><figcaption>${f}</figcaption>` +
      `<img src="../examples/${f}" width="${width}" alt="${f}"/></figure>`
    );
  })
  .join('\n');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Star Chart preview</title>
<style>
  body{font-family:sans-serif;margin:24px;background:#fff;color:#111;}
  .grid{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;}
  figure{margin:0;border:1px solid #ddd;border-radius:8px;padding:12px;}
  figcaption{font-size:12px;color:#555;margin-bottom:8px;}
  @media (prefers-color-scheme: dark){body{background:#0d1117;color:#e6edf3;}figure{border-color:#30363d;}}
</style></head>
<body><h1>Star Chart examples</h1>
<p>Toggle your OS light/dark mode to preview auto themes and reduced-motion.</p>
<div class="grid">${cards}</div>
</body></html>`;

writeFileSync(join(previewDir, 'index.html'), html);
console.log(`Wrote preview/index.html with ${files.length} examples.`);
