import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { constants } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import assert from 'node:assert/strict';

const argv = process.argv.slice(2);
const options = {};
for (let i = 0; i < argv.length; i += 2) {
  if (!['--out', '--stage'].includes(argv[i]) || !argv[i + 1] || options[argv[i]]) throw new Error('Use --out <new directory> [--stage T08|T09|T10]');
  options[argv[i]] = argv[i + 1];
}
const stage = options['--stage'] ?? 'T08';assert.ok(['T08', 'T09', 'T10'].includes(stage));
const out = resolve(options['--out'] ?? `docs/evidence/${stage}`);
const sha = value => createHash('sha256').update(value).digest('hex');
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const units = await readJSON('test-results/unit-report.json');
assert.equal(units.success, true);assert.equal(units.numFailedTests, 0);assert.equal(units.numPendingTests, 0);
assert.equal(units.numPassedTests, units.numTotalTests);
const reports = { ui: await readJSON('test-results/ui-report.json'), storage: await readJSON('test-results/storage-report.json') };
const attachments = {}, cases = {}, runtimeAudits = [];
await mkdir(out, { recursive: true });
async function save(name, value) {
  const target = join(out, name);await mkdir(resolve(target, '..'), { recursive: true });
  await writeFile(target, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
for (const [kind, report] of Object.entries(reports)) {
  assert.equal(report.stats.unexpected, 0);assert.equal(report.stats.skipped, 0);assert.equal(report.stats.flaky, 0);assert.deepEqual(report.errors, []);
  cases[kind] = [];
  const used = new Set();
  async function collect(suites, parents = []) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) for (const test of spec.tests) {
        const result = test.results.at(-1);assert.equal(result.status, 'passed');assert.deepEqual(result.errors, []);
        const name = [...parents, suite.title, spec.title].filter(Boolean).join(' / ');
        cases[kind].push({ name, project: test.projectName, durationMs: result.duration, status: result.status });
        for (const attachment of result.attachments ?? []) {
          if (attachment.name === 'runtime-audit' && attachment.body) runtimeAudits.push({ case: name, ...JSON.parse(Buffer.from(attachment.body, 'base64').toString()) });
          if (!attachment.path && (!attachment.body || attachment.name === 'runtime-audit')) continue;
          const bytes = attachment.path ? await readFile(attachment.path) : Buffer.from(attachment.body, 'base64');
          const extension = attachment.path ? extname(attachment.path) : attachment.contentType === 'application/json' ? '.json' : '.bin';
          let stem = attachment.name.replace(/[^a-zA-Z0-9-]/g, '-');
          while (used.has(`${stem}${extension}`)) stem += '-copy';used.add(`${stem}${extension}`);
          const destination = `${kind}/${stem}${extension}`;
          await mkdir(join(out, kind), { recursive: true });
          if (attachment.path) await copyFile(attachment.path, join(out, destination), constants.COPYFILE_EXCL);
          else await writeFile(join(out, destination), bytes, { flag: 'wx' });
          attachments[`${kind}/${attachment.name}`] = { file: destination, sha256: sha(bytes), bytes: bytes.length };
          attachment.path = destination;
        }
      }
      await collect(suite.suites ?? [], [...parents, suite.title]);
    }
  }
  await collect(report.suites);assert.equal(cases[kind].length, report.stats.expected);
  await save(`${kind}-report.json`, report);
}
await save('unit-report.json', units);await save('runtime-audits.json', runtimeAudits);
assert.ok(runtimeAudits.every(audit => audit.errors.length === 0));
const files = ['index.html', 'vite.config.ts', 'vite.sdk.config.ts', 'package.json', 'package-lock.json',
  'tsconfig.app.json', 'tsconfig.node.json', 'playwright.config.ts', 'playwright.ui.config.ts'];
async function sources(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);if (entry.isDirectory()) await sources(path);
    else if (/\.(ts|mjs|css|html)$/.test(path)) files.push(path);
  }
}
for (const folder of ['src', 'tests/core', 'tests/e2e', 'tests/browser', 'tests/support']) await sources(folder);
files.push('scripts/collect-ui-evidence.mjs');
const sourceHashes = Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await readFile(file))])));
const built = [];
async function builds(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);if (entry.isDirectory()) await builds(path);else built.push(path);
  }
}
await builds('dist');
const buildFiles = Object.fromEntries(await Promise.all(built.sort().map(async file => {
  const bytes = await readFile(file);
  if (file.endsWith('.js')) for (const forbidden of ['artPreview', 'uiSaveFault', 'nativeInputProbe', 'forceVictory', 'audioTestProbe', 'settingsFail', 'carryFail', 'frameTestProbe', 'keyboardPointerCount']) assert.ok(!bytes.toString().includes(forbidden), `${forbidden} leaked into production`);
  return [relative('dist', file), { bytes: bytes.length, sha256: sha(bytes), ...(/\.(js|css)$/.test(file) ? { gzipBytes: gzipSync(bytes).length } : {}) }];
})));
const previousSDK = (await readJSON('docs/evidence/T06/native-bfcache.json')).buildSha256;
const sdkMatchesT06 = Object.entries(previousSDK).every(([name, hash]) => buildFiles[name]?.sha256 === hash);
if (stage === 'T08') assert.equal(sdkMatchesT06, true);
// Fresh storage evidence must name these exact SDK bytes, including a changed public read-only API.
const nativeEvidence = attachments['storage/native-bfcache-evidence'];assert.ok(nativeEvidence);
const currentSDK = (await readJSON(join(out, nativeEvidence.file))).buildSha256;
for (const [name, hash] of Object.entries(currentSDK)) assert.equal(buildFiles[name]?.sha256, hash);
assert.ok(Object.keys(currentSDK).length >= 3);
const t09 = stage === 'T10' ? (await readJSON('docs/evidence/T09/summary.json')).buildFiles : null;
const sdkMatchesT09 = t09 ? Object.keys(currentSDK).every(name => t09[name]?.sha256 === buildFiles[name]?.sha256) : null;
if (stage === 'T10') assert.equal(sdkMatchesT09, true);
const art = await readJSON('public/assets/b/manifest.json');
assert.equal(buildFiles['assets/b/manifest.json']?.sha256, sha(await readFile('public/assets/b/manifest.json')));
assert.equal(buildFiles['assets/b/tokens.css']?.sha256, sha(await readFile('public/assets/b/tokens.css')));
const runtimeImageBytes = art.assets.reduce((sum, asset) => sum + asset.bytes, 0);
assert.ok(runtimeImageBytes <= 3 * 1024 * 1024);
for (const asset of art.assets) assert.equal(buildFiles[asset.src.slice(1)]?.sha256, asset.sha256);
await save('summary.json', { recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`,
  rulesVersion: 'forge-v1', stage: stage === 'T10' ? 'T10 audio, settings, recovery, keyboard and measured callback budget; broad browser/H/R4 acceptance remains T11–T12' : stage === 'T09' ? 'T09 full contract flow and R3; audio/settings and final acceptance remain T10–T12' : 'T08 workshop and entry; full business/ending review remains T09',
  units: { files: units.testResults.length, passed: units.numPassedTests },
  ui: { passed: cases.ui.length, cases: cases.ui }, storage: { passed: cases.storage.length, cases: cases.storage },
  sdkMatchesT06, sdkMatchesT09, sdkVerifiedCurrent: true, runtimeImages: art.assets.length, runtimeImageBytes, attachments, sourceHashes, buildFiles });
console.log(JSON.stringify({ out, unitPassed: units.numPassedTests, uiPassed: cases.ui.length, storagePassed: cases.storage.length, attachments: Object.keys(attachments).length, sdkMatchesT06 }));
