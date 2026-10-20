// Evidence collection only. No browser tests, rebuilds, server changes, or complete-model replays.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream, constants} from 'node:fs';
import {readFile, writeFile, mkdir, copyFile, lstat, readdir, open, rename} from 'node:fs/promises';
import {resolve, dirname, relative, join, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const SELF = fileURLToPath(import.meta.url), TASK = 'tmp/T11-4-2-3i6';
const DEFAULT_OUT = 'docs/evidence/T11-4-2-3i6-guidance', MODEL = 'docs/evidence/T11-4-2-3i6-model';
const GOOD = TASK + '/guidance-final-v2', BAD = TASK + '/guidance-final';
const BEFORE = TASK + '/before-guidance-evidence-fixed', BEFORE_BAD = TASK + '/before-guidance-evidence';
const UI = ['src/presentation-v4/app.ts', 'src/presentation-v4/journey.ts', 'src/presentation-v4/stages.ts'];
const SDK = ['browser-session-BQdQqpuu.js', 'core-CvAZnNjA.js', 'rules-CAo3EZyg.js', 'sword-led-core.js', 'sword-led-session.js', 'sword-led-v2.js', 'sword-led-v3.js', 'sword-led-v4.js'];
const PROJECTS = ['chromium-1280x720', 'chromium-1920x1080', 'firefox-1280x720', 'firefox-1920x1080', 'webkit-1280x720', 'webkit-1920x1080'];
const CASES = ['opening-and-journey', 'ordinary-settlement-cancel', 'critical-settlement-cancel', 'protectedCritical-settlement-cancel', 'exhausted-settlement-cancel', 'salvage-guided-exchange', 'salvage-empty-cancel'];
const PICKS = ['chromium-1280x720/opening-full-goal', 'chromium-1280x720/protectedCritical-settlement', 'chromium-1280x720/salvage-no-reserve', 'chromium-1280x720/salvage-confirm-values', 'firefox-1280x720/exhausted-settlement', 'webkit-1920x1080/journey-full-goal', 'chromium-1280x720/ordinary-settlement', 'webkit-1920x1080/salvage-no-active-sword', 'chromium-1280x720/salvage-actual-once', 'chromium-1920x1080/critical-settlement'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function argumentsFor(values) {
 if (!values.length) {const root = resolve(dirname(SELF), '../..'); return {root, out: resolve(root, DEFAULT_OUT)};}
 assert(values.length === 4, 'Use no arguments or --root <checkout> --out <fresh evidence path>'); const map = new Map();
 for (let i = 0; i < values.length; i += 2) {assert(['--root', '--out'].includes(values[i]) && values[i + 1] && !values[i + 1].startsWith('--') && !map.has(values[i])); map.set(values[i], values[i + 1]);}
 assert(map.has('--root') && map.has('--out')); const root = resolve(map.get('--root')); return {root, out: resolve(root, map.get('--out'))};
}
const {root, out} = argumentsFor(process.argv.slice(2));
function within(base, path) {const absolute = resolve(base, path), tail = relative(base, absolute); assert(tail && !isAbsolute(tail) && tail !== '..' && !tail.startsWith('../'), 'Escaped evidence path'); return absolute;}
const source = path => within(root, path), output = path => within(out, path);
within(root, out);
async function absent(path) {await lstat(path).then(() => {throw Error('Refusing existing output: ' + path);}, error => {if (error.code !== 'ENOENT') throw error;});}
await absent(out);
const pinned = new Map(), jsonCache = new Map();
async function hashFile(path) {const info = await lstat(path); assert(info.isFile() && !info.isSymbolicLink(), 'Expected ordinary file: ' + path); let bytes = 0; const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) {bytes += chunk.length; digest.update(chunk);} assert.equal(bytes, info.size); return {sha256: digest.digest('hex'), bytes};}
async function pin(path) {const value = await hashFile(source(path)); if (pinned.has(path)) assert.deepEqual(value, pinned.get(path), 'Evidence input changed: ' + path); else pinned.set(path, value); return value;}
async function bytes(path) {const data = await readFile(source(path)); const identity = {sha256: sha(data), bytes: data.length}; if (pinned.has(path)) assert.deepEqual(identity, pinned.get(path)); else pinned.set(path, identity); return data;}
async function json(path) {if (!jsonCache.has(path)) jsonCache.set(path, JSON.parse((await bytes(path)).toString('utf8'))); return jsonCache.get(path);}
async function tree(directory, prefix = '') {const paths = []; for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {assert(!entry.isSymbolicLink()); const name = prefix + entry.name; if (entry.isDirectory()) paths.push(...await tree(join(directory, entry.name), name + '/')); else {assert(entry.isFile()); paths.push(name);}} return paths;}
async function hashTree(path) {const result = {}; for (const name of await tree(source(path))) result[name] = await pin(path + '/' + name); return result;}
const selfIdentity = await hashFile(SELF), startedAt = new Date().toISOString();
const {captureFingerprint, changedInputs} = await import(pathToFileURL(source('scripts/release-fingerprint.mjs')).href);
const qualityBefore = await json(TASK + '/quality/before.json'), qualityAfter = await json(TASK + '/quality/after.json');
const goodBefore = await json(TASK + '/guidance-final-02-process/before.json');
const extras = [...new Set([...qualityAfter.extraInputs, ...goodBefore.extraInputs, 'docs/v0.7-balance-validation-contract.md', 'docs/v0.7-balance-profiles.json', relative(root, SELF)])];
const physicalBefore = await captureFingerprint(root, extras);
const checks = {}, stateChecks = [], uniqueStates = new Set(), copies = [], generated = [];

async function processProof(name, expectedCode, expectedToken) {
 const directory = TASK + '/' + name, start = await json(directory + '/start.json'), end = await json(directory + '/terminal.json');
 assert.equal(end.token, expectedToken); assert.equal(start.token, expectedToken); assert.equal(end.kind, 'guidance-consumer-wrapper');
 assert.equal(end.pid, start.pid); assert.equal(end.childPid, start.childPid); assert(end.pid > 0 && end.childPid > 0);
 assert.equal(end.startedAt, start.startedAt); assert(Date.parse(end.finishedAt) >= Date.parse(end.startedAt));
 assert.equal(end.childTerminal.exitCode, expectedCode); assert.equal(end.childTerminal.signal, null); assert.equal(end.spawnError, null); assert.deepEqual(end.signals, []);
 assert.equal(end.validationComplete, expectedCode === 0); assert.deepEqual(end.changedInputs, []);
 const before = await json(directory + '/before.json'), after = await json(directory + '/after.json'); assert.deepEqual(changedInputs(before, after), []);
 assert.deepEqual(await pin(directory + '/wrapper-source.mjs'), {sha256: end.wrapper.sha256, bytes: end.wrapper.bytes});
 assert.deepEqual(await pin(directory + '/consumer-source.mjs'), {sha256: end.consumer.sha256, bytes: end.consumer.bytes});
 const snapshotA = await json(directory + '/snapshot-before.json'), snapshotB = await json(directory + '/snapshot-after.json'); assert.deepEqual(snapshotA.files, snapshotB.files);
 assert.deepEqual(snapshotA.files, Object.fromEntries(Object.entries(after.buildFiles).map(([path, value]) => [path.slice(5), value])));
 const fileNames = await tree(source(directory)); for (const file of fileNames) await pin(directory + '/' + file);
 return {directory, start, end, before, after, files: fileNames, snapshot: snapshotA.files};
}
const bad = await processProof('guidance-final-01-process', 1, 'guidance-final-01');
const good = await processProof('guidance-final-02-process', 0, 'guidance-final-02');
assert.equal(good.end.projects, 6); assert.equal(good.end.targetedCases, 42); assert.deepEqual(good.end.errors, []); assert.deepEqual(good.end.failures, []);
assert.equal(bad.end.projects, null); assert.equal(bad.end.targetedCases, null); assert(bad.end.failures.length > 0);
assert.equal(good.end.consumerOut, GOOD); assert.equal(bad.end.consumerOut, BAD); assert.equal(good.end.snapshot, bad.end.snapshot); assert.equal(good.end.baseURL, 'http://127.0.0.1:4198');
assert.deepEqual(good.end.command, [good.end.command[0], TASK + '/guidance-consumers.mjs', '--ack-guidance-built', '--url', good.end.baseURL + '/', '--snapshot', good.end.snapshot, '--out', GOOD]);
const snapshot = good.end.snapshot, runtime = await hashTree(snapshot); assert.equal(Object.keys(runtime).length, 75); assert.deepEqual(runtime, good.snapshot);
assert.deepEqual(physicalBefore.buildFiles, good.after.buildFiles); assert.deepEqual(runtime, Object.fromEntries(Object.entries(physicalBefore.buildFiles).map(([path, value]) => [path.slice(5), value])));
for (const [path, value] of Object.entries(good.after.sourceHashes)) assert.deepEqual(physicalBefore.sourceHashes[path], value, 'Current source differs from completed guidance inputs: ' + path);

// Quality ran on the same application/75 build. Only the consumer's explicit regex changed afterwards.
const quality = await json(TASK + '/quality/result.json'), unit = await json(TASK + '/quality/unit.json');
assert.deepEqual(qualityBefore.sourceHashes, qualityAfter.sourceHashes); assert.deepEqual(quality.changedInputs, []);
assert.equal(quality.sourceFiles, Object.keys(qualityAfter.sourceHashes).length); assert.equal(quality.buildFiles, 75);
assert.equal(unit.success, true); assert.equal(unit.numTotalTests, 357); assert.equal(unit.numPassedTests, 357); assert.equal(unit.numFailedTests, 0); assert.equal(unit.testResults.length, 29);
assert.deepEqual(quality.unit, {total: 357, passed: 357, failed: 0, files: 29});
for (const name of ['unit', 'build']) {const receipt = await json(TASK + '/quality/' + name + '-terminal.json'); assert.equal(receipt.exitCode, 0); assert.equal(receipt.signal, null); assert.deepEqual(receipt, quality.results.find(value => value.name === name));}
assert((await bytes(TASK + '/quality/build.log')).toString().includes('tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json'));
assert.deepEqual(qualityAfter.buildFiles, good.after.buildFiles);
const consumerPath = TASK + '/guidance-consumers.mjs', correction = await json(TASK + '/consumer-regex-correction.json');
const oldConsumer = (await bytes(bad.directory + '/consumer-source.mjs')).toString('utf8'), newConsumer = (await bytes(good.directory + '/consumer-source.mjs')).toString('utf8');
assert.equal(correction.kind, 'test-only-correction'); assert.equal(correction.beforeSha256, sha(Buffer.from(oldConsumer))); assert.equal(correction.afterSha256, sha(Buffer.from(newConsumer)));
assert.equal(oldConsumer.split(correction.exactBefore).length, 2); assert.equal(oldConsumer.replace(correction.exactBefore, correction.exactAfter), newConsumer);
assert.deepEqual(await pin(consumerPath), good.after.sourceHashes[consumerPath]); assert.deepEqual(qualityAfter.sourceHashes[consumerPath], bad.before.sourceHashes[consumerPath]);
const qualityUiChanges = []; for (const [path, identity] of Object.entries(qualityAfter.sourceHashes)) if (!same(identity, physicalBefore.sourceHashes[path])) qualityUiChanges.push(path);
assert.deepEqual(qualityUiChanges, [consumerPath], 'Quality to UI/current change is not the documented regex-only consumer correction');
const redGreenChanges = changedInputs(bad.after, good.before); assert.deepEqual(redGreenChanges, [consumerPath]);
for (const path of UI) {assert.deepEqual(qualityAfter.sourceHashes[path], good.after.sourceHashes[path]); assert.deepEqual(await pin(path), good.after.sourceHashes[path]);}
const failedUi = await json(BAD + '/failure.json'); assert.deepEqual(failedUi.results, []); assert.deepEqual(failedUi.errors, []); assert(failedUi.error.includes(correction.exactBefore)); assert(failedUi.error.includes('至少完成10项'));
await absent(source(BAD + '/result.json'));
checks.qualityBridge = {qualityInputs: Object.keys(qualityAfter.sourceHashes).length, unitTests: 357, files: 29, strictAndBuildExitCode: 0, runtimeFiles: 75, sourceChangesAfterQuality: qualityUiChanges, exactCorrection: correction,
 scope: 'Unit/strict/build source and runtime are unchanged for the application. The one later helper regex change is preserved exactly; no unrelated unit/build rerun is claimed.'};

// The pre-guidance model archive is sealed independently; compare its old source map with the current 3-TS change.
const modelVerification = await json(TASK + '/model-archive-verification.json'), modelDone = await json(MODEL + '/COMPLETED.json'), modelIndex = await json(MODEL + '/artifact-index.json');
assert.equal(modelVerification.actualCollectorExitCode, 0); assert.equal(modelDone.validationComplete, true); assert.deepEqual(modelDone, modelVerification.completion);
await absent(source(MODEL + '/COLLECTION-FAILED.json')); assert.deepEqual(await pin(MODEL + '/manifest.json'), {sha256: modelDone.manifest.sha256, bytes: modelDone.manifest.bytes});
assert.deepEqual(await pin(MODEL + '/artifact-index.json'), {sha256: modelDone.artifactIndex.sha256, bytes: modelDone.artifactIndex.bytes});
for (const entry of modelIndex.files) assert.deepEqual(await pin(MODEL + '/' + entry.path), {sha256: entry.sha256, bytes: entry.bytes});
const modelBaseline = await json(MODEL + '/formal/baseline.json'), bridge = await json(TASK + '/guidance-dependency-bridge.json'), applied = await json(TASK + '/guidance-applied.json');
assert.equal(modelDone.cases, 30000); assert.equal(modelDone.independentReplays, 30000); assert.equal(bridge.modelSourceCommit, modelDone.sourceCommit);
const modelProjection = await captureFingerprint(root, modelBaseline.extraInputs);
for (const [path, identity] of Object.entries(modelProjection.sourceHashes)) assert.deepEqual(physicalBefore.sourceHashes[path], identity);
const modelChanges = [...new Set([...Object.keys(modelBaseline.sourceHashes), ...Object.keys(modelProjection.sourceHashes)])].filter(path => !same(modelBaseline.sourceHashes[path], modelProjection.sourceHashes[path])).sort(); assert.deepEqual(modelChanges, [...UI].sort());
assert.deepEqual(bridge.changedSources, UI); assert.equal(bridge.formalSourceFiles, Object.keys(modelBaseline.sourceHashes).length); assert.equal(bridge.unchangedFormalSources, bridge.formalSourceFiles - UI.length);
assert.equal(bridge.currentSourceFiles, Object.keys(modelProjection.sourceHashes).length);
assert.deepEqual(bridge.files, runtime); assert.deepEqual(bridge.sourceAfter, modelProjection.sourceHashes);
assert.deepEqual(applied.files.map(entry => entry.path), UI);
for (const entry of applied.files) {assert.equal(entry.originalSha256, modelBaseline.sourceHashes[entry.path].sha256); assert.equal(entry.candidateSha256, physicalBefore.sourceHashes[entry.path].sha256); assert.equal((await pin(entry.candidate)).sha256, entry.candidateSha256);}
const runtimeChanges = [...new Set([...Object.keys(modelBaseline.buildFiles), ...Object.keys(physicalBefore.buildFiles)])].filter(path => !same(modelBaseline.buildFiles[path], physicalBefore.buildFiles[path]));
assert.deepEqual(runtimeChanges.sort(), [...bridge.changedRuntimePaths].sort()); assert.equal(bridge.unchangedRuntimePaths, 73);
for (const name of SDK) assert.deepEqual(physicalBefore.buildFiles['dist/' + name], modelBaseline.buildFiles['dist/' + name]);
checks.modelBridge = {modelSourceCommit: modelDone.sourceCommit, fullModelArchiveFilesVerified: modelIndex.files.length, sourceInputsCompared: Object.keys(modelBaseline.sourceHashes).length, changedSources: modelChanges, unchangedFormalSources: bridge.unchangedFormalSources, runtimeChanges, unchangedRuntimePaths: 73, unchangedSdk: SDK,
 scope: 'Only existing archive file hashes and source/runtime dependency identities are checked here. No complete model journal replay is run by this collector.'};

// Verify every original after artifact, retaining all 60 original PNGs in place and archiving only named representatives.
const result = await json(GOOD + '/result.json'), afterIndex = await json(GOOD + '/artifact-index.json'), wrapperValidation = await json(good.directory + '/output-validation.json');
assert.equal(result.projects, 6); assert.equal(result.targetedCases, 42); assert.deepEqual(result.errors, []); assert.deepEqual(result.results.map(project => project.project), PROJECTS);
for (const project of result.results) assert.deepEqual(project.cases.map(test => test.id), CASES);
assert.equal(result.scriptSha256, correction.afterSha256); assert.deepEqual(wrapperValidation.postConsumerHttpFiles, runtime); assert.equal(wrapperValidation.childValidationPassed, true);
const afterPaths = await tree(source(GOOD)); assert.deepEqual(afterPaths.filter(path => path !== 'artifact-index.json').sort(), Object.keys(afterIndex.files).sort());
for (const [name, identity] of Object.entries(afterIndex.files)) assert.deepEqual(await pin(GOOD + '/' + name), identity);
assert.deepEqual(wrapperValidation.outputFiles, {...afterIndex.files, 'artifact-index.json': await pin(GOOD + '/artifact-index.json')});
const pngs = afterPaths.filter(path => path.endsWith('.png')); assert.equal(pngs.length, 60); assert.equal(PICKS.length, 10); for (const pick of PICKS) assert(pngs.includes('screens/' + pick + '.png'));
const api = await import(pathToFileURL(source(snapshot + '/sword-led-v4.js')).href);
async function replay(path, group) {
 const data = await json(path); const found = [];
 function walk(value, pointer = '') {if (!value || typeof value !== 'object') return; if (!Array.isArray(value) && 'journal' in value) {const checked = api.validateRun(value); assert(checked.ok, path + '#' + pointer + ': ' + checked.detail); assert.deepEqual(checked.state, value); const identity = sha(Buffer.from(JSON.stringify(value))); uniqueStates.add(identity); const entry = {group, path, pointer: pointer || '/', sha256: identity, phase: value.phase, day: value.day, revision: value.revision}; found.push(entry); stateChecks.push(entry); return;} for (const [key, child] of Object.entries(value)) walk(child, pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));}
 walk(data); return found;
}
for (const name of afterPaths.filter(path => path.endsWith('.json') && !path.startsWith('runtime/'))) await replay(GOOD + '/' + name, 'after-success');
const afterStates = stateChecks.filter(entry => entry.group === 'after-success'), statesIndex = await json(GOOD + '/states-index.json');
assert.equal(afterStates.length, good.end.validatedOutputStateOccurrences); assert.equal(new Set(afterStates.map(entry => entry.sha256)).size, good.end.uniqueValidatedFullStates); assert.equal(statesIndex.length, good.end.indexedStateDocuments);
assert.equal(afterStates.length, statesIndex.length + 1); assert.deepEqual(afterStates.map(({group, path, ...entry}) => ({file: path.slice(GOOD.length + 1), ...entry})), wrapperValidation.states);
for (const entry of statesIndex) {const state = afterStates.find(item => item.path === GOOD + '/states/' + entry.label + '.json'); assert(state); for (const key of ['sha256', 'phase', 'day', 'revision']) assert.deepEqual(state[key], entry[key]);}
const failedPaths = await tree(source(BAD)); for (const name of failedPaths.filter(path => !path.startsWith('runtime/'))) {await pin(BAD + '/' + name); if (name.endsWith('.json')) await replay(BAD + '/' + name, 'after-original-failed-diagnostic');}

// Before comparison has its own documented tool error; no screenshot/UI completion is attributed to that attempt.
const beforeIndex = await json(BEFORE + '/artifact-index.json'), beforeResult = await json(BEFORE + '/result.json'), beforeReceipt = await json(BEFORE + '/execution-receipt.json');
assert.equal(beforeResult.observations, 6); assert.equal(beforeResult.checkedStates, 4); assert.deepEqual(beforeResult.errors, []); assert.equal(beforeResult.runtimeFiles, 75);
const modelRuntime = Object.fromEntries(Object.entries(modelBaseline.buildFiles).map(([path, identity]) => [path.slice('dist/'.length), identity]));
for (const directory of [BEFORE, BEFORE_BAD]) {
 const binding = await json(directory + '/preview-binding.json'); assert.deepEqual(binding.runtime, modelRuntime, 'Before observation is not the original sealed model runtime');
 assert.equal(binding.pid, 71430); assert.equal(binding.snapshot, 'tmp/previews/T11-4-2-3i5-mountain-pass'); assert.equal(binding.baseURL, 'http://127.0.0.1:4179');
 assert(Array.isArray(binding.http) && binding.http.length === 75); assert.equal(new Set(binding.http.map(item => item.name)).size, 75);
 assert.deepEqual(Object.fromEntries(binding.http.map(({name, ...identity}) => [name, identity])), modelRuntime);
 assert.deepEqual(binding.index, modelRuntime['index.html']); assert.deepEqual(binding.sdk, modelRuntime['sword-led-v4.js']);
}
assert.equal(beforeResult.previewPid, 71430); assert.equal(beforeResult.scriptSha256, (await pin(BEFORE + '/before-guidance.mjs')).sha256);
assert.deepEqual(beforeReceipt.attempts.map(item => item.actualExitCode), [1, 0]); assert.equal(beforeReceipt.attempts[0].successReceipt, false); assert.equal(beforeReceipt.attempts[1].successReceipt, true);
for (const [path, identity] of Object.entries(beforeIndex.files)) assert.deepEqual(await pin(path), identity);
const beforeFailure = await json(BEFORE_BAD + '/failure.json'); assert.deepEqual(beforeFailure.observations, []); assert.deepEqual(beforeFailure.errors, []); assert(beforeFailure.error.includes('60 !== 0'));
const beforePrimary = await json(BEFORE + '/states.json'); assert.equal(beforePrimary.length, 4);
for (const [directory, group] of [[BEFORE, 'before-corrected-observation'], [BEFORE_BAD, 'before-original-failed-diagnostic']]) for (const name of await tree(source(directory))) if (!name.startsWith('runtime/') && name.endsWith('.json')) await replay(directory + '/' + name, group);
const beforePngs = (await tree(source(BEFORE))).filter(name => name.endsWith('.png')); assert.equal(beforePngs.length, 6);
checks.replays = {afterSuccessDocuments: afterStates.length, afterSuccessUniqueStates: new Set(afterStates.map(entry => entry.sha256)).size, afterIndexedStates: statesIndex.length,
 beforePrimaryLogicalStates: beforePrimary.length, allCollectedStateOccurrences: stateChecks.length, allCollectedUniqueStateHashes: uniqueStates.size,
 perGroup: Object.fromEntries([...new Set(stateChecks.map(entry => entry.group))].map(group => [group, stateChecks.filter(entry => entry.group === group).length])), states: stateChecks,
 scope: 'Additional SDK validation of concrete output documents, including repeated historical/fixture copies and failed diagnostic states. No UI actions or whole-model sample is executed here.'};
checks.before = {observations: 6, screenshots: beforePngs.length, primaryStates: 4, originalToolFailureCompletedCases: 0, toolCorrection: beforeReceipt,
 originalRuntimeBinding: {snapshot: 'tmp/previews/T11-4-2-3i5-mountain-pass', previewPid: 71430, sealedModelFilesMatched: 75, recordedHttpFilesMatched: 75, note: 'This checks the preserved original HTTP receipt, without contacting 4179 during collection.'}};
checks.ui = {projects: 6, targetedCases: 42, actualUiEconomicCommands: result.results.reduce((sum, project) => sum + project.cases.reduce((n, test) => n + (test.acceptedCommandCount ?? 0), 0), 0), originalFailureCompletedProjects: failedUi.results.length, errors: [], originalPngs: pngs.length, publishedRepresentativePngs: PICKS.length};

async function checkHttp() {const files = {}; for (const [name, identity] of Object.entries(runtime)) {const response = await fetch(new URL(name, good.end.baseURL + '/'), {redirect: 'error', signal: AbortSignal.timeout(15000)}); assert.equal(response.status, 200, name); const data = Buffer.from(await response.arrayBuffer()), actual = {sha256: sha(data), bytes: data.length}; assert.deepEqual(actual, identity); files[name] = actual;} return {at: new Date().toISOString(), baseURL: good.end.baseURL, snapshot, files};}
const httpBefore = await checkHttp();

// No archive file is created until all prior original-process, quality, dependency and state gates have passed.
await mkdir(out, {recursive: false});
async function copy(path, destination, role) {const expected = await pin(path), to = output(destination); await mkdir(dirname(to), {recursive: true}); await copyFile(source(path), to, constants.COPYFILE_EXCL); assert.deepEqual(await hashFile(to), expected); assert.deepEqual(await pin(path), expected); copies.push({original: path, destination, role, ...expected});}
async function generate(path, value, role) {await mkdir(dirname(output(path)), {recursive: true}); await writeFile(output(path), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); generated.push({path, role, ...await hashFile(output(path))});}
try {
 for (const name of await tree(source(TASK + '/quality'))) await copy(TASK + '/quality/' + name, 'quality/' + name, 'Original complete quality JSON, raw log or actual child terminal');
 for (const proof of [bad, good]) for (const name of proof.files) await copy(proof.directory + '/' + name, 'process/' + proof.end.token + '/' + name, 'Original red/green wrapper bytes, actual process records, raw log and all before/after/validation proofs');
 for (const name of ['model-archive-verification.json', 'guidance-dependency-bridge.json', 'guidance-applied.json', 'consumer-regex-correction.json']) await copy(TASK + '/' + name, 'validation/' + name, 'Original archive/source/runtime/regex identity receipt');
 for (const [path, destination] of [[TASK + '/quality.mjs', 'tools/quality.mjs'], [TASK + '/run-guidance.mjs', 'tools/run-guidance.mjs'], [TASK + '/guidance-consumers.mjs', 'tools/guidance-consumers.mjs'], [TASK + '/before-guidance.mjs', 'tools/before-guidance.mjs'], [TASK + '/guidance-consumers-README.md', 'tools/guidance-consumers-README.md'], ['scripts/release-fingerprint.mjs', 'tools/release-fingerprint.mjs']]) await copy(path, destination, 'Original execution helper; restore its logical repository path before running');
 const afterMap = []; for (const name of afterPaths) {
  const isRuntime = name.startsWith('runtime/'), omitPng = name.endsWith('.png') && !PICKS.includes(name.slice('screens/'.length, -4));
  const destination = isRuntime || omitPng ? null : 'after/' + name;
  if (destination) await copy(GOOD + '/' + name, destination, 'Original after-consumer metadata/state/text or selected representative screenshot');
  afterMap.push({original: GOOD + '/' + name, destination, status: destination ? 'copied' : 'retained-at-original-local-path', reason: isRuntime ? 'All runtime hashes and new index/main are archived separately; unchanged art/SDK are not duplicated.' : omitPng ? 'Representative PNG selection; all 60 original PNGs remain unmodified locally.' : null, ...await pin(GOOD + '/' + name)});
 }
 for (const name of failedPaths.filter(path => !path.startsWith('runtime/'))) await copy(BAD + '/' + name, 'after-original-failed/' + name, 'Original failed UI attempt, zero completed projects; not passing coverage');
 const beforeMap = [];
 for (const [directory, destination] of [[BEFORE, 'before-corrected'], [BEFORE_BAD, 'before-original-failed']]) for (const name of await tree(source(directory))) {
  const target = name.startsWith('runtime/') ? null : destination + '/' + name;
  if (target) await copy(directory + '/' + name, target, 'Original before observation or failed tool evidence; all six corrected before PNG/text pairs are copied');
  beforeMap.push({original: directory + '/' + name, destination: target, status: target ? 'copied' : 'retained-at-original-local-path', ...await pin(directory + '/' + name)});
 }
 const mainFiles = Object.keys(runtime).filter(name => /^assets\/main-[^/]+\.js$/.test(name)); assert.equal(mainFiles.length, 1);
 for (const name of ['index.html', ...mainFiles]) await copy(snapshot + '/' + name, 'runtime-delta/' + name, 'Actual new default entry/main JS only; 75-file map and source reconstruction retain the full runtime identity');
 for (const path of UI) await copy(path, 'source-after/' + path, 'The only three changed presentation TypeScript modules; exact predecessor identities are in the sealed model source map/commit');
 await copy(MODEL + '/COMPLETED.json', 'model-reference/COMPLETED.json', 'Original completed model archive seal, not a newly executed 30000-case audit');
 await copy(MODEL + '/artifact-index.json', 'model-reference/artifact-index.json', 'Original complete model archive index; payload remains in sibling model evidence archive');
 await generate('validation/checks.json', checks, 'Actual collector checks, red/green boundaries and dynamic additional state counts');
 await generate('selection/after-artifacts.json', {originalOutput: GOOD, originalArtifactIndex: 'after/artifact-index.json', originalFiles: afterPaths.length, originalPngs: pngs.length, copiedPngs: PICKS.length, notDeleted: true, files: afterMap}, 'Complete raw-output path/hash mapping; explicitly records files not copied to remote');
 await generate('selection/before-artifacts.json', {originalCorrected: BEFORE, originalFailed: BEFORE_BAD, notDeleted: true, files: beforeMap}, 'Complete before artifact mapping without duplicating either 75-file old runtime');
 await generate('runtime-binding.json', {snapshot, baseURL: good.end.baseURL, runtimeFiles: 75, files: runtime, unchangedSdk: SDK, modelReference: '../T11-4-2-3i6-model', currentNewFiles: ['index.html', ...mainFiles], originalHttpCopies: GOOD + '/runtime', note: 'Only index/new main JS are duplicated here. Rebuild the source checkout and verify all 75 files; this archive is not a standalone full runtime.'}, 'Complete current 75-file identity and explicit runtime publication limits');
 await generate('http-before-collection.json', httpBefore, 'Actual all-75 HTTP check before archive creation');
 await generate('http-after-collection.json', await checkHttp(), 'Actual all-75 HTTP check after archive copies; no official 4179 access');
 await generate('physical-before.json', physicalBefore, 'Complete current source/dist/art/consumer/wrapper input fingerprint before collection');
 const physicalAfter = await captureFingerprint(root, extras); assert.deepEqual(changedInputs(physicalBefore, physicalAfter), []); assert.deepEqual(await hashTree(snapshot), runtime);
 await generate('physical-after.json', physicalAfter, 'Complete current source/dist/art/tool input fingerprint before final seal');
 for (const [path, identity] of pinned) assert.deepEqual(await hashFile(source(path)), identity, 'Original input changed before final seal: ' + path);
 assert.deepEqual(await hashFile(SELF), selfIdentity); const collectorTo = output('tools/collect-guidance.mjs'); await mkdir(dirname(collectorTo), {recursive: true}); await copyFile(SELF, collectorTo, constants.COPYFILE_EXCL); assert.deepEqual(await hashFile(collectorTo), selfIdentity);
 copies.push({original: SELF, logicalExecutionPath: TASK + '/collect-guidance.mjs', destination: 'tools/collect-guidance.mjs', role: 'The exact collector that executed; explicit --root/--out needed from an archived location', ...selfIdentity});
 const gate = 'Require actual collector exit 0, no COLLECTION-FAILED.json, a complete COMPLETED.json with validationComplete=true, matching manifest/index hashes, and every indexed payload hash. Manifest/index alone never assert success.';
 await generate('README.md', '# Guidance evidence\n\nThis is six browser engine/size configurations and 42 targeted guidance consumers, not the final browser matrix, a complete UI playthrough, human enjoyment acceptance, or another 30000-case model replay. The original failed UI attempt completed zero projects and is retained alongside the exact regex-only correction. Quality passed 357 unit tests and strict/web/SDK build before that helper correction; application source and all 75 runtime files remained identical across the correction.\n\nThe 28 indexed successful consumer state documents plus one historical source equal 29 output-state occurrences; all are copied along with the 28-entry index. Additional collector validation counts, failed diagnostic states, and before-state duplicates are listed in validation/checks.json, not conflated with the completed model audit. The corrected before observation has six screenshots and four primary logical states; its earlier tool mistake is retained.\n\nAll 60 after PNGs remain at their original local paths. Ten representative after PNGs and all six corrected before PNGs are published here. Original complete artifact indexes, all text/result/state documents and exact original-path/hash mappings explain what was and was not duplicated. Neither this collector nor the wrapper deletes those originals. No 75-file old/new art runtime is duplicated: runtime-binding.json identifies every file, runtime-delta/ preserves current index/new main JS, and the sibling model archive and source checkout supply the unchanged SDK/art. Verify a rebuilt full runtime before reproduction.\n\nArchived tools retain original bytes; restore their original logical paths or pass explicit --root/--out to this collector from a restored checkout. This collection only hashes the already sealed model archive, not replays its 30000 journals. It made HTTP checks solely against the explicit 4198 target and did not start/replace/refresh official 4179 or any user browser.\n\nCompletion gate: ' + gate + '\n', 'Scope, reproduction and omitted-original preservation requirements');
 const manifest = {schemaVersion: 1, validationComplete: false, status: 'awaiting-final-completion-receipt', completionGate: gate, startedAt, finishedAt: new Date().toISOString(), root, out: relative(root, out), scope: {projects: 6, targetedCases: 42, uiActualEconomicCommands: checks.ui.actualUiEconomicCommands, successfulUiOutputStates: afterStates.length, successfulUiUniqueStates: checks.replays.afterSuccessUniqueStates, collectorAdditionalStateOccurrences: stateChecks.length, collectorUniqueFullStates: uniqueStates.size, fullModelReplays: 0, finalMatrix: false, humanAcceptance: false}, checks, copies, generated};
 await writeFile(output('manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
 const artifacts = []; for (const name of await tree(out)) artifacts.push({path: name, ...await hashFile(output(name))});
 await writeFile(output('artifact-index.json'), JSON.stringify({schemaVersion: 1, validationComplete: false, status: 'awaiting-final-completion-receipt', completionGate: gate, excludes: ['artifact-index.json', 'COMPLETED.json', 'COMPLETED.json.partial', 'COLLECTION-FAILED.json'], files: artifacts}, null, 2) + '\n', {flag: 'wx'});
 for (const entry of artifacts) assert.deepEqual(await hashFile(output(entry.path)), {sha256: entry.sha256, bytes: entry.bytes});
 await absent(output('COLLECTION-FAILED.json')); await absent(output('COMPLETED.json'));
 const completion = {schemaVersion: 1, validationComplete: true, status: 'complete', completionGate: gate, completedAt: new Date().toISOString(), projects: 6, targetedCases: 42, successfulUiOutputStates: afterStates.length, successfulUiUniqueStates: checks.replays.afterSuccessUniqueStates, collectorAdditionalStateOccurrences: stateChecks.length, collectorUniqueFullStates: uniqueStates.size, fullModelReplays: 0, files: artifacts.length + 2, manifest: {path: 'manifest.json', ...await hashFile(output('manifest.json'))}, artifactIndex: {path: 'artifact-index.json', ...await hashFile(output('artifact-index.json'))}};
 const pending = await open(output('COMPLETED.json.partial'), 'wx'); try {await pending.writeFile(JSON.stringify(completion, null, 2) + '\n'); await pending.sync();} finally {await pending.close();}
 await new Promise((resolveWrite, reject) => process.stdout.write(JSON.stringify({complete: false, publicationPending: true, completionReceipt: relative(root, output('COMPLETED.json')), targetedCases: 42, collectorAdditionalStateOccurrences: stateChecks.length}) + '\n', error => error ? reject(error) : resolveWrite()));
 await rename(output('COMPLETED.json.partial'), output('COMPLETED.json'));
} catch (error) {await writeFile(output('COLLECTION-FAILED.json'), JSON.stringify({validationComplete: false, status: 'failed', at: new Date().toISOString(), error: error?.stack ?? String(error), scope: 'Any failure marker or nonzero collector exit invalidates the collection; manifest/index are not success markers.'}, null, 2) + '\n', {flag: 'wx'}).catch(() => {}); throw error;}
