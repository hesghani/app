// Bundles the extension into dist/. `--watch` rebuilds on change.
import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'none',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  tsconfig: join(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};

const configs = [
  // The service worker is declared with "type": "module" in the manifest.
  { ...shared, entryPoints: { background: 'src/background/index.ts' }, format: 'esm', outdir: dist },
  {
    ...shared,
    format: 'iife',
    outdir: dist,
    entryPoints: {
      'content-amazon': 'src/content/amazon/index.tsx',
      'content-merch': 'src/content/merch/index.tsx',
      'content-merch-main': 'src/content/merch/main-world.ts',
      popup: 'src/popup/index.tsx',
      dashboard: 'src/dashboard/index.tsx',
      offscreen: 'src/offscreen/index.ts',
      app: 'src/ui/app.css',
    },
  },
];

async function copyStatic() {
  await mkdir(dist, { recursive: true });
  await cp(join(root, 'public'), dist, { recursive: true });
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(root, 'public/manifest.json'), 'utf8'));
  manifest.version = pkg.version;
  await writeFile(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

await rm(dist, { recursive: true, force: true });
await copyStatic();

if (watch) {
  for (const config of configs) await (await context(config)).watch();
  console.log('Watching for changes. Reload the extension in chrome://extensions after edits.');
} else {
  await Promise.all(configs.map((config) => build(config)));
  console.log(`Built to ${dist}`);
}
