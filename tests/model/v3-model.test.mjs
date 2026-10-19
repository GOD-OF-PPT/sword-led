import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate,batch,partition,seedAt,runBatch} from '../../scripts/v3-model.mjs';
import {observe,decide,PROFILES} from '../../scripts/v3-model-policy.mjs';
import {auditRows,IDS} from '../../scripts/audit-v3-model.mjs';
import {createRun} from '../../dist/sword-led-v3.js';

test('visible projection excludes randomness, seed, journal and identity',()=>{
 const s=createRun({runId:'model-test',seed:'secret',roundLimit:12}).state,v=observe(s);
 for(const k of ['seed','rng','journal','revision','runId','pendingInheritance'])assert(!(k in v));
 assert(Object.isFrozen(v));assert.deepEqual(decide(v,PROFILES[0],new Map()),{type:'strike',pieceId:'r1-1'});
});
test('all profiles are enumerated independently, bounded and deterministic, with mirror probes equal',()=>{
 assert.deepEqual(PROFILES.map(p=>p.id),IDS);assert.equal(new Set(IDS).size,26);
 const rows=PROFILES.map(p=>simulate(p,0).row);auditRows(rows,1);
 for(const id of ['balanced-ember','raw','blind']){const p=PROFILES.find(p=>p.id===id);assert.deepEqual(simulate(p,0).row,rows.find(r=>r.profile===id));}
 assert.equal(seedAt(999),'v3-balance-0999');
});
test('batch rejects invalid seeds/profiles and partitions once in canonical order',async()=>{
 for(const seeds of [0,1001,1.1,NaN])assert.throws(()=>partition(seeds));
 for(const input of [{profile:'wrong',start:0,count:1},{profile:IDS[0],start:-1,count:1},{profile:IDS[0],start:999,count:2}])assert.throws(()=>batch(input));
 assert.equal(partition(26).length,52);assert.deepEqual(partition(26)[1],{profile:IDS[0],start:25,count:1});
 await assert.rejects(runBatch({seeds:1,workers:0,out:'should-not-exist'}));
});
test('row audit refuses missing, duplicate, reordered, wrong seed, fake totals and mutated probes',()=>{
 const rows=PROFILES.map(p=>simulate(p,0).row);
 for(const change of [
  r=>r.pop(),r=>{r[1]=r[0];},r=>r.reverse(),r=>{r[0].seed='wrong';},r=>{r[0].commands=-1;},
  r=>{r[0].phase='workshop';},r=>{r[0].rounds[0].quota++;},r=>{r[0].delivered++;},r=>{r[0].stateSha256='bad';},
  r=>{r.find(x=>x.profile==='balanced-reload').coins++;},r=>{r.find(x=>x.profile==='raw').round=12;},
 ]){const copy=structuredClone(rows);change(copy);assert.throws(()=>auditRows(copy,1));}
});
