import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,DIRECTED,choose,run,verifyHistoricalDependencies} from '../../scripts/v3-directed.mjs';
import {observe} from '../../scripts/v3-model-policy.mjs';
test('directed profiles use genuine commands, stop and replay deterministically',()=>{
 assert.equal(new Set(DIRECTED.map(p=>p.id)).size,9);
 for(const p of DIRECTED){const a=evaluate(p.id,0),b=evaluate(p.id,0);assert.deepEqual(a.row,b.row);assert(['victory','defeat'].includes(a.state.phase));}
});
test('active cracked builds genuinely exercise inheritance and cracked-edge',()=>{
 for(const [id,trait]of [['aggressive-inherit','inherit'],['aggressive-edge','crackedEdge']]){let witness;
  for(let seed=0;seed<16&&!witness;seed++)witness=evaluate(id,seed).first[trait];
  assert(witness,`${id} never exercised ${trait}`);assert(witness.hit.triggers.includes(trait));
  if(trait==='crackedEdge'){assert(witness.before.blades.find(b=>b.id===witness.action.pieceId).cracked);assert.equal(witness.hit.result,'great');}
 }
});
test('high-value carry can be retrieved as soon as it covers the visible gap',()=>{
 let used=false;for(let seed=0;seed<8&&!used;seed++){const result=evaluate('carry-next',seed);used=result.row.reserveDeliveries>0;}assert(used);
 const state=evaluate('carry-next',0).state;assert(!('rng'in observe(state)));assert.equal(choose(observe(state),DIRECTED[2],{clicks:new Map(),prepared:new Set()}),null);
});
test('invalid profile/seed/CLI range cannot create a run or output',async()=>{
 for(const [id,index]of [['wrong',0],['baseline',-1],['baseline',128]])assert.throws(()=>evaluate(id,index));
 await assert.rejects(run({out:'should-not-exist',seeds:129,workers:4}));await assert.rejects(run({out:'should-not-exist',seeds:1,workers:5}));
});

test('historical model guard permits unrelated UI evolution but rejects every used source or SDK drift',()=>{
 const old={sourceHashes:{'src/core/random.ts':{sha256:'a'},'src/core-v3/game.ts':{sha256:'b'},'scripts/v3-model-policy.mjs':{sha256:'c'},'package-lock.json':{sha256:'d'},'src/presentation-v3/app.ts':{sha256:'old-ui'}},buildFiles:Object.fromEntries(Array.from({length:6},(_,i)=>[`dist/sdk-${i}.js`,{sha256:String(i)}]))};
 const current=structuredClone(old);current.sourceHashes['src/presentation-v3/app.ts'].sha256='new-ui';current.buildFiles['dist/assets/new-main.js']={sha256:'new'};assert.deepEqual(verifyHistoricalDependencies(old,current),{modelSources:4,sdkFiles:6});
 for(const file of ['src/core/random.ts','src/core-v3/game.ts','scripts/v3-model-policy.mjs','package-lock.json']){const changed=structuredClone(current);changed.sourceHashes[file].sha256='wrong';assert.throws(()=>verifyHistoricalDependencies(old,changed));}
 const changed=structuredClone(current);changed.buildFiles['dist/sdk-1.js'].sha256='wrong';assert.throws(()=>verifyHistoricalDependencies(old,changed));
});
