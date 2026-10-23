import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, expect} from '@playwright/test';

const required = name => {
  assert(process.env[name]?.trim(), `${name} is required; no mutable-dist fallback.`);
  return process.env[name];
};
const snapshot = await realpath(required('V6_UI_SNAPSHOT'));
const url = new URL(required('V6_UI_URL'));
const output = path.resolve(required('V6_UI_OUTPUT'));
assert(!snapshot.split(path.sep).includes('dist'));
assert.equal(url.pathname, '/v6.html');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
assert(!output.startsWith(snapshot + path.sep));
try { await access(output); throw Error('Refusing to overwrite ' + output); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, {recursive: true});
const sha = value => createHash('sha256').update(value).digest('hex');
async function fingerprint() {
  const files = [];
  async function walk(relative = '') {
    const entries = await readdir(path.join(snapshot, relative), {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = path.join(relative, entry.name);
      assert(!entry.isSymbolicLink(), 'Frozen snapshot contains a symlink: ' + name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(snapshot, name));
        files.push({path: name.split(path.sep).join('/'), bytes: bytes.length, sha256: sha(bytes)});
      }
    }
  }
  await walk(); return {files, sha256: sha(JSON.stringify(files))};
}
const beforeFingerprint = await fingerprint();
const sdk = path.join(snapshot, 'sword-led-v6.js');
const sdkBytes = await readFile(sdk), api = await import(pathToFileURL(sdk).href);
const response = await fetch(new URL('/sword-led-v6.js', url));
assert.equal(response.status, 200);
assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(sdkBytes));
const report = {
  status: 'running', startedAt: new Date().toISOString(), step: 'launch',
  scope: {
    task: 'v0.9 / 2.3 finite failure adjustment, stale release cancellation and memory exit',
    browser: 'one fresh headless Chromium context, 1280x720 DPR1', seed: 'v6-contract',
    actions: 'steady two ordinary; canceled Space at forge/seal/main target; three zero-damage direct strikes; second blank fissure three ordinary plus one technique; direct clear; explicit memory; leave cache; real current-state download',
    authority: 'formal frozen SDK and full journal validation; no save/state/RNG/wallet injection',
    reducedMotion: 'not changed; natural animations retained',
    excludes: 'backup source fixtures, chaos/multiple browsers, echo gameplay, physical audio, player fun approval',
  },
  identity: {snapshot, url: url.href, sdkSha256: sha(sdkBytes), snapshotFingerprint: beforeFingerprint.sha256,
    scriptSha256: sha(await readFile(new URL(import.meta.url)))},
  commands: [], cancellations: [], controls: [], exports: [], images: [],
  pageErrors: [], resourceErrors: [], verifiedResponses: [], firstFailure: null,
};
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
const failure = error => ({name: error.name, message: error.message, stack: error.stack});
await writeFile(path.join(output, 'snapshot-before.json'), JSON.stringify(beforeFingerprint, null, 2));
await save();
let browser, context, page;
const responseChecks = [];
try {
  browser = await chromium.launch({headless: true, args: ['--no-proxy-server']});
  report.identity.browserVersion = browser.version();
  context = await browser.newContext({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, reducedMotion: 'no-preference', acceptDownloads: true});
  page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(String(error)));
  page.on('requestfailed', request => {
    if (['http:', 'https:'].includes(new URL(request.url()).protocol)) report.resourceErrors.push({type: 'requestfailed', url: request.url(), error: request.failure()});
  });
  page.on('response', response => {
    const check = (async () => {
      const address = new URL(response.url());
      if (!['http:', 'https:'].includes(address.protocol)) return; // Blob download is validated separately as an actual artifact.
      if (response.status() >= 400) report.resourceErrors.push({type: 'http', status: response.status(), url: response.url()});
      if (address.origin !== url.origin || response.status() !== 200) return;
      const local = path.resolve(snapshot, decodeURIComponent(address.pathname).replace(/^\/+/, '') || 'index.html');
      assert(local.startsWith(snapshot + path.sep));
      const [served, frozen] = await Promise.all([response.body(), readFile(local)]);
      assert.equal(sha(served), sha(frozen), 'HTTP body differs from frozen snapshot: ' + address.pathname);
      report.verifiedResponses.push({path: address.pathname, sha256: sha(served), bytes: served.length});
    })().catch(error => report.resourceErrors.push({type: 'snapshot-mismatch', url: response.url(), ...failure(error)}));
    responseChecks.push(check);
  });
  const game = page.locator('.x6-game');
  const slots = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [api.V6_SAVE_KEY, api.V6_BACKUP_KEY]);
  async function state() {
    const raw = (await slots())[api.V6_SAVE_KEY]; assert(raw);
    const envelope = JSON.parse(raw); assert.equal(envelope.schemaVersion, 6); assert.equal(envelope.rulesVersion, 'forge-v6');
    const decoded = api.decodeV6Save(raw); assert.equal(decoded.status, 'valid', JSON.stringify(decoded));
    const checked = api.validateRun(decoded.state); assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.deepEqual(checked.state, decoded.state); return decoded.state;
  }
  async function idle() {
    await expect(game).toHaveAttribute('data-busy', 'false');
    await expect(page.locator('[data-x6-transient]')).toHaveCount(0);
  }
  async function observation() {
    return page.evaluate(() => ({at: performance.now(), game: {...document.querySelector('.x6-game')?.dataset},
      focused: document.activeElement?.id, dialog: document.querySelector('#x6-dialog')?.open,
      result: document.querySelector('#x6-result')?.textContent,
      status: document.querySelector('#x6-save-warning')?.textContent,
      primary: {...document.querySelector('#x6-primary')?.dataset},
      canvas: {...document.querySelector('#x6-blade')?.dataset}}));
  }
  async function shot(label) {
    const file = label + '.png';
    await page.screenshot({path: path.join(output, file), animations: 'allow'});
    report.images.push({file, observation: await observation()});
  }
  async function unchanged(label, operation) {
    report.step = label; await idle(); const before = await slots();
    await operation(); await idle(); assert.deepEqual(await slots(), before, label + ' wrote economic state');
    report.controls.push({label, exactMainAndBackupUnchanged: true}); await save();
  }
  let failedBlade = null;
  async function command(action, selector, label = action.type) {
    report.step = label; await idle(); const before = await state();
    const expected = api.applyCommand(before, {runId: before.runId, expectedRevision: before.revision, action});
    assert.equal(expected.ok, true, 'Declared finite route rejected: ' + JSON.stringify(expected));
    const entry = {label, selector, action, before, expected: expected.state, expectedEventsFromFormalSdk: expected.events};
    report.commands.push(entry); await save();
    await page.locator(selector).click(); await idle(); const actual = await state();
    entry.actual = actual; assert.deepEqual(actual, expected.state);
    assert.equal(actual.revision, before.revision + 1); assert.equal(actual.journal.length, before.journal.length + 1);
    if (failedBlade) assert.deepEqual(actual.blades.find(blade => blade.id === 'main-1'), failedBlade, 'Failed first sword was reused or changed.');
    entry.passed = true; await save(); return actual;
  }
  async function cancelOldSpace(selector, label, expectArmed = false) {
    report.step = label; await idle(); const before = await state(), rawBefore = await slots();
    const target = page.locator(selector); await expect(target).toBeEnabled(); await target.focus();
    await page.keyboard.down('Space');
    if (expectArmed) await expect(game).toHaveAttribute('data-armed', 'true');
    await page.keyboard.press('Escape'); await expect(page.locator('#x6-dialog')).toBeVisible();
    await page.getByRole('button', {name: '继续这一剑', exact: true}).click();
    await expect(page.locator('#x6-dialog')).not.toBeVisible(); await expect(target).toBeFocused();
    await expect(game).toHaveAttribute('data-armed', 'false');
    await page.keyboard.up('Space'); await idle();
    assert.deepEqual(await slots(), rawBefore, label + ' old release wrote a command');
    assert.deepEqual(await state(), before, label + ' old release changed the official state');
    report.cancellations.push({label, selector, before, exactMainAndBackupUnchanged: true, after: await observation()});
    await save();
  }
  async function openSave() {
    await page.locator('#x6-save').click(); await expect(page.locator('#x6-dialog')).toBeVisible();
  }
  async function closeSave() {
    await page.getByRole('button', {name: '收好，回到眼前', exact: true}).click();
    await expect(page.locator('#x6-dialog')).not.toBeVisible(); await idle();
  }
  async function downloadCurrent(file, expected) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', {name: '导出手中行程', exact: true}).click(),
    ]);
    assert.equal(await download.failure(), null);
    const target = path.join(output, file); await download.saveAs(target);
    const bytes = await readFile(target), actual = JSON.parse(bytes.toString('utf8'));
    const checked = api.validateRun(actual); assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.deepEqual(checked.state, actual); assert.deepEqual(actual, expected);
    report.exports.push({file, suggestedFilename: download.suggestedFilename(), sha256: sha(bytes), revision: actual.revision, fullJournalValid: true, equalsFormalAccepted: true});
    return actual;
  }

  report.step = 'fresh page'; await page.goto(url.href); await expect(page.locator('#x6-start')).toBeEnabled();
  await page.waitForLoadState('networkidle');
  assert.deepEqual(await slots(), {[api.V6_SAVE_KEY]: null, [api.V6_BACKUP_KEY]: null});
  await unchanged('open seed details', () => page.locator('.x6-seed summary').click());
  await unchanged('set declared seed', () => page.locator('#x6-seed').fill(report.scope.seed));
  report.step = 'start fresh UI'; await page.locator('#x6-start').click(); await idle();
  await expect(page.locator('#x6-blade')).toHaveAttribute('data-art', 'ready');
  const started = await state(), created = api.createRun({runId: started.runId, seed: report.scope.seed});
  assert.equal(created.ok, true); assert.deepEqual(started, created.state); report.start = started;
  await command({type: 'chooseSchool', pieceId: 'main-1', school: 'steady'}, '[data-school="steady"]');
  for (let hit = 1; hit <= 2; hit++) await command({type: 'forge', pieceId: 'main-1', useTechnique: false}, '#x6-hit', 'weak-ordinary-' + hit);
  await unchanged('arm technique before forge cancellation', () => page.locator('#x6-technique').click());
  await expect(game).toHaveAttribute('data-armed', 'true');
  await cancelOldSpace('#x6-forge', 'forge held Space / pause / continue / old release', true);
  assert.equal((await state()).charges.main, 1);
  await cancelOldSpace('#x6-seal', 'seal held Space / pause / continue / old release');
  await command({type: 'seal', pieceId: 'main-1'}, '#x6-seal', 'seal actual weak sword');
  await cancelOldSpace('#x6-primary', 'main target held Space / pause / continue / old release');
  await shot('01-weak-sword-after-three-cancellations');
  for (let strike = 1; strike <= 3; strike++) {
    await command({type: 'strike', targetId: 'main-guard'}, '#x6-primary', 'weak-zero-strike-' + strike);
    const event = report.commands.at(-1).expectedEventsFromFormalSdk.find(event => event.type === 'Struck');
    assert.equal(event.damage, 0);
  }
  const failed = await state();
  assert.equal(failed.phase, 'main-forge'); assert.equal(failed.activePieceId, 'main-2');
  assert.equal(failed.charges.main, 1); assert.equal(failed.coins, 0);
  failedBlade = structuredClone(failed.blades.find(blade => blade.id === 'main-1'));
  assert.equal(failedBlade.status, 'failed');
  assert.equal(failed.trials[0].pieceId, 'main-1'); assert.equal(failed.trials[0].steps.length, 3);
  assert(failed.trials[0].steps.every(step => step.damage === 0));
  await shot('02-real-weak-failure-and-second-blank');
  await command({type: 'chooseSchool', pieceId: 'main-2', school: 'fissure'}, '[data-school="fissure"]', 'adapt second blank to fissure');
  for (let hit = 1; hit <= 3; hit++) {
    const current = await command({type: 'forge', pieceId: 'main-2', useTechnique: false}, '#x6-hit', 'adapted-ordinary-' + hit);
    assert.equal(current.charges.main, 1);
  }
  await unchanged('arm second sword technique without accepting it yet', () => page.locator('#x6-technique').click());
  const crafted = await command({type: 'forge', pieceId: 'main-2', useTechnique: true}, '#x6-hit', 'adapted-fissure-technique');
  assert.equal(crafted.charges.main, 0); assert.equal(crafted.blades.find(blade => blade.id === 'main-2').strength, 6);
  await command({type: 'seal', pieceId: 'main-2'}, '#x6-seal', 'seal adapted sword');
  const gate = await command({type: 'strike', targetId: 'main-guard'}, '#x6-primary', 'adapted direct clear');
  assert.equal(gate.phase, 'cache'); assert.equal(gate.coins, 15); assert.equal(gate.gatePaid, true);
  assert.equal(gate.charges.main, 0); assert.equal(gate.tool, null);
  assert(api.getRunView(gate).caches.every(cache => !cache.allowed), 'This safe adapted sword unexpectedly grants a free tool.');
  await shot('03-adapted-clear-no-free-tool');

  report.step = 'explicit keep current in memory'; const diskBeforeMemory = await slots();
  await openSave();
  await page.getByRole('button', {name: '保留手中行程，不保存继续', exact: true}).click();
  await expect(page.locator('#x6-dialog')).not.toBeVisible(); await idle();
  await expect(page.locator('#x6-save-warning')).toContainText('这趟不保存');
  assert.deepEqual(await slots(), diskBeforeMemory);
  await openSave();
  await expect(page.getByRole('button', {name: '重新取得保存权，读取最新', exact: true})).toBeDisabled();
  await expect(page.locator('#x6-dialog-body')).toContainText('请先导出手中成果，再重新打开本页');
  await downloadCurrent('memory-before-leave.json', gate);
  assert.deepEqual(await slots(), diskBeforeMemory);
  await shot('04-memory-disabled-reacquire-and-export-exit');
  await closeSave();

  report.step = 'memory-only leave cache';
  const expected = api.applyCommand(gate, {runId: gate.runId, expectedRevision: gate.revision, action: {type: 'leaveCache'}});
  assert.equal(expected.ok, true);
  const entry = {label: 'memory-only leave cache', selector: '#x6-leave', action: {type: 'leaveCache'}, before: gate,
    expected: expected.state, expectedEventsFromFormalSdk: expected.events};
  report.commands.push(entry); await save();
  await page.locator('#x6-leave').click(); await idle();
  await expect(game).toHaveAttribute('data-phase', 'recap'); await expect(page.locator('#x6-coins')).toHaveText('15');
  assert.deepEqual(await slots(), diskBeforeMemory, 'Memory Accepted action changed disk main/backup.');
  await openSave();
  await expect(page.getByRole('button', {name: '重新取得保存权，读取最新', exact: true})).toBeDisabled();
  const exported = await downloadCurrent('memory-recap-current.json', expected.state);
  entry.actual = exported; entry.passed = true;
  assert.deepEqual(await slots(), diskBeforeMemory, 'Exporting memory state changed disk.');
  await closeSave(); await shot('05-memory-recap-after-real-export');
  assert.equal(exported.phase, 'recap'); assert.equal(exported.revision, gate.revision + 1);
  assert.equal(exported.journal.length, gate.journal.length + 1); assert.equal(exported.coins, 15);
  assert.equal(exported.charges.main, 0); assert.equal(exported.tool, null);
  assert.deepEqual(exported.blades.find(blade => blade.id === 'main-1'), failedBlade);
  report.memory = {explicitChoice: true, diskBeforeMemory, diskAfter: await slots(), retainedCurrentEqualByDownload: true,
    reacquireDisabled: true, actualExportedRecap: exported, memoryAcceptedOnly: {diskRevision: gate.revision, exportedRevision: exported.revision}};
  report.final = exported;
  assert.equal(report.commands.length, 15); assert.equal(report.cancellations.length, 3);
  await page.waitForLoadState('networkidle'); await Promise.all(responseChecks);
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.resourceErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.firstFailure = {...failure(error), step: report.step};
  if (page) {
    try { report.failureDom = await page.locator('.x6-game').evaluate(element => ({dataset: {...element.dataset}, text: element.textContent, focused: document.activeElement?.id})); } catch (capture) { report.failureDom = {error: String(capture)}; }
    try { report.failureSlots = await page.evaluate(() => ({main: localStorage.getItem('sword-led.save.v6'), backup: localStorage.getItem('sword-led.save.backup.v6')})); } catch (capture) { report.failureSlots = {error: String(capture)}; }
    try { await page.screenshot({path: path.join(output, 'FIRST-FAILURE.png'), animations: 'allow'}); } catch (capture) { report.failureScreenshotError = String(capture); }
  }
} finally {
  await Promise.allSettled(responseChecks);
  await save();
  if (context) await context.close(); if (browser) await browser.close();
  const afterFingerprint = await fingerprint();
  await writeFile(path.join(output, 'snapshot-after.json'), JSON.stringify(afterFingerprint, null, 2));
  report.identity.snapshotAfterFingerprint = afterFingerprint.sha256;
  report.identity.snapshotUnchanged = beforeFingerprint.sha256 === afterFingerprint.sha256;
  if (!report.identity.snapshotUnchanged) { report.status = 'failed'; report.firstFailure ??= {message: 'Frozen snapshot changed.'}; }
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({status: report.status, output, commands: report.commands.length, cancellations: report.cancellations.length, firstFailure: report.firstFailure}));
  if (report.status !== 'passed') process.exitCode = 1;
}
