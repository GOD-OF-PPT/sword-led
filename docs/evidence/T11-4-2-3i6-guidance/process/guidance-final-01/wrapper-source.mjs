// Prepared only. Run after the model/audit archive, implemented guidance, and explicit snapshot/server preparation.
// This wrapper never starts a server or contacts the official port 4179.
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, writeFile, mkdir, lstat, readdir, open, realpath} from 'node:fs/promises';
import {resolve, dirname, join, relative, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {captureFingerprint, changedInputs} from '../../scripts/release-fingerprint.mjs';

const SELF = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SELF), '../..');
const TASK = join(ROOT, 'tmp/T11-4-2-3i6');
const DEFAULT_CONSUMER = join(TASK, 'guidance-consumers.mjs');
const HISTORICAL = 'docs/evidence/T11-4-2-3i1/witness-fixed/complete.json';
const ORIGINAL_PREVIEW = 'tmp/previews/T11-4-2-3i5-mountain-pass';
const SDK_FILES = ['browser-session-BQdQqpuu.js', 'core-CvAZnNjA.js', 'rules-CAo3EZyg.js', 'sword-led-core.js', 'sword-led-session.js', 'sword-led-v2.js', 'sword-led-v3.js', 'sword-led-v4.js'];
const EXPECTED_PROJECTS = ['chromium-1280x720', 'chromium-1920x1080', 'firefox-1280x720', 'firefox-1920x1080', 'webkit-1280x720', 'webkit-1920x1080'];
const EXPECTED_CASES = ['opening-and-journey', 'ordinary-settlement-cancel', 'critical-settlement-cancel', 'protectedCritical-settlement-cancel', 'exhausted-settlement-cancel', 'salvage-guided-exchange', 'salvage-empty-cancel'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const iso = () => new Date().toISOString();
const errorText = error => error?.stack ?? String(error);

function within(base, path) {
 const absolute = resolve(base, path), tail = relative(base, absolute);
 assert(tail && tail !== '..' && !tail.startsWith('../') && !isAbsolute(tail), 'Path must be strictly inside its designated root');
 return absolute;
}
function parseArgs(values) {
 const options = new Map();
 assert(values.length > 0 && values.length % 2 === 0, 'Use --token <unique> --snapshot <build> --url <local-origin> --out <new consumer directory> [--consumer <task mjs>]');
 for (let index = 0; index < values.length; index += 2) {
  const key = values[index], value = values[index + 1];
  assert(['--token', '--snapshot', '--url', '--out', '--consumer'].includes(key) && value && !value.startsWith('--') && !options.has(key), 'Unknown, duplicate, or missing argument');
  assert(!value.includes('\0'), 'NUL argument rejected'); options.set(key, value);
 }
 for (const key of ['--token', '--snapshot', '--url', '--out']) assert(options.has(key), 'Missing ' + key);
 const token = options.get('--token'); assert(/^[a-z][a-z0-9-]{0,95}$/.test(token), 'Use a unique lowercase task token');
 const snapshot = within(ROOT, options.get('--snapshot')), consumerOut = within(TASK, resolve(ROOT, options.get('--out')));
 assert(snapshot === join(ROOT, 'dist') || snapshot.startsWith(join(ROOT, 'tmp/previews') + '/'), 'Explicit dist or task preview snapshot required');
 assert.equal(dirname(consumerOut), TASK, 'Consumer output must be a direct task child');
 const consumer = within(TASK, options.has('--consumer') ? resolve(ROOT, options.get('--consumer')) : DEFAULT_CONSUMER);
 assert(consumer.endsWith('.mjs'), 'Consumer must be an explicit task mjs module');
 const receiptOut = within(TASK, token + '-process'); assert.notEqual(consumerOut, receiptOut);
 const url = new URL(options.get('--url'));
 assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Local HTTP origin only');
 assert(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password, 'Provide only a local server origin');
 assert.notEqual(url.port, '4179', 'The official 4179 preview is outside this wrapper');
 return {token, snapshot, consumerOut, consumer, receiptOut, url};
}
async function absent(path) {
 await lstat(path).then(() => {throw Error('Refusing to overwrite existing output: ' + path);}, error => {if (error.code !== 'ENOENT') throw error;});
}
async function fileHash(path) {
 const info = await lstat(path); assert(info.isFile() && !info.isSymbolicLink(), 'Expected ordinary file: ' + path);
 const digest = createHash('sha256'); let bytes = 0;
 for await (const part of createReadStream(path)) {digest.update(part); bytes += part.length;}
 assert.equal(bytes, info.size); return {sha256: digest.digest('hex'), bytes};
}
async function tree(directory, prefix = '') {
 const entries = [];
 for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
  assert(!entry.isSymbolicLink(), 'Symlink input/output rejected: ' + join(directory, entry.name));
  const label = prefix + entry.name;
  if (entry.isDirectory()) entries.push(...await tree(join(directory, entry.name), label + '/'));
  else {assert(entry.isFile(), 'Non-file artifact rejected'); entries.push(label);}
 }
 return entries;
}
async function directoryHash(directory) {
 const files = {};
 for (const name of await tree(directory)) files[name] = await fileHash(join(directory, name));
 return files;
}
const json = async path => JSON.parse(await readFile(path, 'utf8'));

assert.equal(resolve(process.cwd()), ROOT, 'Run from the original repository root');
const options = parseArgs(process.argv.slice(2));
const {token, snapshot, consumerOut, consumer, receiptOut, url} = options;
assert.equal(await realpath(consumer), consumer, 'Consumer path may not traverse a symlink');
assert.equal(await realpath(snapshot), snapshot, 'Snapshot path may not traverse a symlink');
assert((await lstat(consumer)).isFile()); assert((await lstat(snapshot)).isDirectory());
await absent(receiptOut); await absent(consumerOut);
const wrapperBytes = await readFile(SELF), consumerBytes = await readFile(consumer);
const wrapperIdentity = {path: relative(ROOT, SELF), sha256: sha(wrapperBytes), bytes: wrapperBytes.length};
const consumerIdentity = {path: relative(ROOT, consumer), sha256: sha(consumerBytes), bytes: consumerBytes.length};
const extras = [...new Set([wrapperIdentity.path, consumerIdentity.path, relative(ROOT, snapshot), HISTORICAL, ...SDK_FILES.map(name => ORIGINAL_PREVIEW + '/' + name)])];
const startedAt = iso(), command = [process.execPath, consumerIdentity.path, '--ack-guidance-built', '--url', url.href, '--snapshot', relative(ROOT, snapshot), '--out', relative(ROOT, consumerOut)];
await mkdir(receiptOut, {recursive: false});
const write = (name, value) => writeFile(join(receiptOut, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});

let before = null, after = null, snapshotBefore = null, snapshotAfter = null, child = null, rawLog = null;
let childClosed = null;
let spawnError = null, childTerminal = null, signals = [], failures = [], validation = null, result = null;
let finalized = false;
const signalHandlers = new Map();
const baseReceipt = {schemaVersion: 1, kind: 'guidance-consumer-wrapper', token, pid: process.pid, childPid: null, startedAt,
 command, root: ROOT, consumerOut: relative(ROOT, consumerOut), snapshot: relative(ROOT, snapshot), baseURL: url.origin,
 wrapper: wrapperIdentity, consumer: consumerIdentity, extraInputs: extras,
 officialPreview: {port: 4179, scope: 'This wrapper neither contacts, starts, replaces, nor refreshes the official preview or any user browser.'},
 scope: 'Six engine/size projects and 42 targeted guidance cases; declared restoration boundaries and two UI economic commands per salvage case. Output-state replays are counted individually and are not a 30000-case model replay.'};
for (const signal of ['SIGINT', 'SIGTERM']) {
 const handler = () => {signals.push({signal, at: iso()}); if (child && child.exitCode === null && child.signalCode === null) child.kill(signal);};
 signalHandlers.set(signal, handler); process.on(signal, handler);
}

async function validateOutputs() {
 const files = await tree(consumerOut); assert(!files.includes('failure.json'), 'Consumer failure artifact exists');
 result = await json(join(consumerOut, 'result.json'));
 assert.equal(result.projects, 6); assert.equal(result.targetedCases, 42); assert.deepEqual(result.errors, []);
 assert.equal(result.scriptSha256, consumerIdentity.sha256); assert.equal(result.snapshot, relative(ROOT, snapshot)); assert.equal(result.baseURL, url.origin);
 assert.equal(result.runtimeFiles, 75); assert(Array.isArray(result.results));
 assert.deepEqual(result.results.map(project => project.project), EXPECTED_PROJECTS);
 for (const project of result.results) {
  assert(typeof project.browserVersion === 'string' && project.browserVersion);
  assert.deepEqual(project.cases.map(item => item.id), EXPECTED_CASES);
 }
 const began = Date.parse(result.startedAt), completed = Date.parse(result.completedAt);
 assert(Number.isFinite(began) && Number.isFinite(completed) && began >= Date.parse(startedAt) && completed >= began && completed <= Date.now());
 const resultBefore = await json(join(consumerOut, 'runtime-before.json'));
 assert.equal(resultBefore.baseURL, url.origin); assert.equal(resultBefore.snapshot, relative(ROOT, snapshot));
 assert.deepEqual(resultBefore.files, snapshotBefore, 'Consumer HTTP binding differs from the wrapper snapshot');
 assert.deepEqual(await directoryHash(join(consumerOut, 'runtime')), snapshotBefore, 'Archived HTTP runtime differs from the intended snapshot');
 assert.deepEqual(await fileHash(join(consumerOut, 'guidance-consumers.mjs')), {sha256: consumerIdentity.sha256, bytes: consumerIdentity.bytes});
 const artifactIndex = await json(join(consumerOut, 'artifact-index.json'));
 assert.equal(artifactIndex.excludes, 'This artifact-index.json only.');
 assert.deepEqual(Object.keys(artifactIndex.files).sort(), files.filter(name => name !== 'artifact-index.json').sort(), 'Consumer artifact index omits or adds files');
 const outputFiles = {};
 for (const [name, identity] of Object.entries(artifactIndex.files)) {
  const actual = await fileHash(within(consumerOut, name)); assert.deepEqual(actual, identity, 'Consumer artifact changed: ' + name); outputFiles[name] = actual;
 }
 outputFiles['artifact-index.json'] = await fileHash(join(consumerOut, 'artifact-index.json'));
 assert(Array.isArray(result.inputs) && result.inputs.length === 1); assert.equal(result.inputs[0].path, HISTORICAL);
 assert.equal(result.inputs[0].sha256, before.sourceHashes[HISTORICAL].sha256);
 assert.deepEqual(await fileHash(join(consumerOut, 'historical-complete210.json')), before.sourceHashes[HISTORICAL]);
 const sdk = await import(pathToFileURL(join(snapshot, 'sword-led-v4.js')).href);
 const stateOccurrences = [], stateByFile = new Map(), uniqueStates = new Set();
 function inspect(value, file, pointer = '') {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && ('journal' in value || value.rulesVersion === 'forge-v4' && ('runId' in value || 'rng' in value))) {
   const parsed = sdk.validateRun(value); assert(parsed.ok, `Invalid output state ${file}#${pointer}: ${parsed.detail}`); assert.deepEqual(parsed.state, value);
   const identity = sha(JSON.stringify(value)); uniqueStates.add(identity);
   const observation = {file, pointer: pointer || '/', sha256: identity, day: value.day, phase: value.phase, revision: value.revision};
   stateOccurrences.push(observation); if (!stateByFile.has(file)) stateByFile.set(file, []); stateByFile.get(file).push(observation);
   return;
  }
  for (const [key, childValue] of Object.entries(value)) inspect(childValue, file, pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));
 }
 for (const name of files.filter(name => name.endsWith('.json'))) inspect(await json(join(consumerOut, name)), name);
 const stateIndex = await json(join(consumerOut, 'states-index.json')); assert(Array.isArray(stateIndex) && stateIndex.length > 0);
 const labels = new Set();
 for (const entry of stateIndex) {
  assert(typeof entry.label === 'string' && /^[A-Za-z0-9_-]+$/.test(entry.label) && !labels.has(entry.label)); labels.add(entry.label);
  const name = 'states/' + entry.label + '.json', saved = await json(join(consumerOut, name)), observations = stateByFile.get(name);
  assert.equal(saved.scope, entry.scope); assert.equal(observations?.length, 1); assert.equal(observations[0].pointer, '/state');
  for (const key of ['sha256', 'day', 'phase', 'revision']) assert.deepEqual(observations[0][key], entry[key]);
 }
 assert.deepEqual(files.filter(name => name.startsWith('states/')).sort(), [...labels].map(label => 'states/' + label + '.json').sort(), 'A state document is missing from its index');
 assert.equal(stateByFile.get('historical-complete210.json')?.length, 1, 'Historical source must be explicitly included in output-state validation');
 assert(stateOccurrences.length >= stateIndex.length + 1);
 const httpFiles = {};
 for (const [name, identity] of Object.entries(snapshotBefore)) {
  const response = await fetch(new URL(name, url), {redirect: 'error', signal: AbortSignal.timeout(15_000)});
  assert.equal(response.status, 200, 'Post-consumer HTTP status: ' + name);
  const bytes = Buffer.from(await response.arrayBuffer()), actual = {sha256: sha(bytes), bytes: bytes.length};
  assert.deepEqual(actual, identity, 'Post-consumer HTTP runtime changed: ' + name); httpFiles[name] = actual;
 }
 return {projects: 6, targetedCases: 42, errors: [], validatedOutputStateOccurrences: stateOccurrences.length, uniqueValidatedFullStates: uniqueStates.size,
  indexedStateDocuments: stateIndex.length, historicalSourceStateDocuments: 1, states: stateOccurrences, postConsumerHttpFiles: httpFiles,
  outputFiles,
  resultSha256: (await fileHash(join(consumerOut, 'result.json'))).sha256, consumerArtifactIndex: await fileHash(join(consumerOut, 'artifact-index.json')),
  scope: 'Each listed JSON RunState was replayed once here with the snapshot SDK. Repeated copies count as separate output documents; unique state hashes are reported separately. These are targeted consumer states, not a third full model replay.'};
}

try {
 await write('wrapper-start.json', {...baseReceipt, validationComplete: false, scope: 'Actual wrapper start before input capture; child has not been forked.'});
 await writeFile(join(receiptOut, 'wrapper-source.mjs'), wrapperBytes, {flag: 'wx'});
 await writeFile(join(receiptOut, 'consumer-source.mjs'), consumerBytes, {flag: 'wx'});
 before = await captureFingerprint(ROOT, extras); await write('before.json', before);
 assert.deepEqual(before.sourceHashes[wrapperIdentity.path], {sha256: wrapperIdentity.sha256, bytes: wrapperIdentity.bytes});
 assert.deepEqual(before.sourceHashes[consumerIdentity.path], {sha256: consumerIdentity.sha256, bytes: consumerIdentity.bytes});
 snapshotBefore = await directoryHash(snapshot); assert.equal(Object.keys(snapshotBefore).length, 75);
 const distFiles = Object.fromEntries(Object.entries(before.buildFiles).map(([name, identity]) => [name.slice('dist/'.length), identity]));
 assert.deepEqual(snapshotBefore, distFiles, 'Snapshot must exactly match the complete current dist build');
 await write('snapshot-before.json', {at: iso(), path: relative(ROOT, snapshot), files: snapshotBefore});
 await write('inputs-frozen.json', {at: iso(), token, wrapper: wrapperIdentity, consumer: consumerIdentity, sourceFiles: Object.keys(before.sourceHashes).length,
  runtimeFiles: Object.keys(before.buildFiles).length, snapshotFiles: Object.keys(snapshotBefore).length, beforeSha256: (await fileHash(join(receiptOut, 'before.json'))).sha256});
 assert.deepEqual(signals, [], 'Interrupted wrapper must not start a new child');
 rawLog = await open(join(receiptOut, 'console.log'), 'wx');
 child = fork(consumer, command.slice(2), {cwd: ROOT, execArgv: [], stdio: ['ignore', rawLog.fd, rawLog.fd, 'ipc']});
 childClosed = new Promise(resolveClosed => {
  child.once('error', error => {spawnError = errorText(error);});
  child.once('close', (exitCode, signal) => resolveClosed({exitCode, signal, closedAt: iso(), spawnError}));
 });
 await write('start.json', {...baseReceipt, childPid: child.pid ?? null, forkedAt: iso(), validationComplete: false});
 childTerminal = await childClosed; await rawLog.close(); rawLog = null;
 assert.equal(spawnError, null, 'Consumer fork error: ' + spawnError); assert(Number.isSafeInteger(child.pid) && child.pid > 0);
 assert.equal(childTerminal.exitCode, 0, 'Consumer actual child exit must be zero'); assert.equal(childTerminal.signal, null);
 assert.deepEqual(signals, [], 'Interrupted consumer is not a completed validation');
 validation = await validateOutputs();
 await write('output-validation.json', {validationComplete: false, childValidationPassed: true, ...validation,
  note: 'Final wrapper completion still requires the after-source/snapshot/tool fingerprints and terminal receipt.'});
} catch (error) {
 failures.push(errorText(error));
} finally {
 // A failed start/receipt write must not abandon a live child or pretend that it has terminated.
 if (child && !childTerminal) {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  assert(childClosed, 'Actual child close observer missing'); childTerminal = await childClosed;
 }
 if (rawLog) await rawLog.close().catch(error => failures.push(errorText(error)));
 try {after = await captureFingerprint(ROOT, extras); await write('after.json', after);} catch (error) {failures.push(errorText(error));}
 try {snapshotAfter = await directoryHash(snapshot); await write('snapshot-after.json', {at: iso(), path: relative(ROOT, snapshot), files: snapshotAfter});
  assert.deepEqual(snapshotAfter, snapshotBefore, 'Snapshot changed during consumer execution');
 } catch (error) {failures.push(errorText(error));}
 try {assert(before && after, 'Complete before/after source fingerprints required'); assert.deepEqual(changedInputs(before, after), [], 'Source/dist/tool/extra input drift');
  assert.deepEqual(await fileHash(SELF), {sha256: wrapperIdentity.sha256, bytes: wrapperIdentity.bytes});
  assert.deepEqual(await fileHash(consumer), {sha256: consumerIdentity.sha256, bytes: consumerIdentity.bytes});
 } catch (error) {failures.push(errorText(error));}
 if (validation) {
  try {assert.deepEqual(await directoryHash(consumerOut), validation.outputFiles, 'Consumer state or artifact bytes changed during wrapper validation');}
  catch (error) {failures.push(errorText(error));}
 }
 const valid = failures.length === 0 && signals.length === 0 && !!validation && childTerminal?.exitCode === 0 && childTerminal.signal === null && spawnError === null;
 const terminal = {...baseReceipt, childPid: child?.pid ?? null, finishedAt: iso(), childTerminal, signals, spawnError,
  validationComplete: valid, changedInputs: before && after ? changedInputs(before, after) : null, failures,
  projects: validation?.projects ?? null, targetedCases: validation?.targetedCases ?? null, errors: result?.errors ?? null,
  validatedOutputStateOccurrences: validation?.validatedOutputStateOccurrences ?? 0, uniqueValidatedFullStates: validation?.uniqueValidatedFullStates ?? 0,
  indexedStateDocuments: validation?.indexedStateDocuments ?? 0, consumerResult: relative(ROOT, join(consumerOut, 'result.json'))};
 assert(!finalized); finalized = true;
 await write('terminal.json', terminal);
 for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
 console.log(JSON.stringify(terminal)); process.exitCode = valid ? 0 : 1;
}
