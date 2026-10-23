import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, mkdir, readFile, readdir, realpath, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, expect} from '@playwright/test';

// An explicit, immutable built snapshot is the only SDK/HTTP oracle source.
// This consumer creates two real fresh runs; it does not import or inject a save.
const required = name => {
  const value = process.env[name];
  assert(value?.trim(), `${name} is required; refusing a mutable-dist fallback.`);
  return value;
};
const snapshot = await realpath(required('V6_UI_SNAPSHOT'));
const url = new URL(required('V6_UI_URL'));
const output = path.resolve(required('V6_UI_OUTPUT'));
assert((await stat(snapshot)).isDirectory(), 'V6_UI_SNAPSHOT must be the frozen preview directory.');
assert(!snapshot.split(path.sep).includes('dist'), 'A mutable dist directory is not a snapshot.');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use the owned local frozen-preview server.');
assert.equal(url.pathname, '/v6.html', 'V6_UI_URL must identify the actual /v6.html entry.');
assert(!output.startsWith(snapshot + path.sep), 'Output must not mutate the snapshot.');
try { await access(output); throw Error(`Refusing to overwrite existing output: ${output}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fingerprint(directory) {
  const rows = [];
  async function walk(relative = '') {
    const entries = await readdir(path.join(directory, relative), {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = path.join(relative, entry.name);
      assert(!entry.isSymbolicLink(), `Snapshot cannot depend on a mutable symlink: ${name}`);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(directory, name));
        rows.push({path: name.split(path.sep).join('/'), bytes: bytes.length, sha256: sha(bytes)});
      }
    }
  }
  await walk();
  return {files: rows, sha256: sha(JSON.stringify(rows))};
}
const beforeFingerprint = await fingerprint(snapshot);
const sdkPath = path.join(snapshot, 'sword-led-v6.js');
const sdkBytes = await readFile(sdkPath);
const api = await import(pathToFileURL(sdkPath).href);
const protocolResponse = await fetch(new URL('/sword-led-v6.js', url));
assert.equal(protocolResponse.status, 200, 'Frozen HTTP SDK must be available.');
assert.equal(sha(Buffer.from(await protocolResponse.arrayBuffer())), sha(sdkBytes), 'HTTP SDK differs from the selected snapshot.');
const scope = {
  task: 'v0.9 / 2.2 main trial and one cache only',
  engine: 'one headless Chromium, DPR 1',
  contexts: 'two fresh contexts, one steady and one fissure',
  seed: 'v6-contract',
  sizes: [{width: 1280, height: 720}, {width: 1920, height: 1080}],
  endpoint: 'echo-forge immediately after obtaining the earned tool',
  authority: 'real mouse inputs; formal frozen SDK predicts accepted events/state; no state/RNG/coin injection',
  motion: 'optional natural-animation screenshot interval, not an extra GUI completion or physical speaker proof',
  excludes: 'echo gameplay, failure branches, keyboard/lifecycle/storage fault matrix, other browser engines, player fun approval',
};
const report = {
  status: 'running', startedAt: new Date().toISOString(), scope,
  identity: {snapshot, url: url.href, sdkSha256: sha(sdkBytes), snapshotFingerprint: beforeFingerprint.sha256,
    scriptSha256: sha(await readFile(new URL(import.meta.url)))},
  routes: [], firstFailure: null,
};
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(output, 'snapshot-before.json'), JSON.stringify(beforeFingerprint, null, 2));
await save();
let browser;
function failure(error) { return {name: error.name, message: error.message, stack: error.stack}; }

async function runRoute(school) {
  const route = {school, status: 'running', startedAt: new Date().toISOString(), commands: [], controls: [],
    images: [], motions: [], pageErrors: [], resourceErrors: [], verifiedResponses: [], step: 'new context'};
  report.routes.push(route); await save();
  const context = await browser.newContext({viewport: scope.sizes[0], deviceScaleFactor: 1, reducedMotion: 'no-preference'});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const responseChecks = [];
  page.on('pageerror', error => route.pageErrors.push(String(error)));
  page.on('requestfailed', request => route.resourceErrors.push({type: 'requestfailed', url: request.url(), error: request.failure()}));
  page.on('response', response => {
    const check = (async () => {
      const address = new URL(response.url());
      if (response.status() >= 400) route.resourceErrors.push({type: 'http', status: response.status(), url: response.url()});
      if (address.origin !== url.origin || response.status() !== 200) return;
      const relative = decodeURIComponent(address.pathname).replace(/^\/+/, '');
      const local = path.resolve(snapshot, relative || 'index.html');
      assert(local.startsWith(snapshot + path.sep), 'HTTP response escaped the snapshot directory.');
      const [served, frozen] = await Promise.all([response.body(), readFile(local)]);
      assert.equal(sha(served), sha(frozen), `Runtime response differs from snapshot: ${address.pathname}`);
      route.verifiedResponses.push({path: address.pathname, bytes: served.length, sha256: sha(served)});
    })().catch(error => route.resourceErrors.push({type: 'snapshot-mismatch', url: response.url(), ...failure(error)}));
    responseChecks.push(check);
  });
  const game = page.locator('.x6-game');
  async function slots() {
    return page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [api.V6_SAVE_KEY, api.V6_BACKUP_KEY]);
  }
  async function state() {
    const values = await slots(), raw = values[api.V6_SAVE_KEY];
    assert(raw, 'The real writer must have written the primary save.');
    const envelope = JSON.parse(raw);
    assert.equal(envelope.schemaVersion, 6); assert.equal(envelope.rulesVersion, 'forge-v6');
    const decoded = api.decodeV6Save(raw);
    assert.equal(decoded.status, 'valid', JSON.stringify(decoded));
    const replay = api.validateRun(decoded.state);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.deepEqual(replay.state, decoded.state, 'Full-journal validation changed a state.');
    return {state: decoded.state, slots: values, savedAt: decoded.savedAt};
  }
  async function idle() {
    await expect(game).toHaveAttribute('data-busy', 'false');
    await expect(page.locator('[data-x6-transient]')).toHaveCount(0);
  }
  async function observation() {
    return page.evaluate(() => {
      const box = element => {
        if (!element) return null;
        const r = element.getBoundingClientRect(), s = getComputedStyle(element);
        return {tag: element.tagName, dataset: {...element.dataset}, rect: {x: r.x, y: r.y, width: r.width, height: r.height},
          visibility: s.visibility, display: s.display, opacity: s.opacity, transform: s.transform};
      };
      return {at: performance.now(), phase: document.querySelector('.x6-game')?.dataset.phase,
        busy: document.querySelector('.x6-game')?.dataset.busy, playing: document.querySelector('#x6-forge-scene')?.dataset.playing,
        wallet: document.querySelector('#x6-coins')?.textContent, primary: box(document.querySelector('#x6-primary')),
        canvas: box(document.querySelector('#x6-blade')), tool: box(document.querySelector('#x6-tool-art')),
        ghost: box(document.querySelector('[data-x6-motion-sword]')),
        clones: [...document.querySelectorAll('[data-x6-transient] > *')].map(box),
        page: {visibility: document.visibilityState, focus: document.hasFocus()}};
    });
  }
  async function screenshot(label) {
    const file = `${school}-${label}.png`;
    await page.screenshot({path: path.join(output, file), animations: 'allow'});
    route.images.push({file, viewport: page.viewportSize(), observation: await observation()});
  }
  async function bothSizes(label) {
    await idle(); const before = await state();
    await screenshot(`${label}-1280`);
    await page.setViewportSize(scope.sizes[1]);
    await expect(page.locator('#x6-blade')).toHaveAttribute('data-art', 'ready');
    await screenshot(`${label}-1920`);
    await page.setViewportSize(scope.sizes[0]);
    await idle(); assert.deepEqual(await slots(), before.slots, 'Viewport changes wrote economic state.');
    assert.deepEqual((await state()).state, before.state);
  }
  async function captureMotion(kind, label) {
    const record = {kind, label, purpose: 'natural contact/clone anchor observation only'};
    route.motions.push(record);
    try {
      await page.waitForFunction(mode => {
        const game = document.querySelector('.x6-game'), scene = document.querySelector('#x6-forge-scene');
        if (game?.dataset.busy !== 'true' || scene?.dataset.playing !== mode || !document.querySelector('[data-x6-motion-sword]')) return false;
        return mode === 'cache' ? game.dataset.phase === 'echo-forge'
          : document.querySelector('#x6-primary')?.dataset.defeated === 'true' && game.dataset.gate === 'true';
      }, kind, {polling: 'raf', timeout: 2000});
      record.before = await observation();
      record.file = `${school}-${label}-natural-motion-1280.png`;
      await page.screenshot({path: path.join(output, record.file), animations: 'allow'});
      record.after = await observation();
      record.windowHeldThroughScreenshot = record.before.busy === 'true' && record.after.busy === 'true' && record.before.playing === kind && record.after.playing === kind;
      assert.equal(record.before.ghost?.dataset.pieceId, 'main-1', 'Motion must belong to the actual main sword.');
      record.status = record.windowHeldThroughScreenshot ? 'captured within active interval' : 'interval ended during screenshot';
    } catch (error) {
      record.status = error.name === 'TimeoutError' ? 'natural interval not captured' : 'observation failed';
      record.error = failure(error);
      if (error.name !== 'TimeoutError') throw error;
    }
  }
  async function command(action, selector, {motion = null, label = action.type} = {}) {
    route.step = label;
    await idle(); const before = await state();
    const expected = api.applyCommand(before.state, {runId: before.state.runId, expectedRevision: before.state.revision, action});
    assert.equal(expected.ok, true, `Declared finite route rejected before mouse input: ${JSON.stringify(expected)}`);
    const entry = {label, selector, action, before: before.state, expected: expected.state, expectedEventsFromFormalSdk: expected.events};
    route.commands.push(entry); await save();
    await page.locator(selector).click();
    if (motion) await captureMotion(motion, label);
    await idle();
    const actual = await state(); entry.actual = actual.state; entry.savedAt = actual.savedAt;
    assert.deepEqual(actual.state, expected.state, 'Mouse action differs from the frozen formal SDK.');
    assert.equal(actual.state.journal.length, before.state.journal.length + 1);
    assert.equal(actual.state.revision, before.state.revision + 1);
    entry.passed = true; await save();
    return actual.state;
  }
  async function unchangedControl(label, operation) {
    route.step = label; await idle(); const before = await slots();
    await operation(); await idle(); const after = await slots();
    assert.deepEqual(after, before, `${label} changed stored state.`);
    const entry = {label, noSaveChanges: true};
    if (after[api.V6_SAVE_KEY]) entry.validatedRevision = (await state()).state.revision;
    route.controls.push(entry);
  }
  try {
    await page.goto(url.href);
    await expect(page.locator('#x6-start')).toBeEnabled();
    await page.waitForLoadState('networkidle');
    assert.deepEqual(await slots(), {[api.V6_SAVE_KEY]: null, [api.V6_BACKUP_KEY]: null}, 'Context is not a fresh route.');
    await unchangedControl('open seed details', () => page.locator('.x6-seed summary').click());
    await unchangedControl('enter fixed declared seed', () => page.locator('#x6-seed').fill(scope.seed));
    route.step = 'start fresh real UI run';
    await page.locator('#x6-start').click(); await idle();
    await expect(page.locator('#x6-play')).toBeVisible();
    await expect(page.locator('#x6-blade')).toHaveAttribute('data-art', 'ready');
    const started = await state();
    const created = api.createRun({runId: started.state.runId, seed: scope.seed});
    assert.equal(created.ok, true); assert.deepEqual(started.state, created.state);
    route.start = {actual: started.state, formalFreshStateEqual: true};
    await command({type: 'chooseSchool', pieceId: 'main-1', school}, `[data-school="${school}"]`);
    for (let hit = 1; hit <= 4; hit++) {
      await command({type: 'forge', pieceId: 'main-1', useTechnique: false}, '#x6-hit', {label: `ordinary-${hit}`});
    }
    await unchangedControl('arm one technique without economic command', () => page.locator('#x6-technique').click());
    await expect(game).toHaveAttribute('data-armed', 'true');
    const forged = await command({type: 'forge', pieceId: 'main-1', useTechnique: true}, '#x6-hit', {label: 'technique-5'});
    assert.equal(forged.charges.main, 0);
    assert.equal(forged.blades.find(blade => blade.id === 'main-1').strength, school === 'steady' ? 5 : 7);
    await command({type: 'seal', pieceId: 'main-1'}, '#x6-seal');
    await expect(game).toHaveAttribute('data-phase', 'main-trial');
    await bothSizes('trial');
    const initialView = api.getRunView((await state()).state);
    const previewText = value => `点此出剑 · 可打${value.damage}${value.wear ? `，剑磨损${value.wear}` : ''}`;
    await expect(page.locator('#x6-primary-preview')).toHaveText(previewText(initialView.strike.preview));
    if (school === 'steady') {
      await command({type: 'guard'}, '#x6-guard');
      await expect(page.locator('#x6-primary')).toHaveAttribute('data-opening', 'true');
      await screenshot('formal-opening-1280');
      const openingView = api.getRunView((await state()).state);
      await expect(page.locator('#x6-primary-preview')).toHaveText(previewText(openingView.strike.preview));
    }
    const gate = await command({type: 'strike', targetId: 'main-guard'}, '#x6-primary', {motion: 'strike', label: 'gate-contact'});
    assert.equal(gate.phase, 'cache'); assert.equal(gate.coins, 15); assert.equal(gate.gatePaid, true);
    await expect(game).toHaveAttribute('data-phase', 'cache');
    await expect(page.locator('#x6-primary')).toHaveAttribute('data-defeated', 'true');
    await expect(page.locator('#x6-coins')).toHaveText('15');
    await expect(page.locator('#x6-guard')).toBeHidden();
    await bothSizes('defeated-and-cache');
    const target = school === 'steady' ? 'rope' : 'latch';
    const earned = await command({type: 'takeCache', target}, `#x6-${target}`, {motion: 'cache', label: 'earned-cache-contact'});
    assert.equal(earned.phase, 'echo-forge'); assert.equal(earned.coins, 15);
    assert.equal(earned.tool, school === 'steady' ? 'rebound' : 'furnace');
    await expect(game).toHaveAttribute('data-phase', 'echo-forge');
    await expect(page.locator('#x6-tool')).toBeVisible();
    await expect(page.locator('#x6-blade')).toHaveAttribute('data-piece-id', 'echo-1');
    await screenshot('earned-tool-echo-forge-1280');
    route.final = earned;
    await page.waitForLoadState('networkidle'); await Promise.all(responseChecks);
    assert.deepEqual(route.pageErrors, [], 'Page errors occurred.');
    assert.deepEqual(route.resourceErrors, [], 'Resources failed or differed from the selected snapshot.');
    assert(route.verifiedResponses.some(response => response.path === '/v6.html'), 'Actual page entry was not snapshot-verified.');
    route.status = 'passed';
  } catch (error) {
    route.status = 'failed'; route.failure = {...failure(error), step: route.step};
    if (!report.firstFailure) report.firstFailure = {school, ...route.failure};
    try { route.failureObservation = await observation(); } catch (capture) { route.failureObservation = {error: String(capture)}; }
    try { route.failureSlots = await slots(); } catch (capture) { route.failureSlots = {error: String(capture)}; }
    try { await screenshot('FIRST-FAILURE'); } catch (capture) { route.failureScreenshotError = String(capture); }
  } finally {
    await Promise.allSettled(responseChecks);
    route.finishedAt = new Date().toISOString(); await save();
    await context.close();
  }
}
try {
  browser = await chromium.launch({headless: true, args: ['--no-proxy-server']});
  report.identity.browserVersion = browser.version();
  for (const school of ['steady', 'fissure']) {
    await runRoute(school);
    if (report.firstFailure) break;
  }
} catch (error) {
  report.infrastructureFailure = failure(error);
  if (!report.firstFailure) report.firstFailure = {school: null, ...report.infrastructureFailure};
} finally {
  if (browser) await browser.close();
  const afterFingerprint = await fingerprint(snapshot);
  await writeFile(path.join(output, 'snapshot-after.json'), JSON.stringify(afterFingerprint, null, 2));
  report.identity.snapshotAfterFingerprint = afterFingerprint.sha256;
  report.identity.snapshotUnchanged = afterFingerprint.sha256 === beforeFingerprint.sha256;
  if (!report.identity.snapshotUnchanged && !report.firstFailure) report.firstFailure = {message: 'Frozen snapshot changed during this run.'};
  report.status = report.routes.length === 2 && report.routes.every(route => route.status === 'passed') && !report.firstFailure ? 'passed' : 'failed';
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({status: report.status, output, routes: report.routes.map(route => ({school: route.school, status: route.status, commands: route.commands.length})), firstFailure: report.firstFailure}));
  if (report.status !== 'passed') process.exitCode = 1;
}
