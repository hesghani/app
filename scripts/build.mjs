// Bundles the app into one self-contained HTML file: `npm run build` → dist/ihsan.html
// Open it straight from disk, email it, or host it anywhere. No dependencies.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const modules = new Map(); // path -> { code, deps }

async function collect(file) {
  if (modules.has(file)) return;
  modules.set(file, null);
  const src = await readFile(join(root, file), 'utf8');
  const deps = [];
  const exportsList = [];
  let code = src.replace(/^import\s+(.+?)\s+from\s+'(.+?)';$/gm, (_, what, from) => {
    const dep = normalize(join(dirname(file), from));
    deps.push(dep);
    const ref = `__mod[${JSON.stringify(dep)}]`;
    if (what.startsWith('* as ')) return `const ${what.slice(5)} = ${ref};`;
    return `const ${what.replace(/\s+as\s+/g, ': ')} = ${ref};`;
  });
  code = code.replace(/^export\s+((?:async\s+)?function\*?|const|let|class)\s+([\w$]+)/gm, (_, kind, name) => {
    exportsList.push(name);
    return `${kind} ${name}`;
  });
  if (/^\s*import\s|^export\s/m.test(code)) throw new Error(`Unsupported import/export syntax in ${file}`);
  modules.set(file, { code, deps, exportsList });
  for (const d of deps) await collect(d);
}

const entry = 'js/app.js';
await collect(entry);

// Dependencies first.
const order = [];
const seen = new Set();
const visit = (f) => {
  if (seen.has(f)) return;
  seen.add(f);
  for (const d of modules.get(f).deps) visit(d);
  order.push(f);
};
visit(entry);

const bundle = [
  'const __mod = {};',
  ...order.map((f) => {
    const { code, exportsList } = modules.get(f);
    return `// ${f}\n__mod[${JSON.stringify(f)}] = (() => {\n${code}\nreturn { ${exportsList.join(', ')} };\n})();`;
  }),
].join('\n\n');

const css = await readFile(join(root, 'css/app.css'), 'utf8');
let html = await readFile(join(root, 'index.html'), 'utf8');
if (bundle.includes('</script')) throw new Error('Bundle contains a closing script tag');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script type="module">\n${bundle}\n</script>`);

await mkdir(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist/ihsan.html');
await writeFile(out, html);
console.log(`Built ${relative(root, out)} (${(html.length / 1024).toFixed(0)} KB, ${order.length} modules)`);
