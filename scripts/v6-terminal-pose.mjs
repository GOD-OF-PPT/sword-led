import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, expect} from '@playwright/test';

const required = name => {assert(process.env[name]?.trim(), name + ' is required'); return process.env[name];};
const snapshot = await realpath(required('V6_UI_SNAPSHOT')), url = new URL(required('V6_UI_URL'));
const output = path.resolve(required('V6_UI_OUTPUT'));
assert(!snapshot.split(path.sep).includes('dist')); assert.equal(url.pathname, '/v6.html');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
assert(!output.startsWith(snapshot + path.sep));
await mkdir(output); // Existing output is an error, never an overwrite.
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const stateHash = value => sha(JSON.stringify(canonical(value)));
async function fingerprint() {
  const files = [];
  async function walk(relative = '') {
    const entries = await readdir(path.join(snapshot, relative), {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = path.join(relative, entry.name); assert(!entry.isSymbolicLink());
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {const bytes = await readFile(path.join(snapshot, name)); files.push({path: name, bytes: bytes.length, sha256: sha(bytes)});}
    }
  }
  await walk(); return {files, sha256: sha(JSON.stringify(files))};
}
const beforeFingerprint = await fingerprint(), sdkPath = path.join(snapshot, 'sword-led-v6.js');
const sdkBytes = await readFile(sdkPath), api = await import(pathToFileURL(sdkPath).href);
const httpSdk = await fetch(new URL('/sword-led-v6.js', url)); assert.equal(httpSdk.status, 200);
assert.equal(sha(Buffer.from(await httpSdk.arrayBuffer())), sha(sdkBytes));
const sourcePath = path.resolve('tmp/v09-tools-check/tool-routes-03/result.json');
const sourceBytes = await readFile(sourcePath), source = JSON.parse(sourceBytes.toString('utf8'));
assert.equal(source.status, 'passed'); assert.equal(source.identity.sdkSha256, sha(sdkBytes));
const route = source.routes.find(route => route.school === 'steady'); assert.equal(route.status, 'passed');
const before = route.commands.find(command => command.actual?.revision === 18)?.actual;
assert(before); assert.equal(before.phase, 'echo-trial'); assert.equal(before.trial.storedOverkill, 4);
assert.equal(before.trial.primary.health, 0); assert.equal(before.trial.secondary.health, 4);
assert.equal(api.validateRun(before).ok, true);
const expected = api.applyCommand(before, {runId: before.runId, expectedRevision: before.revision, action: {type: 'followUp', targetId: 'echo-secondary'}});
assert.equal(expected.ok, true); assert.deepEqual(expected.state, route.final);
// Only a complete, recorded Accepted prefix is restored. The official save
// repository wraps it without editing any domain field, journal or random data.
const restored = new Map(), store = {getItem: key => restored.get(key) ?? null, setItem: (key, value) => restored.set(key, value)};
const repository = api.createV6SaveRepository(() => store); repository.load();
assert.equal(repository.write(before).ok, true);
const restoredRaw = store.getItem(api.V6_SAVE_KEY);
assert.deepEqual(api.decodeV6Save(restoredRaw).state, before);
const report = {status: 'running', startedAt: new Date().toISOString(), step: 'restore recorded prefix',
  scope: 'ONE explicit save-restoration boundary from tool03 actual steady revision18, then ONE real followUp; this is not a fresh run or another full route.',
  identity: {snapshot, url: url.href, sdkSha256: sha(sdkBytes), scriptSha256: sha(await readFile(new URL(import.meta.url))),
    snapshotFingerprint: beforeFingerprint.sha256, sourcePath, sourceSha256: sha(sourceBytes), sourceStateSha256: stateHash(before)},
  before, expected: expected.state, expectedEventsFromFormalSdk: expected.events, pageErrors: [], resourceErrors: []};
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(output, 'snapshot-before.json'), JSON.stringify(beforeFingerprint, null, 2)); await save();
let browser, context, page;
const fail = error => ({name: error.name, message: error.message, stack: error.stack});
try {
  browser = await chromium.launch({headless: true, args: ['--no-proxy-server']}); report.identity.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, reducedMotion: 'no-preference'});
  await context.addInitScript(({origin, key, raw}) => {
    if (location.origin === origin) localStorage.setItem(key, raw);
  }, {origin: url.origin, key: api.V6_SAVE_KEY, raw: restoredRaw});
  page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(String(error)));
  page.on('response', response => {if (response.status() >= 400) report.resourceErrors.push({status: response.status(), url: response.url()});});
  page.on('requestfailed', request => report.resourceErrors.push({url: request.url(), error: request.failure()}));
  const game = page.locator('.x6-game');
  async function state() {
    const raw = await page.evaluate(key => localStorage.getItem(key), api.V6_SAVE_KEY);
    const decoded = api.decodeV6Save(raw); assert.equal(decoded.status, 'valid');
    const replay = api.validateRun(decoded.state); assert.equal(replay.ok, true); assert.deepEqual(replay.state, decoded.state); return decoded.state;
  }
  const pose = () => page.evaluate(() => {
    const game = document.querySelector('.x6-game'), art = document.querySelector('#x6-guard-art');
    return {at: performance.now(), phase: game.dataset.phase, screen: game.dataset.screen, busy: game.dataset.busy,
      ending: game.dataset.ending, playing: document.querySelector('#x6-forge-scene').dataset.playing,
      playVisible: !document.querySelector('#x6-play').hidden,
      guard: {transform: art.style.transform, opacity: art.style.opacity, visibility: art.style.visibility},
      transientCount: document.querySelectorAll('[data-x6-transient]').length};
  });
  await page.goto(url.href); await expect(page.locator('#x6-continue')).toBeEnabled(); await page.waitForLoadState('networkidle');
  assert.deepEqual(await state(), before);
  await page.locator('#x6-continue').click(); await expect(game).toHaveAttribute('data-busy', 'false');
  await expect(game).toHaveAttribute('data-phase', 'echo-trial'); await expect(page.locator('[data-x6-transient]')).toHaveCount(0);
  assert.deepEqual(await state(), before); report.restoredPose = await pose();
  assert.match(report.restoredPose.guard.transform, /rotate\(68deg\)/); assert.equal(Number(report.restoredPose.guard.opacity), .38);
  report.step = 'one actual manual follow-up'; await save();
  await page.locator('#x6-secondary').click();
  const sample = await page.waitForFunction(() => {
    const game = document.querySelector('.x6-game'), art = document.querySelector('#x6-guard-art');
    const scene = document.querySelector('#x6-forge-scene'), play = document.querySelector('#x6-play');
    if (game.dataset.busy !== 'true' || game.dataset.ending !== 'true' || scene.dataset.playing !== 'followUp' || play.hidden) return false;
    if (!art.style.transform.includes('rotate(68deg)') || Number(art.style.opacity) !== .38) return false;
    return {at: performance.now(), phase: game.dataset.phase, screen: game.dataset.screen, busy: game.dataset.busy,
      ending: game.dataset.ending, playing: scene.dataset.playing, playVisible: !play.hidden,
      guard: {transform: art.style.transform, opacity: art.style.opacity, visibility: art.style.visibility},
      ghost: {...document.querySelector('[data-x6-motion-sword]')?.dataset}};
  }, null, {polling: 'raf', timeout: 3000});
  report.contact = await sample.jsonValue(); await sample.dispose();
  assert.equal(report.contact.ghost.pieceId, 'echo-1');
  await page.screenshot({path: path.join(output, 'restored-follow-up-terminal-fallen-1280.png'), animations: 'allow'});
  report.afterContactScreenshot = await pose();
  await expect(game).toHaveAttribute('data-busy', 'false'); await expect(game).toHaveAttribute('data-screen', 'recap');
  for (const selector of ['[data-x6-transient]', '[data-x6-energy]', '[data-x6-tool-event]', '[data-x6-charge-target]']) await expect(page.locator(selector)).toHaveCount(0);
  const actual = await state(); assert.deepEqual(actual, expected.state); assert.deepEqual(actual, route.final);
  assert.equal(actual.revision, 19); assert.equal(actual.journal.length, before.journal.length + 1);
  assert.equal(actual.coins, 15); assert.equal(actual.tool, 'rebound');
  report.actual = actual; report.actualStateSha256 = stateHash(actual); report.finalPose = await pose();
  assert.match(report.finalPose.guard.transform, /rotate\(68deg\)/); assert.equal(Number(report.finalPose.guard.opacity), .38);
  await page.waitForLoadState('networkidle'); assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.resourceErrors, []);
  report.actualCommands = 1; report.cleanupPassed = true; report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.firstFailure = {...fail(error), step: report.step};
  if (page) {
    try {report.failureDom = await page.locator('.x6-game').evaluate(element => ({dataset: {...element.dataset}, text: element.textContent}));} catch {}
    try {await page.screenshot({path: path.join(output, 'FIRST-FAILURE.png'), animations: 'allow'});} catch {}
  }
} finally {
  await save(); if (context) await context.close(); if (browser) await browser.close();
  const afterFingerprint = await fingerprint(); await writeFile(path.join(output, 'snapshot-after.json'), JSON.stringify(afterFingerprint, null, 2));
  report.identity.snapshotAfterFingerprint = afterFingerprint.sha256; report.identity.snapshotUnchanged = beforeFingerprint.sha256 === afterFingerprint.sha256;
  if (!report.identity.snapshotUnchanged) {report.status = 'failed'; report.firstFailure ??= {message: 'Frozen snapshot changed.'};}
  report.finishedAt = new Date().toISOString(); await save();
  await writeFile(path.join(output, 'summary.json'), JSON.stringify({status: report.status, startedAt: report.startedAt, finishedAt: report.finishedAt,
    scope: report.scope, identity: report.identity, restoredPose: report.restoredPose, contact: report.contact,
    afterContactScreenshot: report.afterContactScreenshot, actualCommands: report.actualCommands, action: {type: 'followUp', targetId: 'echo-secondary'},
    eventsFromFormalSdk: expected.events, actualStateSha256: report.actualStateSha256, final: report.actual, cleanupPassed: report.cleanupPassed,
    pageErrors: report.pageErrors, resourceErrors: report.resourceErrors, firstFailure: report.firstFailure}, null, 2));
  console.log(JSON.stringify({status: report.status, output, actualCommands: report.actualCommands, firstFailure: report.firstFailure}));
  if (report.status !== 'passed') process.exitCode = 1;
}
