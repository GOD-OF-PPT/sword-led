import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetSource = await readFile(resolve(root, 'src/v8/assets.ts'), 'utf8');
const assetObject = assetSource.slice(assetSource.indexOf('{'), assetSource.lastIndexOf('}') + 1);
const assets = JSON.parse(assetObject.replace(/,\s*}/g, '}'));
for (const [key, path] of Object.entries(assets)) {
  if (!/^\.\/assets\/v8\/[a-z0-9_]+\.webp$/.test(path)) throw Error(`Unexpected standalone asset: ${path}`);
  assets[key] = 'data:image/webp;base64,' + (await readFile(resolve(root, 'public', path))).toString('base64');
}
const entry = 'virtual:v8-standalone';
const result = await build({
  root, configFile: false, logLevel: 'warn',
  plugins: [{
    name: 'v8-standalone-entry',
    resolveId(id) { if (id === entry || id === resolve(root, entry)) return '\0' + entry; },
    load(id) {
      if (id !== '\0' + entry) return;
      return `import {mountV8App} from ${JSON.stringify(resolve(root, 'src/v8/v8-app.mjs'))};
const root = document.getElementById('app');
if (!root) throw Error('Missing v8 entry');
mountV8App(root, ${JSON.stringify(assets)}, {showClassicLink:false});`;
    },
  }],
  build: {
    write: false, minify: false, target: 'es2022', copyPublicDir: false,
    lib: { entry, formats: ['iife'], name: 'V8Standalone' },
  },
});
const output = Array.isArray(result) ? result.flatMap(r => r.output) : result.output;
const chunks = output.filter(file => file.type === 'chunk');
if (chunks.length !== 1 || chunks[0].imports.length) throw Error('Standalone must contain one self-contained script');
const css = (await readFile(resolve(root, 'src/v8/styles.css'), 'utf8')).replace(/<\/style/gi, '<\\/style');
const js = chunks[0].code.replace(/<\/script/gi, '<\\/script');
const licenses = await readFile(resolve(root, 'public/third-party-licenses.txt'), 'utf8');
if (licenses.includes('-->')) throw Error('License notice cannot terminate an HTML comment');
const entryHtml = await readFile(resolve(root, 'index.html'), 'utf8');
const title = entryHtml.match(/<title>([^<]+)<\/title>/i)?.[1];
if (!title) throw Error('Missing current game title');
const html = `<!DOCTYPE html>
<!-- Third-party licenses\n${licenses}-->
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body><div id="app"></div><noscript>请启用JavaScript后推起炉车。</noscript>
  <script>${js}</script>
</body>
</html>
`;
const target = resolve(root, 'public/playable-v8.html');
await writeFile(target, html);
console.log(JSON.stringify({file: 'public/playable-v8.html', bytes: Buffer.byteLength(html), embeddedAssets: Object.keys(assets).length}));
