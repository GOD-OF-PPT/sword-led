import * as v5 from '../../dist/sword-led-v5.js';
import * as v4 from '../../dist/sword-led-v4.js';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['journeys/victory.json', 'journeys/return.json', 'journeys/defeat.json', 'old-route.json'];
const base = 'tmp/T11-4-2-3l1', unique = new Map(); let observations = 0;
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.rulesVersion === 'forge-v5') {
    const result = v5.validateRun(value); assert(result.ok, result.detail);
    const hash = createHash('sha256').update(JSON.stringify(result.state)).digest('hex');
    observations++; unique.set(hash, result.state); return;
  }
  for (const item of Object.values(value)) walk(item);
}
for (const file of files) walk(JSON.parse(await readFile(`${base}/${file}`, 'utf8')));
const victory = JSON.parse(await readFile(`${base}/journeys/victory.json`, 'utf8')).state;
assert.equal(victory.rulesVersion, 'forge-v5');
assert.equal(v4.validateRun(victory).ok, false);
for (const patch of [{ marketSpent: victory.marketSpent + 1 }, { coins: victory.coins + 1 }, { rulesVersion: 'forge-v4' }]) {
  assert.equal(v5.validateRun({ ...victory, ...patch }).ok, false);
}
const old = JSON.parse(await readFile('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json', 'utf8'));
assert(v4.validateRun(old).ok); assert.equal(v5.validateRun(old).ok, false);
const before = unique.values().next().value;
for (const identity of [{ runId: 'wrong', expectedRevision: before.revision }, { runId: before.runId, expectedRevision: before.revision + 1 }]) {
  const result = v5.applyCommand(before, { ...identity, action: { type: 'settle' } });
  assert(!result.ok); assert.equal(result.state, before); assert.deepEqual(result.events, []);
}
for (const key of ['COMMISSIONS', 'RECIPES', 'MERCHANTS', 'EVENTS', 'MODIFICATIONS', 'ENDINGS', 'TRAITS']) assert.deepEqual(v5[key], v4[key]);
const baseline = JSON.parse(await readFile(`${base}/baseline.json`, 'utf8'));
for (const row of [...baseline.build, ...baseline.oldSource]) {
  assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'), row.sha256, row.path);
}
const protectedRows = JSON.parse(await readFile('docs/evidence/T11-4-2-3m/run.json', 'utf8')).protected;
for (const row of protectedRows) assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'), row.sha256, row.path);
const result = { ok: true, savedObservations: observations, uniqueStates: unique.size, stateHashes: [...unique.keys()], oldRuntimeFilesByteEqual: baseline.build.length, oldSourcesByteEqual: baseline.oldSource.length, protectedFilesByteEqual: protectedRows.length, unchangedContentGroups: 7, tamperRejections: 3, wrongIdentityRejections: 2, oldV4ReplayStillValid: true, crossRulesRejectedBothWays: true, notBrowserOrFunAcceptance: true };
await writeFile(`${base}/verified.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, stateHashes: undefined }));
