import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { constants } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import assert from 'node:assert/strict';

const argv = process.argv.slice(2);
if (argv.length && (argv.length !== 2 || argv[0] !== '--out')) throw new Error('Use --out <new evidence directory>');
const out = resolve(argv[1] ?? 'docs/evidence/T08');
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
          if (!attachment.path) continue;
          const bytes = await readFile(attachment.path);
          let stem = attachment.name.replace(/[^a-zA-Z0-9-]/g, '-');
          while (used.has(`${stem}${extname(attachment.path)}`)) stem += '-copy';used.add(`${stem}${extname(attachment.path)}`);
          const destination = `${kind}/${stem}${extname(attachment.path)}`;
          await mkdir(join(out, kind), { recursive: true });
          await copyFile(attachment.path, join(out, destination), constants.COPYFILE_EXCL);
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
  if (file.endsWith('.js')) for (const forbidden of ['artPreview', 'uiSaveFault', 'nativeInputProbe', 'forceVictory']) assert.ok(!bytes.toString().includes(forbidden), `${forbidden} leaked into production`);
  return [relative('dist', file), { bytes: bytes.length, sha256: sha(bytes), ...(/\.(js|css)$/.test(file) ? { gzipBytes: gzipSync(bytes).length } : {}) }];
})));
const previousSDK = (await readJSON('docs/evidence/T06/native-bfcache.json')).buildSha256;
for (const [name, hash] of Object.entries(previousSDK)) assert.equal(buildFiles[name]?.sha256, hash);
const art = await readJSON('public/assets/b/manifest.json');
assert.equal(buildFiles['assets/b/manifest.json']?.sha256, sha(await readFile('public/assets/b/manifest.json')));
assert.equal(buildFiles['assets/b/tokens.css']?.sha256, sha(await readFile('public/assets/b/tokens.css')));
const runtimeImageBytes = art.assets.reduce((sum, asset) => sum + asset.bytes, 0);
assert.ok(runtimeImageBytes <= 3 * 1024 * 1024);
for (const asset of art.assets) assert.equal(buildFiles[asset.src.slice(1)]?.sha256, asset.sha256);
await save('summary.json', { recordedAt: new Date().toISOString(), node: process.version, platform: `${process.platform}/${process.arch}`,
  rulesVersion: 'forge-v1', stage: 'T08 workshop and entry; full business/ending review remains T09',
  units: { files: units.testResults.length, passed: units.numPassedTests },
  ui: { passed: cases.ui.length, cases: cases.ui }, storage: { passed: cases.storage.length, cases: cases.storage },
  sdkMatchesT06: true, runtimeImages: art.assets.length, runtimeImageBytes, attachments, sourceHashes, buildFiles });
console.log(JSON.stringify({ out, unitPassed: units.numPassedTests, uiPassed: cases.ui.length, storagePassed: cases.storage.length, attachments: Object.keys(attachments).length, sdkMatchesT06: true }));
