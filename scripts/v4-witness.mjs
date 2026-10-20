import assert from 'node:assert/strict';
import{mkdir,writeFile,readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import * as kernel from '../dist/sword-led-v4.js';
import{playV4}from'../tmp/v4-witness-build/scripts/v4-policy.js';
const out=process.argv[2];if(!out)throw Error('Use node scripts/v4-witness.mjs <new-output-directory>');await mkdir(out,{recursive:false});
const attempts=[];let winner=null;
for(let i=0;i<64&&!winner;i++){
 const seed=`lantern-witness-${i}`,run=playV4(kernel,{runId:`v4-witness-${i}`,seed});const checked=kernel.validateRun(run.state);assert(checked.ok);assert.deepEqual(checked.state,run.state);attempts.push({seed,phase:run.state.phase,days:run.state.history.length,met:run.state.history.filter(h=>h.met).length,commands:run.commands});if(run.state.phase==='victory')winner={seed,run};
}
await writeFile(out+'/attempts.json',JSON.stringify(attempts,null,2)+'\n',{flag:'wx'});if(!winner)throw Error('No genuine victory in bounded visible-information attempts');
const witnesses=[];
for(const plan of ['complete','return','defeat','chapter-defeat']){
 const run=plan==='complete'?winner.run:playV4(kernel,{runId:`v4-${plan}`,seed:winner.seed},plan);const checked=kernel.validateRun(run.state);assert(checked.ok);assert.deepEqual(checked.state,run.state);const expected=plan==='complete'?'victory':plan==='return'?'return':'defeat';assert.equal(run.state.phase,expected);if(plan==='chapter-defeat')assert(kernel.getCollectionAwards(run.state).recipes.includes('guard'));await writeFile(`${out}/${plan}.json`,JSON.stringify(run.state,null,2)+'\n',{flag:'wx'});await writeFile(`${out}/${plan}-commands.json`,JSON.stringify(run.transitions,null,2)+'\n',{flag:'wx'});witnesses.push({plan,phase:run.state.phase,commands:run.commands,days:run.state.day,met:run.state.history.filter(h=>h.met).length,awards:kernel.getCollectionAwards(run.state)});
}
const eligibility=kernel.getCollectionAwards(winner.run.state),challenge=playV4(kernel,{runId:'v4-challenge',seed:winner.seed,mode:'challenge',eligibility:{recipes:eligibility.recipes,challenge:eligibility.challenge}});assert(kernel.validateRun(challenge.state).ok);await writeFile(out+'/challenge.json',JSON.stringify(challenge.state,null,2)+'\n',{flag:'wx'});
const eventExamples=new Map(),eventTrials=[];
function replayStart(s){const r=kernel.createRun({runId:s.runId,seed:s.seed,mode:s.mode,eligibility:s.initialEligibility});assert(r.ok);return r.state;}
for(let i=0;i<32&&eventExamples.size<6;i++){
 const played=i===0?winner.run:playV4(kernel,{runId:`v4-event-${i}`,seed:`lantern-events-${i}`});assert(kernel.validateRun(played.state).ok);eventTrials.push({seed:played.state.seed,phase:played.state.phase,accepted:played.state.eventHistory.filter(e=>e.choice==='accept').map(e=>e.id)});let before=replayStart(played.state);
 for(const action of played.state.journal){const r=kernel.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(r.ok);if(action.type==='chooseEvent'&&action.choice==='accept'&&!eventExamples.has(before.eventId)){const id=before.eventId;assert(id);const record=r.state.eventHistory.at(-1);assert.equal(r.state.coins-before.coins,record.coins);assert(kernel.validateRun(before).ok);assert(kernel.validateRun(r.state).ok);await writeFile(`${out}/event-${id}.json`,JSON.stringify({before,action,events:r.events,after:r.state},null,2)+'\n',{flag:'wx'});eventExamples.set(id,{id,seed:before.seed,day:before.day,coins:record.coins,revision:r.state.revision});}before=r.state;}
}
assert.equal(eventExamples.size,6,'All six authored events must have a genuine accepted example');
let warmExample=null;
for(let i=0;i<16&&!warmExample;i++){
 const played=playV4(kernel,{runId:`v4-warm-${i}`,seed:i===0?winner.seed:`lantern-warm-${i}`},'complete','warmRack');assert(kernel.validateRun(played.state).ok);let before=replayStart(played.state);
 for(const action of played.state.journal){const r=kernel.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(r.ok);if(action.type==='advance'&&before.day===4&&before.reserveId){const b=before.blades.find(b=>b.id===before.reserveId),after=r.state.blades.find(candidate=>candidate.id===b.id);assert.equal(after.value,kernel.percent(b.value,115));assert.equal(after.cracked,b.cracked);assert.equal(after.charge,b.charge);warmExample={before,action,after:r.state};await writeFile(out+'/warm-rack.json',JSON.stringify(warmExample,null,2)+'\n',{flag:'wx'});break;}before=r.state;}
}
assert(warmExample,'A genuine reserved blade must cross a chapter with warm rack');
await writeFile(out+'/event-trials.json',JSON.stringify(eventTrials,null,2)+'\n',{flag:'wx'});
const bytes=await readFile('dist/sword-led-v4.js');const result={at:new Date().toISOString(),scope:'Bounded visible-information command witnesses through compiled public SDK; not1000-seed balance or real UI/human gameplay.',sdkSha256:createHash('sha256').update(bytes).digest('hex'),attempts:attempts.length,winnerSeed:winner.seed,witnesses,eventExamples:[...eventExamples.values()],eventTrialCount:eventTrials.length,warmRackCrossing:true,challenge:{phase:challenge.state.phase,commands:challenge.commands,order:challenge.state.commissionOrder}};await writeFile(out+'/summary.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({winnerSeed:winner.seed,attempts:attempts.length,witnesses:witnesses.map(w=>({plan:w.plan,phase:w.phase,commands:w.commands})),challenge:challenge.state.phase}));
