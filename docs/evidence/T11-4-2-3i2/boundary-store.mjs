import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const sdk=await import(pathToFileURL(resolve('dist/sword-led-v4.js')).href),out=process.argv[2];
if(!out)throw Error('Provide a new output directory');fs.mkdirSync(out);
const initial=JSON.parse(fs.readFileSync('docs/evidence/T11-4-2-3i1/boundaries/at-limit.json'));
assert(sdk.validateRun(initial).ok);const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const repo=sdk.createV4SaveRepository(()=>store);repo.load();assert(repo.write(initial).ok);
let held=false,release;const lease={acquire:async()=>{held=true;return 'writer';},owns:()=>held,release:async()=>{held=false;release?.();},dispose:async()=>{held=false;}};
let session=sdk.createV4Session(repo,lease,sdk.createCollectionRepository(()=>store));await session.activate();
assert.deepEqual(session.getSnapshot().state,initial);const originalBytes=data.get(sdk.V4_SAVE_KEY),denied=session.dispatch({runId:initial.runId,expectedRevision:initial.revision,action:{type:'strike',pieceId:'d1-1'}},session.getSnapshot().generation);assert(!denied.ok);assert.equal(denied.error,'record_limit');assert.equal(data.get(sdk.V4_SAVE_KEY),originalBytes);
function send(action){const snap=session.getSnapshot(),s=snap.state,r=session.dispatch({runId:s.runId,expectedRevision:s.revision,action},snap.generation);assert(r.ok,r.error);assert(r.persistence?.ok);}
if(initial.reserveId)send({type:'reserve',pieceId:initial.reserveId});
while(session.getSnapshot().state.phase!=='defeat'){const s=session.getSnapshot().state;if(s.phase==='summary'){send({type:'advance'});continue;}for(const b of s.blades.filter(b=>b.status==='active'&&b.id!==s.reserveId))send({type:'deliver',pieceId:b.id});send({type:'settle'});}
const exit=session.getSnapshot().state,raw=data.get(sdk.V4_SAVE_KEY);assert.equal(exit.journal.length,1915);assert(sdk.validateRun(exit).ok);await session.dispose();
session=sdk.createV4Session(sdk.createV4SaveRepository(()=>store),lease,sdk.createCollectionRepository(()=>store));await session.activate();assert.deepEqual(session.getSnapshot().state,exit);assert.equal(data.get(sdk.V4_SAVE_KEY),raw);assert.deepEqual(session.getCollectionSnapshot().data,sdk.emptyCollection());await session.dispose();
const summary={at:new Date().toISOString(),initialCommands:1900,exitCommands:1915,initialEnvelopeBytes:Buffer.byteLength(originalBytes),finalEnvelopeBytes:Buffer.byteLength(raw),phase:exit.phase,exactRestore:true,allAcceptedSaves:true,permanentCollectionEmpty:true};
fs.writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(out+'/exit.json',JSON.stringify(exit,null,2)+'\n');console.log(JSON.stringify(summary));
