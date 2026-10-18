import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const argv = process.argv.slice(2);
if (argv.length && (argv.length !== 2 || argv[0] !== '--out')) throw new Error('Use --out <artifact-directory>');
const out = resolve(root, argv[1] ?? 'tmp/art-verification');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFile(resolve(root, path));
const manifest = JSON.parse(await read('public/assets/b/manifest.json'));
const provenance = JSON.parse(await read('design/b/manifest.json'));
assert.equal(manifest.assets.length, 9);
assert.equal(manifest.assets.flatMap(asset => asset.frames ?? []).length, 24);
assert.ok(provenance.totalRuntimeImageBytes <= 3 * 1024 * 1024);
const routes = new Map();
const include = async (url, file) => routes.set(url, await read(file));
for (const file of ['index.html', 'preview.css', 'preview.js', 'scene.js']) await include(`/design/b/preview/${file}`, `design/b/preview/${file}`);
for (const file of ['manifest.json', 'tokens.css']) {
  const source = await read(`public/assets/b/${file}`), built = await read(`dist/assets/b/${file}`);
  assert.equal(hash(source), hash(built));routes.set(`/assets/b/${file}`, built);
}
for (const asset of manifest.assets) {
  const bytes = await read(`dist${asset.src}`);
  assert.equal(bytes.length, asset.bytes);assert.equal(hash(bytes), asset.sha256);
  routes.set(asset.src, bytes);
}
for (const image of provenance.images) {
  const bytes = await read(image.path);
  assert.equal(hash(bytes), image.sha256);assert.equal(hash(await read(image.prompt)), image.promptSha256);
  routes.set(`/${image.path}`, bytes);
}
assert.equal(hash(await read(provenance.reference)), provenance.referenceSha256);
const server = createServer((request, response) => {
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const bytes = routes.get(path);
  if (!bytes) { response.writeHead(404).end(); return; }
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' }[extname(path)];
  response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });response.end(bytes);
});
server.listen(0, '127.0.0.1');await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failedResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto(`${origin}/design/b/preview/index.html`);
  await page.waitForFunction(() => Boolean(window.artPreview));
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const textContrast = await page.evaluate(() => {
    const luminance = color => {
      const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255)
        .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
    };
    return [...document.querySelectorAll('#controls h2,#controls label,#controls .small,#play,#controls select,.color code,.feedback-tile figcaption,.timing-band,.timing-risk,.button-sample,.shop-state')].map(element => {
      let ancestor = element, background = 'rgb(52,41,31)';
      while (ancestor) {
        const candidate = getComputedStyle(ancestor).backgroundColor;
        if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') { background = candidate; break; }
        ancestor = ancestor.parentElement;
      }
      const foreground = getComputedStyle(element).color;
      const a = luminance(foreground), b = luminance(background);
      return { text: element.textContent.trim().slice(0, 30), foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  assert.ok(textContrast.length >= 10);
  assert.ok(textContrast.every(check => check.ratio >= 4.5), `Unreadable rendered labels: ${JSON.stringify(textContrast.filter(check => check.ratio < 4.5))}`);
  const controlTargets = await page.locator('#controls select,#play,#controls .check,#controls input[type=range]').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();return { name: element.getAttribute('name') ?? element.id ?? 'checkbox-label', width: rect.width, height: rect.height };
  }));
  assert.ok(controlTargets.every(target => target.width >= 40 && target.height >= 40), 'Art preview controls must have 40px targets');
  const alphaChecks = await page.evaluate(async manifest => {
    const checks = [];
    async function pixels(url) {
      const image = new Image();image.src = url;await image.decode();
      const canvas = document.createElement('canvas');canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');ctx.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    }
    for (const asset of manifest.assets) {
      const original = await pixels(`/design/b/originals/${asset.name}.png`), encoded = await pixels(asset.src);
      if (original.width !== encoded.width || original.height !== encoded.height) throw new Error(`Dimensions changed: ${asset.id}`);
      let alphaDifferent = 0, transparent = 0, colorError = 0, opaque = 0;
      for (let offset = 0; offset < original.data.length; offset += 4) {
        if (original.data[offset + 3] !== encoded.data[offset + 3]) alphaDifferent++;
        if (encoded.data[offset + 3] === 0) transparent++;
        if (original.data[offset + 3] >= 250) {
          opaque++;
          for (let channel = 0; channel < 3; channel++) colorError += Math.abs(original.data[offset + channel] - encoded.data[offset + channel]);
        }
      }
      if (alphaDifferent) throw new Error(`Alpha changed: ${asset.id}/${alphaDifferent}`);
      if (asset.kind !== 'background' && transparent / (encoded.width * encoded.height) < .25) throw new Error(`Missing alpha: ${asset.id}`);
      const meanColorError = colorError / Math.max(1, opaque * 3);
      if (meanColorError > 12) throw new Error(`Excessive compression error: ${asset.id}`);
      checks.push({ id: asset.id, width: encoded.width, height: encoded.height, alphaDifferent, transparentFraction: transparent / (encoded.width * encoded.height), meanOpaqueRGBError: meanColorError });
    }
    return checks;
  }, manifest);
  const geometry = await page.evaluate(() => {
    let combinations = 0;const worst = { left: Infinity, top: Infinity, rightMargin: Infinity, bottomMargin: Infinity };
    for (const material of ['iron', 'steel', 'meteorite']) for (let tier = 0; tier < 8; tier++) {
      for (const hammer of ['light', 'standard', 'heavy']) for (const [pose, angle] of [['ready', undefined], ['contact', 0], ['recoil', -.025], ['return', window.artPreview.art.manifest.stage.idleAngle / 2]]) {
        const result = window.artPreview.paint({ material, tier, hammer, pose, angle, heat: 40, integrity: 1, level: 2 });
        const bounds = result.hammerBounds;
        if (bounds.x < 0 || bounds.y < 0 || bounds.right > result.stage.width || bounds.bottom > result.stage.height) {
          throw new Error(`Hammer clipped: ${material}/${tier}/${hammer}/${pose}: ${JSON.stringify(bounds)}`);
        }
        worst.left = Math.min(worst.left, bounds.x);worst.top = Math.min(worst.top, bounds.y);
        worst.rightMargin = Math.min(worst.rightMargin, result.stage.width - bounds.right);
        worst.bottomMargin = Math.min(worst.bottomMargin, result.stage.height - bounds.bottom);
        combinations++;
      }
    }
    window.artPreview.draw();return { combinations, minimumMargins: worst };
  });
  assert.equal(geometry.combinations, 288);
  assert.equal(await page.locator('#atlas canvas').count(), 24);
  assert.equal(await page.locator('#states canvas').count(), 8);
  assert.equal(await page.locator('.feedback-tile').count(), 9);
  await mkdir(out, { recursive: true });
  const viewports = [];
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    const metrics = await page.evaluate(() => ({ horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      canvasWidth: document.querySelector('#scene').width, canvasHeight: document.querySelector('#scene').height }));
    assert.equal(metrics.horizontalOverflow, false);
    await page.locator('.assembly').screenshot({ path: `${out}/assembly-${viewport.width}.png` });
    viewports.push({ ...viewport, ...metrics });
  }
  await page.locator('select[name=material]').selectOption('meteorite');
  await page.locator('select[name=tier]').selectOption('7');
  await page.locator('input[name=heat]').fill('100');
  await page.locator('select[name=integrity]').selectOption('1');
  await page.locator('select[name=hammer]').selectOption('heavy');
  await page.locator('select[name=level]').selectOption('2');
  await page.locator('select[name=pose]').selectOption('contact');
  await page.locator('select[name=feedback]').selectOption('damage');
  await page.locator('.stage').screenshot({ path: `${out}/critical-hot-impact.png` });
  await page.locator('#states').screenshot({ path: `${out}/state-layers.png` });
  await page.locator('#feedback-board').screenshot({ path: `${out}/feedback-components.png` });
  await page.locator('#atlas').screenshot({ path: `${out}/material-matrix.png` });
  await page.locator('.kit').screenshot({ path: `${out}/merchant-alpha.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#play').click();
  await page.evaluate(() => { const form = document.querySelector('#controls');form.elements.material.value = 'iron';form.elements.material.dispatchEvent(new Event('input', {bubbles:true})); });
  await page.waitForFunction(() => document.querySelector('select[name=integrity]').value === '4');
  assert.deepEqual(errors, []);assert.deepEqual(failedResponses, []);
  const report = { recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`, browser: browser.version(), source: 'dist/assets/b with unbundled design-only preview',
    runtimeImages: manifest.assets.length, runtimeImageBytes: provenance.totalRuntimeImageBytes, alphaChecks, textContrast, controlTargets, geometry,
    materialFrames: 24, stateSwatches: 8, feedbackSymbols: 9, viewports, pageErrors: errors, failedResponses,
    sourceManifestSha256: hash(await read('design/b/manifest.json')), runtimeManifestSha256: hash(await read('dist/assets/b/manifest.json')),
    previewAndToolHashes: Object.fromEntries(await Promise.all(['design/b/preview/index.html', 'design/b/preview/preview.css', 'design/b/preview/preview.js', 'design/b/preview/scene.js', 'design/b/layout.json', 'scripts/art/prepare.py', 'scripts/art/verify.mjs'].map(async file => [file, hash(await read(file))]))),
    screenshotHashes: Object.fromEntries(await Promise.all(['assembly-1280.png', 'assembly-1920.png', 'critical-hot-impact.png', 'state-layers.png', 'feedback-components.png', 'material-matrix.png', 'merchant-alpha.png'].map(async file => [file, hash(await readFile(`${out}/${file}`))]))) };
  await writeFile(`${out}/browser-art.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, runtimeImages: 9, materialFrames: 24, geometryCombinations: geometry.combinations, alphaMatches: alphaChecks.every(check => check.alphaDifferent === 0), out }));
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolveClose => server.close(resolveClose));
}
