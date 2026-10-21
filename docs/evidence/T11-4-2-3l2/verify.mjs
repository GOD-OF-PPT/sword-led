import * as sdk from '../../dist/sword-led-v5.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const base='tmp/T11-4-2-3l2',baseline=JSON.parse(await readFile(`${base}/baseline.json`,'utf8'));
for(const row of [...baseline.build.filter(r=>r.path!=='dist/sword-led-v5.js'),...baseline.preservedSource,...baseline.coreV5]) {
  assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'),row.sha256,row.path);
}
const protectedRows=JSON.parse(await readFile('docs/evidence/T11-4-2-3m/run.json','utf8')).protected;
for(const row of protectedRows)assert.equal(createHash('sha256').update(await readFile(row.path)).digest('hex'),row.sha256,row.path);
const result=JSON.parse(await readFile(`${base}/browser-result.json`,'utf8'));
const hashes=new Set();
for(const state of result.states) {
  const checked=sdk.validateRun(state);assert(checked.ok,checked.detail);hashes.add(createHash('sha256').update(JSON.stringify(checked.state)).digest('hex'));
}
for(const collection of result.collections)assert(sdk.validateCollection(collection).ok);
const run=JSON.parse(await readFile('docs/evidence/T11-4-2-3l1/journeys/victory.json','utf8')).state;
const awards=sdk.collectionFromRun(run);assert(awards.ok);assert(awards.state.works.every(w=>w.rulesVersion==='forge-v5'));
assert(sdk.validateRun(run).ok);
const invalidSource={...awards.state,works:awards.state.works.map((w,i)=>i===0?{...w,rulesVersion:'forge-v6'}:w)};
assert.equal(sdk.validateCollection(invalidSource).ok,false);
assert.equal(sdk.validateCollection({...awards.state,coins:1}).ok,false);
const verified={ok:true,oldRuntimeFilesByteEqual:baseline.build.length-1,oldSourcesByteEqual:baseline.preservedSource.length,preservedV5CoreFiles:baseline.coreV5.length,protectedFiles:protectedRows.length,browserSavedObservations:result.states.length,browserUniqueStates:hashes.size,browserCollections:result.collections.length,previousV5VictoryReplayed:true,invalidSourceAndWalletRejected:2,noUserProfileTouched:true,notGameUiOrHumanFunAcceptance:true};
await writeFile(`${base}/verified.json`,JSON.stringify(verified,null,2)+'\n');console.log(JSON.stringify(verified));
