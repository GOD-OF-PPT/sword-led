import assert from'node:assert/strict';
import{mkdir,writeFile}from'node:fs/promises';
import * as kernel from'../dist/sword-led-v4.js';
const out=process.argv[2];if(!out)throw Error('Provide a new output directory');await mkdir(out,{recursive:false});
const made=kernel.createRun({runId:'v4-real-soft-cap',seed:'soft-cap'});assert(made.ok);let s=made.state;
function send(action){const r=kernel.applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});assert(r.ok,r.error);s=r.state;}
send({type:'continue'});
while(s.journal.length<kernel.JOURNAL_SOFT_LIMIT)send({type:'reserve',pieceId:'d1-1'});
const atLimit=s,denied=kernel.applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action:{type:'strike',pieceId:'d1-1'}});assert.equal(denied.ok,false);assert.equal(denied.error,'record_limit');assert.equal(denied.state,s);assert.deepEqual(denied.events,[]);assert.equal(s.rng.forge.draws,0);
if(s.reserveId)send({type:'reserve',pieceId:s.reserveId});
while(s.phase!=='defeat'){
 if(s.phase==='summary'){send({type:'advance'});continue;}
 for(const b of s.blades.filter(b=>b.status==='active'&&b.id!==s.reserveId))send({type:'deliver',pieceId:b.id});
 send({type:'settle'});
}
for(const state of[atLimit,s]){const r=kernel.validateRun(state);assert(r.ok);assert.deepEqual(r.state,state);}
assert(s.journal.length<kernel.JOURNAL_LIMIT);await writeFile(out+'/at-limit.json',JSON.stringify(atLimit,null,2)+'\n',{flag:'wx'});await writeFile(out+'/exit.json',JSON.stringify(s,null,2)+'\n',{flag:'wx'});await writeFile(out+'/summary.json',JSON.stringify({at:new Date().toISOString(),scope:'Actual accepted reserve toggles and disposition/settlement exits, not an injected journal',softLimit:atLimit.journal.length,exitCommands:s.journal.length,phase:s.phase,day:s.day,forgeDraws:s.rng.forge.draws,allReplayed:true},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({softLimit:atLimit.journal.length,exitCommands:s.journal.length,phase:s.phase}));
