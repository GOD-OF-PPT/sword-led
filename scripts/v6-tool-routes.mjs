import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access, mkdir, readFile, readdir, realpath, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium, expect} from '@playwright/test';

// This script only consumes an explicit frozen build. It never restores an
// injected game state, picks a favorable seed, or imports a mutable dist SDK.
const required = name => {
  const value = process.env[name];
  assert(value?.trim(), `${name} is required; refusing a mutable-dist fallback.`);
  return value;
};
const snapshot = await realpath(required('V6_UI_SNAPSHOT'));
const url = new URL(required('V6_UI_URL'));
const output = path.resolve(required('V6_UI_OUTPUT'));
assert((await stat(snapshot)).isDirectory());
assert(!snapshot.split(path.sep).includes('dist'), 'Use a frozen preview, not dist.');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
assert.equal(url.pathname, '/v6.html');
assert(!output.startsWith(snapshot + path.sep), 'Output cannot mutate the snapshot.');
try { await access(output); throw Error('Refusing to overwrite ' + output); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(output, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const stateHash = value => sha(JSON.stringify(canonical(value)));
async function fingerprint() {
  const files = [];
  async function walk(relative = '') {
    const entries = await readdir(path.join(snapshot, relative), {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = path.join(relative, entry.name);
      assert(!entry.isSymbolicLink(), 'Snapshot symlink is not immutable: ' + name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const bytes = await readFile(path.join(snapshot, name));
        files.push({path: name.split(path.sep).join('/'), bytes: bytes.length, sha256: sha(bytes)});
      }
    }
  }
  await walk(); return {files, sha256: sha(JSON.stringify(files))};
}
const beforeFingerprint = await fingerprint(), sdkPath = path.join(snapshot, 'sword-led-v6.js');
const sdkBytes = await readFile(sdkPath), api = await import(pathToFileURL(sdkPath).href);
const sdkResponse = await fetch(new URL('/sword-led-v6.js', url));
assert.equal(sdkResponse.status, 200);
assert.equal(sha(Buffer.from(await sdkResponse.arrayBuffer())), sha(sdkBytes), 'HTTP SDK differs from selected snapshot.');
const report = {
  status: 'running', startedAt: new Date().toISOString(),
  scope: {
    task: 'v0.9 / 3.1 actual first use of both earned tools',
    engine: 'one headless Chromium, DPR1; two fresh contexts', seed: 'v6-contract',
    routes: 'main ordinary4 + technique; earned tool; echo ordinary3 + technique; steady manual stored follow-up, fissure restored charge actually used on echo-2',
    acceptedBudget: {steady: 19, fissure: 18, total: 37},
    reloads: 'once at steady stored follow-up; once at fissure echo-recharge; exact saved bytes and no scene replay',
    sizes: [{width: 1280, height: 720}, {width: 1920, height: 1080}],
    motion: 'one follow-up contact, one net-charge flow, one final returned-technique contact; natural animations, no fast-forward',
    authority: 'real UI inputs; frozen formal SDK events/state oracle; actual schema6 save/full-journal validation',
    limits: 'one fixed finite route per tool; no fault/browser matrix, speaker proof or player fun approval',
  },
  identity: {snapshot, url: url.href, sdkSha256: sha(sdkBytes), snapshotFingerprint: beforeFingerprint.sha256,
    scriptSha256: sha(await readFile(new URL(import.meta.url)))},
  routes: [], firstFailure: null,
};
const fail = error => ({name: error.name, message: error.message, stack: error.stack});
function compactObservation(value) {
  if (!value) return value;
  return {at: value.at, viewport: value.viewport, phase: value.phase, screen: value.screen, busy: value.busy,
    ending: value.ending, playing: value.playing, playVisible: value.playVisible, canvas: value.canvas?.dataset,
    ghost: value.ghost?.dataset, tool: value.tool?.dataset, pulse: value.pulse, energy: value.energy,
    toolEvents: value.toolEvents, chargeTargets: value.chargeTargets, transientCount: value.transientCount};
}
function summary() {
  return {status: report.status, startedAt: report.startedAt, finishedAt: report.finishedAt, scope: report.scope,
    identity: report.identity, firstFailure: report.firstFailure,
    eventAuthority: 'Events below are expected events from the frozen formal SDK, not an independent browser event tap.',
    routes: report.routes.map(route => ({school: route.school, status: route.status, failure: route.failure,
      commands: route.commands.map(command => ({label: command.label, action: command.action,
        events: command.expectedEventsFromFormalSdk, revision: command.actual?.revision,
        stateSha256: command.actual ? stateHash(command.actual) : null, passed: command.passed === true})),
      controls: route.controls, reloads: route.reloads,
      images: route.images.map(image => ({file: image.file, observation: compactObservation(image.observation)})),
      contacts: route.contacts.map(contact => ({kind: contact.kind, file: contact.file,
        before: compactObservation(contact.before), after: compactObservation(contact.after),
        windowHeldThroughScreenshot: contact.windowHeldThroughScreenshot})),
      final: route.final, finalStateSha256: route.final ? stateHash(route.final) : null,
      pageErrors: route.pageErrors, resourceErrors: route.resourceErrors,
      verifiedResponses: [...new Map(route.verifiedResponses.map(response => [response.path, response])).values()],
    })),
  };
}
async function save() {
  await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, 'summary.json'), JSON.stringify(summary(), null, 2));
}
await writeFile(path.join(output, 'snapshot-before.json'), JSON.stringify(beforeFingerprint, null, 2));
await save();
let browser;

async function runRoute(school) {
  const route = {school, status: 'running', step: 'new context', commands: [], controls: [], reloads: [],
    contacts: [], images: [], pageErrors: [], resourceErrors: [], verifiedResponses: []};
  report.routes.push(route); await save();
  const context = await browser.newContext({viewport: report.scope.sizes[0], deviceScaleFactor: 1, reducedMotion: 'no-preference'});
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const responseChecks = [];
  page.on('pageerror', error => route.pageErrors.push(String(error)));
  page.on('requestfailed', request => route.resourceErrors.push({type: 'requestfailed', url: request.url(), error: request.failure()}));
  page.on('response', response => {
    const check = (async () => {
      const address = new URL(response.url());
      if (response.status() >= 400) route.resourceErrors.push({type: 'http', status: response.status(), url: response.url()});
      if (address.origin !== url.origin || response.status() !== 200) return;
      const local = path.resolve(snapshot, decodeURIComponent(address.pathname).replace(/^\/+/, '') || 'index.html');
      assert(local.startsWith(snapshot + path.sep));
      const [actual, frozen] = await Promise.all([response.body(), readFile(local)]);
      assert.equal(sha(actual), sha(frozen), 'Runtime response differs from frozen snapshot: ' + address.pathname);
      route.verifiedResponses.push({path: address.pathname, sha256: sha(actual), bytes: actual.length});
    })().catch(error => route.resourceErrors.push({type: 'snapshot-mismatch', url: response.url(), ...fail(error)}));
    responseChecks.push(check);
  });
  const game = page.locator('.x6-game');
  const slots = () => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [api.V6_SAVE_KEY, api.V6_BACKUP_KEY]);
  async function state() {
    const raw = (await slots())[api.V6_SAVE_KEY]; assert(raw, 'Real writer did not produce a save.');
    const envelope = JSON.parse(raw); assert.equal(envelope.schemaVersion, 6); assert.equal(envelope.rulesVersion, 'forge-v6');
    const decoded = api.decodeV6Save(raw); assert.equal(decoded.status, 'valid', JSON.stringify(decoded));
    const checked = api.validateRun(decoded.state); assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.deepEqual(checked.state, decoded.state); return decoded.state;
  }
  async function idle() {
    await expect(game).toHaveAttribute('data-busy', 'false');
    await expect(page.locator('[data-x6-transient]')).toHaveCount(0);
    await expect(page.locator('[data-x6-energy]')).toHaveCount(0);
    await expect(page.locator('[data-x6-tool-event]')).toHaveCount(0);
    await expect(page.locator('[data-x6-charge-target]')).toHaveCount(0);
  }
  // Idle observations are separate from the successful, same-frame contact
  // snapshot returned by the contact predicate below.
  const observeInPage = () => {
    const visible = element => !!element && !element.closest('[hidden]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const box = element => {
      if (!element) return null;
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return {dataset: {...element.dataset}, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
        visibility: style.visibility, opacity: style.opacity, transform: style.transform};
    };
    const game = document.querySelector('.x6-game');
    return {at: performance.now(), viewport: {width: innerWidth, height: innerHeight},
      phase: game?.dataset.phase, screen: game?.dataset.screen, busy: game?.dataset.busy, ending: game?.dataset.ending,
      playVisible: visible(document.querySelector('#x6-play')),
      playing: document.querySelector('#x6-forge-scene')?.dataset.playing,
      hammerPhase: document.querySelector('#x6-hammer')?.dataset.phase,
      canvas: box(document.querySelector('#x6-blade')), ghost: box(document.querySelector('[data-x6-motion-sword]')),
      tool: box(document.querySelector('#x6-tool')), pulse: document.querySelector('#x6-tool-pulse')?.textContent,
      energy: [...document.querySelectorAll('[data-x6-energy]')].map(element => element.dataset.x6Energy),
      toolEvents: [...document.querySelectorAll('[data-x6-tool-event]')].map(element => element.dataset.x6ToolEvent),
      chargeTargets: [...document.querySelectorAll('[data-x6-charge-target]')].map(element => element.dataset.x6ChargeTarget),
      transientCount: document.querySelectorAll('[data-x6-transient]').length};
  };
  const observation = () => page.evaluate(observeInPage);
  async function shot(label) {
    const file = `${school}-${label}.png`;
    await page.screenshot({path: path.join(output, file), animations: 'allow'});
    route.images.push({file, observation: await observation()});
  }
  async function bothSizes(label) {
    await idle(); const before = await slots(); await shot(label + '-1280');
    await page.setViewportSize(report.scope.sizes[1]); await shot(label + '-1920');
    await page.setViewportSize(report.scope.sizes[0]); await idle();
    assert.deepEqual(await slots(), before, 'Idle viewport changes wrote game state.');
  }
  async function contact(kind, expected) {
    const forged = expected.events.find(event => event.type === 'Forged');
    const pieceId = kind === 'last-technique' ? forged.pieceId : 'echo-1';
    const afterBlade = expected.state.blades.find(blade => blade.id === pieceId);
    const handle = await page.waitForFunction(({kind, pieceId, strength}) => {
      const game = document.querySelector('.x6-game'), scene = document.querySelector('#x6-forge-scene');
      const play = document.querySelector('#x6-play'), canvas = document.querySelector('#x6-blade');
      const visible = !!play && !play.hidden && play.getClientRects().length > 0;
      if (game?.dataset.busy !== 'true' || !visible) return false;
      if (kind === 'follow-up') {
        const ghost = document.querySelector('[data-x6-motion-sword]');
        if (game.dataset.ending !== 'true' || scene?.dataset.playing !== 'followUp' || ghost?.dataset.pieceId !== pieceId || ghost.dataset.strength !== String(strength) || !document.querySelector('[data-x6-tool-event="used"]')) return false;
      } else if (kind === 'net-charge') {
        if (game.dataset.phase !== 'echo-recharge' || scene?.dataset.playing !== 'strike' || !document.querySelector('[data-x6-energy="recharged"]') || !document.querySelector('[data-x6-tool-event="recharged"]') || !document.querySelector('[data-x6-charge-target="1"]')) return false;
      } else {
        const phase = document.querySelector('#x6-hammer')?.dataset.phase;
        if (game.dataset.ending !== 'true' || scene?.dataset.playing !== 'forge' || canvas?.dataset.pieceId !== pieceId || canvas.dataset.strength !== String(strength) || !['contact', 'rebound'].includes(phase)) return false;
      }
      const box = element => {
        if (!element) return null;
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return {dataset: {...element.dataset}, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
          visibility: style.visibility, opacity: style.opacity, transform: style.transform};
      };
      return {at: performance.now(), viewport: {width: innerWidth, height: innerHeight},
        phase: game.dataset.phase, screen: game.dataset.screen, busy: game.dataset.busy, ending: game.dataset.ending,
        playVisible: visible, playing: scene.dataset.playing,
        hammerPhase: document.querySelector('#x6-hammer')?.dataset.phase,
        canvas: box(canvas), ghost: box(document.querySelector('[data-x6-motion-sword]')),
        tool: box(document.querySelector('#x6-tool')), pulse: document.querySelector('#x6-tool-pulse')?.textContent,
        energy: [...document.querySelectorAll('[data-x6-energy]')].map(element => element.dataset.x6Energy),
        toolEvents: [...document.querySelectorAll('[data-x6-tool-event]')].map(element => element.dataset.x6ToolEvent),
        chargeTargets: [...document.querySelectorAll('[data-x6-charge-target]')].map(element => element.dataset.x6ChargeTarget),
        transientCount: document.querySelectorAll('[data-x6-transient]').length};
    }, {kind, pieceId, strength: afterBlade.strength}, {polling: 'raf', timeout: 3000});
    const before = await handle.jsonValue(); await handle.dispose();
    const file = `${school}-${kind}-natural-contact-1280.png`;
    const record = {kind, file, before}; route.contacts.push(record);
    await page.screenshot({path: path.join(output, file), animations: 'allow'});
    record.after = await observation();
    record.windowHeldThroughScreenshot = before.busy === 'true' && record.after.busy === 'true' && before.playing === record.after.playing && record.after.playVisible;
    // The hard contact witness is the successful single public-DOM sample above.
    // A naturally finished later sample is recorded, never called a replay.
  }
  async function command(action, selector, {label = action.type, capture = null} = {}) {
    route.step = label; await idle(); const before = await state();
    const expected = api.applyCommand(before, {runId: before.runId, expectedRevision: before.revision, action});
    assert.equal(expected.ok, true, 'Declared fixed route rejected: ' + JSON.stringify(expected));
    const entry = {label, action, before, expected: expected.state, expectedEventsFromFormalSdk: expected.events};
    route.commands.push(entry); await save();
    await page.locator(selector).click();
    if (capture) await contact(capture, expected);
    await idle(); const actual = await state(); entry.actual = actual;
    assert.deepEqual(actual, expected.state); assert.equal(actual.revision, before.revision + 1);
    assert.equal(actual.journal.length, before.journal.length + 1);
    if (actual.gateCleared) { assert.equal(actual.coins, 15); assert.equal(actual.gatePaid, true); }
    entry.passed = true; await save(); return actual;
  }
  async function unchanged(label, operation) {
    route.step = label; await idle(); const before = await slots(); await operation(); await idle();
    assert.deepEqual(await slots(), before, label + ' wrote game state.');
    route.controls.push({label, exactMainAndBackupUnchanged: true}); await save();
  }
  async function reloadPhase(label, expected) {
    route.step = label; await idle(); const before = await slots(), beforeHash = stateHash(expected);
    await page.reload(); await expect(page.locator('#x6-continue')).toBeEnabled();
    await page.waitForLoadState('networkidle');
    assert.deepEqual(await slots(), before, 'Reload wrote a duplicate reward or journal.');
    await page.locator('#x6-continue').click(); await idle();
    await expect(game).toHaveAttribute('data-phase', expected.phase);
    await expect(page.locator('#x6-blade')).toHaveAttribute('data-art', 'ready');
    const after = await state(); assert.deepEqual(after, expected); assert.deepEqual(await slots(), before);
    const observed = await observation();
    assert.equal(observed.playing, undefined); assert.equal(observed.transientCount, 0);
    assert.deepEqual(observed.energy, []); assert.deepEqual(observed.toolEvents, []); assert.deepEqual(observed.chargeTargets, []);
    route.reloads.push({label, phase: expected.phase, revision: after.revision, stateSha256: beforeHash,
      exactMainAndBackupUnchanged: true, noSceneReplayAtRestoredObservation: true, observation: compactObservation(observed)});
    await save();
  }
  async function arm(label) {
    await unchanged(label, () => page.locator('#x6-technique').click());
    await expect(game).toHaveAttribute('data-armed', 'true');
  }
  try {
    await page.goto(url.href); await expect(page.locator('#x6-start')).toBeEnabled();
    await page.waitForLoadState('networkidle');
    assert.deepEqual(await slots(), {[api.V6_SAVE_KEY]: null, [api.V6_BACKUP_KEY]: null});
    await unchanged('open seed details', () => page.locator('.x6-seed summary').click());
    await unchanged('enter declared fixed seed', () => page.locator('#x6-seed').fill(report.scope.seed));
    route.step = 'fresh real UI start'; await page.locator('#x6-start').click(); await idle();
    await expect(page.locator('#x6-blade')).toHaveAttribute('data-art', 'ready');
    const started = await state(), created = api.createRun({runId: started.runId, seed: report.scope.seed});
    assert.equal(created.ok, true); assert.deepEqual(started, created.state); route.start = started;
    await command({type: 'chooseSchool', pieceId: 'main-1', school}, `[data-school="${school}"]`);
    for (let hit = 1; hit <= 4; hit++) await command({type: 'forge', pieceId: 'main-1', useTechnique: false}, '#x6-hit', {label: 'main ordinary ' + hit});
    await arm('arm main technique without a command');
    const mainBlade = await command({type: 'forge', pieceId: 'main-1', useTechnique: true}, '#x6-hit', {label: 'main technique'});
    assert.equal(mainBlade.charges.main, 0);
    await command({type: 'seal', pieceId: 'main-1'}, '#x6-seal', {label: 'main seal'});
    if (school === 'steady') await command({type: 'guard'}, '#x6-guard', {label: 'main guard'});
    await command({type: 'strike', targetId: 'main-guard'}, '#x6-primary', {label: 'main actual clear'});
    const target = school === 'steady' ? 'rope' : 'latch', tool = school === 'steady' ? 'rebound' : 'furnace';
    const earned = await command({type: 'takeCache', target}, '#x6-' + target, {label: 'actual earned tool'});
    assert.equal(earned.phase, 'echo-forge'); assert.equal(earned.tool, tool); assert.equal(earned.charges.echo, 1);
    assert.equal(earned.blades.filter(blade => blade.stage === 'echo').length, 3);
    await command({type: 'chooseSchool', pieceId: 'echo-1', school}, `[data-school="${school}"]`, {label: 'echo school'});
    for (let hit = 1; hit <= 3; hit++) await command({type: 'forge', pieceId: 'echo-1', useTechnique: false}, '#x6-hit', {label: 'echo ordinary ' + hit});
    await arm('arm first echo technique without a command');
    const echoBlade = await command({type: 'forge', pieceId: 'echo-1', useTechnique: true}, '#x6-hit', {label: 'echo technique'});
    assert.equal(echoBlade.charges.echo, 0);
    await command({type: 'seal', pieceId: 'echo-1'}, '#x6-seal', {label: 'echo seal'});
    if (school === 'steady') {
      await command({type: 'guard'}, '#x6-guard', {label: 'echo real opening'});
      const stored = await command({type: 'strike', targetId: 'echo-primary'}, '#x6-primary', {label: 'actual stored overkill'});
      assert.equal(stored.phase, 'echo-trial'); assert.equal(stored.trial.primary.health, 0);
      assert.equal(stored.trial.storedOverkill, 4); assert.equal(stored.trial.secondary.health, 4);
      await expect(page.locator('#x6-tool')).toHaveAttribute('data-state', 'stored');
      await expect(page.locator('#x6-tool-pulse')).toContainText('已存 4 追斩');
      await expect(page.locator('#x6-secondary')).toBeEnabled();
      await bothSizes('actual-stored-follow-up');
      await reloadPhase('reload stored follow-up once', stored);
      await expect(page.locator('#x6-secondary')).toHaveAttribute('data-ready', 'true');
      const ended = await command({type: 'followUp', targetId: 'echo-secondary'}, '#x6-secondary', {label: 'manual secondary follow-up', capture: 'follow-up'});
      assert.equal(ended.echo.demonstrated, true); assert.equal(ended.endReason, 'rebound-demonstrated');
      const used = route.commands.at(-1).expectedEventsFromFormalSdk.find(event => event.type === 'FollowUpUsed');
      assert.equal(used.damage, stored.trial.storedOverkill); assert.equal(used.healthAfter, 0);
      route.final = ended;
    } else {
      const restored = await command({type: 'strike', targetId: 'echo-primary'}, '#x6-primary', {label: 'net one charge restored', capture: 'net-charge'});
      assert.equal(restored.phase, 'echo-recharge'); assert.equal(restored.activePieceId, 'echo-2');
      assert.equal(restored.echo.rechargeGained, 1); assert.equal(restored.charges.echo, 1);
      const charge = route.commands.at(-1).expectedEventsFromFormalSdk.find(event => event.type === 'ChargeRestored');
      assert.deepEqual(charge, {type: 'ChargeRestored', before: 0, after: 1, gained: 1});
      await expect(page.locator('#x6-tool')).toHaveAttribute('data-state', 'recharged');
      await expect(page.locator('#x6-forge')).toBeDisabled();
      await bothSizes('actual-returned-charge');
      await reloadPhase('reload returned charge once', restored);
      await command({type: 'chooseSchool', pieceId: 'echo-2', school: 'fissure'}, '[data-school="fissure"]', {label: 'new blank school for returned technique'});
      await expect(page.locator('#x6-forge')).toBeDisabled();
      await arm('arm returned technique on the new blank');
      const ended = await command({type: 'forge', pieceId: 'echo-2', useTechnique: true}, '#x6-hit', {label: 'actually use returned technique', capture: 'last-technique'});
      assert.equal(ended.charges.echo, 0); assert.equal(ended.echo.techniqueUsedAfterRecharge, true);
      assert.equal(ended.echo.demonstrated, true); assert.equal(ended.endReason, 'furnace-demonstrated');
      route.final = ended;
    }
    assert.equal(route.final.phase, 'recap'); assert.equal(route.final.coins, 15); assert.equal(route.final.tool, tool);
    assert.equal(route.final.blades.filter(blade => blade.stage === 'echo').length, 3);
    await expect(game).toHaveAttribute('data-screen', 'recap');
    await expect(page.locator('#x6-recap')).toBeVisible();
    await expect(game).toHaveAttribute('data-ending', 'false');
    await shot('actual-tool-demonstrated-recap-1280');
    const events = route.commands.flatMap(command => command.expectedEventsFromFormalSdk);
    assert.equal(events.filter(event => event.type === 'GateCleared').length, 1);
    assert.equal(events.filter(event => event.type === 'CacheTaken').length, 1);
    assert.equal(route.commands.length, school === 'steady' ? 19 : 18);
    await page.waitForLoadState('networkidle'); await Promise.all(responseChecks);
    assert.deepEqual(route.pageErrors, []); assert.deepEqual(route.resourceErrors, []);
    route.status = 'passed';
  } catch (error) {
    route.status = 'failed'; route.failure = {...fail(error), step: route.step};
    report.firstFailure ??= {school, ...route.failure};
    try { route.failureObservation = await observation(); } catch (capture) { route.failureObservation = {error: String(capture)}; }
    try { route.failureSlots = await slots(); } catch (capture) { route.failureSlots = {error: String(capture)}; }
    try { await page.screenshot({path: path.join(output, school + '-FIRST-FAILURE.png'), animations: 'allow'}); } catch (capture) { route.failureScreenshotError = String(capture); }
  } finally {
    await Promise.allSettled(responseChecks); route.finishedAt = new Date().toISOString(); await save();
    await context.close();
  }
}
try {
  browser = await chromium.launch({headless: true, args: ['--no-proxy-server']});
  report.identity.browserVersion = browser.version();
  for (const school of ['steady', 'fissure']) { await runRoute(school); if (report.firstFailure) break; }
} catch (error) {
  report.infrastructureFailure = fail(error); report.firstFailure ??= {school: null, ...report.infrastructureFailure};
} finally {
  if (browser) await browser.close();
  const afterFingerprint = await fingerprint();
  await writeFile(path.join(output, 'snapshot-after.json'), JSON.stringify(afterFingerprint, null, 2));
  report.identity.snapshotAfterFingerprint = afterFingerprint.sha256;
  report.identity.snapshotUnchanged = beforeFingerprint.sha256 === afterFingerprint.sha256;
  if (!report.identity.snapshotUnchanged) report.firstFailure ??= {message: 'Frozen snapshot changed during execution.'};
  report.status = report.routes.length === 2 && report.routes.every(route => route.status === 'passed') && !report.firstFailure ? 'passed' : 'failed';
  report.finishedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({status: report.status, output, routes: report.routes.map(route => ({school: route.school, status: route.status, verifiedAccepted: route.commands.filter(command => command.passed).length})), firstFailure: report.firstFailure}));
  if (report.status !== 'passed') process.exitCode = 1;
}
