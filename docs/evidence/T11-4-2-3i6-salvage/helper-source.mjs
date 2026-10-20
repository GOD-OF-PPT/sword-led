// One explicitly directed public-API journey. It adds no case to the frozen 30,000-case experiment.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile,readdir,lstat} from 'node:fs/promises';
import {openSync,closeSync,writeFileSync,constants} from 'node:fs';
import {fork} from 'node:child_process';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const SELF=fileURLToPath(import.meta.url),ROOT=resolve(dirname(SELF),'../..');
const SNAPSHOT=resolve(ROOT,'tmp/previews/T11-4-2-3i6-guidance'),OUT=resolve(ROOT,'tmp/T11-4-2-3i6/salvage-supplement');
const TOKEN='v4-salvage-supplement-01',INPUT={runId:'guidance-salvage-3',seed:'v4-guidance-salvage-3'};
const SDK8=['browser-session-BQdQqpuu.js','core-CvAZnNjA.js','rules-CAo3EZyg.js','sword-led-core.js','sword-led-session.js','sword-led-v2.js','sword-led-v3.js','sword-led-v4.js'];
const sha=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex');
const write=async(path,value)=>writeFile(join(OUT,path),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const read=async path=>JSON.parse(await readFile(join(OUT,path),'utf8'));
async function maps(){
 const all={};async function walk(dir){for(const entry of(await readdir(join(SNAPSHOT,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert(!entry.isSymbolicLink());const p=dir?`${dir}/${entry.name}`:entry.name;if(entry.isDirectory())await walk(p);else{assert(entry.isFile());const bytes=await readFile(join(SNAPSHOT,p));all[p]={sha256:sha(bytes),bytes:bytes.length};}}}
 const info=await lstat(SNAPSHOT);assert(info.isDirectory()&&!info.isSymbolicLink());await walk('');assert.equal(Object.keys(all).length,75,'Use the exact immutable 75-file guidance snapshot');
 const sdk=Object.fromEntries(SDK8.map(path=>{assert(all[path],`Snapshot SDK file missing: ${path}`);return[path,all[path]];}));
 return{snapshot:relative(ROOT,SNAPSHOT),webBuildFiles:75,sdkFiles:8,webBuild:all,sdk};
}

async function child(){
 await new Promise((resolve,reject)=>{
  assert(process.send,'The directed child must be launched by its recording wrapper');
  process.once('message',message=>{try{assert.deepEqual(message,{go:true,token:TOKEN});resolve();}catch(error){reject(error);}});
  process.send({ready:true,token:TOKEN});
 });
 if(process.connected)process.disconnect();
 const start=await read('start.json');assert.equal(start.childPid,process.pid);assert.equal(start.token,TOKEN);
 const before=await maps();assert.deepEqual(before,await read('snapshot-before.json'));assert.equal(sha(await readFile(SELF)),start.sourceSha256);
 await write('child-snapshot-before.json',before);await mkdir(join(OUT,'states'),{recursive:false});
 const api=await import(pathToFileURL(join(SNAPSHOT,'sword-led-v4.js')).href);
 const made=api.createRun(INPUT);assert(made.ok,made.error);let state=made.state;
 const transitions=[],rejections=[],validations=[];
 function validate(label,value){const checked=api.validateRun(value);assert(checked.ok,checked.detail);assert.deepEqual(checked.state,value);validations.push({label,revision:value.revision,phase:value.phase,stateSha256:sha(value)});}
 const path=revision=>`states/revision-${String(revision).padStart(4,'0')}.json`;
 validate('created',state);assert.equal(state.rulesVersion,'forge-v4');assert.equal(state.phase,'opening');assert.equal(state.coins,0);assert.equal(state.seals,3);assert.deepEqual(state.initialEligibility,{recipes:['light'],challenge:false});
 await write('created.json',{input:INPUT,result:made});await write(path(0),state);
 async function send(label,action){
  const before=state,command={runId:state.runId,expectedRevision:state.revision,action},result=api.applyCommand(state,command);assert(result.ok,`${label}: ${result.error}`);state=result.state;validate(label,state);
  transitions.push({label,command,before,result});await write(path(state.revision),state);return{before,command,result};
 }
 await send('open',{type:'continue'});
 await send('day-one-empty-settlement',{type:'settle'});assert.equal(state.coins,30);assert.equal(state.seals,2);
 await send('day-two',{type:'advance'});
 await send('day-two-empty-settlement',{type:'settle'});assert.equal(state.coins,60);assert.equal(state.seals,1);
 await send('day-three',{type:'advance'});
 assert.equal(state.revision,5);assert.equal(state.day,3);assert.equal(state.phase,'workshop');assert.equal(state.coins,60);assert.equal(state.seals,1);assert.equal(state.eventId,'salvage');assert.equal(state.eventStatus,'available');assert.equal(state.eventHistory.length,0);
 const blade=state.blades.find(b=>b.id==='d3-1');assert(blade);assert.equal(blade.status,'active');assert.equal(blade.value,40);assert.equal(blade.base,40);assert.equal(blade.hits,0);
 await send('reserve-an-actual-forty-value-blank',{type:'reserve',pieceId:blade.id});assert.equal(state.reserveId,blade.id);assert.equal(state.coins,60);
 const quote=api.eventQuote(state,blade.id),view=api.getRunView(state);assert.equal(view.event.id,'salvage');assert.equal(view.event.status,'available');assert.deepEqual(quote,{eventId:'salvage',cost:0,requiresPiece:'reserve',allowed:true,error:null});
 const accepted=await send('accept-actual-salvage',{type:'chooseEvent',choice:'accept',pieceId:blade.id});
 assert.equal(state.revision,7);assert.equal(state.coins,220);assert.equal(state.coins-accepted.before.coins,160);assert.equal(state.reserveId,null);assert.equal(state.eventStatus,'accepted');assert.equal(state.eventHistory.length,1);
 assert.deepEqual(state.eventHistory[0],{day:3,id:'salvage',choice:'accept',pieceId:blade.id,coins:160});
 const bartered=state.blades.find(b=>b.id===blade.id);assert.equal(bartered.status,'bartered');assert.equal(bartered.finalizedDay,3);assert.equal(bartered.commissionId,null);assert.equal(bartered.value,40);
 assert.deepEqual(state.blades.filter(b=>b.id!==blade.id),accepted.before.blades.filter(b=>b.id!==blade.id),'Salvage changed a different piece');assert.equal(state.blades.filter(b=>b.status==='bartered').length,1);assert.equal(state.daySales,0);assert.equal(state.dayRecovered,0);
 await write('salvage-receipt.json',{scope:'One actual optional event accepted through the snapshot public API; no UI operation or matrix case.',quote,identity:{runId:state.runId,seed:state.seed,day:state.day},before:accepted.before,command:accepted.command,result:accepted.result,expectedCoinsDelta:160,otherPiecesUnchanged:true,features:['event:salvage:accepted','event:salvage:consumed']});
 function reject(label,command,error){
  const beforeBytes=JSON.stringify(state),result=api.applyCommand(state,command);assert.equal(result.ok,false);assert.equal(result.error,error);assert.equal(result.state,state);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(result.state),beforeBytes);assert.equal(JSON.stringify(state),beforeBytes);assert.equal(state.coins,220);assert.equal(state.eventHistory.length,1);validate(label,result.state);
  rejections.push({label,command,expectedError:error,result,originalStateBytesSha256:sha(beforeBytes),resultStateBytesSha256:sha(JSON.stringify(result.state)),stateReferenceUnchanged:true});
 }
 reject('same-command-stale-duplicate',accepted.command,'stale_revision');
 reject('fresh-revision-second-event-acceptance',{runId:state.runId,expectedRevision:state.revision,action:{type:'chooseEvent',choice:'accept',pieceId:blade.id}},'unavailable');
 for(const type of ['deliver','scrap','reserve'])reject(`spent-piece-${type}`,{runId:state.runId,expectedRevision:state.revision,action:{type,pieceId:blade.id}},'piece_unavailable');
 await send('finish-the-real-third-day',{type:'settle'});
 assert.equal(state.phase,'defeat');assert.equal(state.day,3);assert.equal(state.seals,0);assert.equal(state.revision,8);assert.equal(state.journal.length,8);assert.equal(state.coins,60+160+20);assert.equal(state.coins,240);assert.equal(state.history.length,3);assert(state.history.every(h=>!h.met));assert.equal(state.history.reduce((n,h)=>n+h.sales,0),0);assert.equal(state.history.reduce((n,h)=>n+h.recovered,0),80);assert.equal(state.eventHistory.length,1);assert.equal(state.blades.filter(b=>b.status==='bartered').length,1);assert.equal(state.blades.filter(b=>b.status==='recycled').length,8);assert.equal(state.reserveId,null);
 assert.equal(transitions.length,8);assert.equal(rejections.length,5);assert.equal(validations.length,14);assert.equal(new Set(validations.map(v=>v.revision)).size,9);
 await write('accepted-transitions.json',transitions);await write('rejected-commands.json',rejections);await write('validations.json',validations);await write('journal.json',state.journal);await write('final-state.json',state);
 const after=await maps();assert.deepEqual(after,before);assert.equal(sha(await readFile(SELF)),start.sourceSha256);await write('child-snapshot-after.json',after);
 await write('summary.json',{schemaVersion:1,validationComplete:true,token:TOKEN,scope:'Exactly one directed complete fresh public-API journal, separate from the formal 30000-case dataset. This is not a UI operation or a third full model audit.',input:INPUT,rulesVersion:'forge-v4',acceptedCommands:state.revision,rejectedCommands:rejections.length,observedStateValidationCalls:validations.length,uniqueAcceptedSnapshots:9,completeDirectedJournals:1,formalDatasetCasesAdded:0,uiOperations:0,phase:state.phase,day:state.day,seals:state.seals,coins:state.coins,expectedLedger:{firstTwoSettlements:60,salvageIncome:160,lastTwoBlanksRecovery:20,total:240},acceptedEvents:1,barteredPieces:1,features:['event:salvage:accepted','event:salvage:consumed'],finalStateSha256:sha(state),snapshotFiles:75,sdkFiles:8,snapshotMapsUnchanged:true,sourceSha256:start.sourceSha256});
 console.log(JSON.stringify({directedJournalComplete:true,acceptedCommands:8,rejectedCommands:5,coins:240,phase:'defeat',formalDatasetCasesAdded:0}));
}

async function wrapper(){
 assert.equal(process.argv.length,2,'Run this wrapper without arguments at its original tmp path');
 const before=await maps(),sourceBytes=await readFile(SELF),sourceSha256=sha(sourceBytes);await mkdir(OUT,{recursive:false});
 await write('snapshot-before.json',before);await copyFile(SELF,join(OUT,'helper-source.mjs'),constants.COPYFILE_EXCL);
 const fd=openSync(join(OUT,'child-console.log'),'wx'),startedAt=new Date().toISOString();
 const processChild=fork(SELF,['--child'],{cwd:ROOT,execArgv:[],stdio:['ignore',fd,fd,'ipc']});
 let protocolError=null,ready=false;
 const ended=new Promise(resolve=>{processChild.once('error',error=>resolve({exitCode:null,signal:null,error:String(error)}));processChild.once('close',(exitCode,signal)=>resolve({exitCode,signal,error:null}));});
 processChild.on('message',message=>{try{assert.equal(ready,false);assert.deepEqual(message,{ready:true,token:TOKEN});ready=true;processChild.send({go:true,token:TOKEN});}catch(error){protocolError=String(error);processChild.kill('SIGTERM');}});
 writeFileSync(join(OUT,'start.json'),JSON.stringify({schemaVersion:1,token:TOKEN,pid:process.pid,childPid:processChild.pid,startedAt,command:[process.execPath,SELF,'--child'],snapshot:relative(ROOT,SNAPSHOT),sourceSha256,scope:'One separate directed public-API journal; no formal dataset or UI mutation.'},null,2)+'\n',{flag:'wx'});
 const outcome=await ended;closeSync(fd);let result=null,error=null,after=null,artifactIndexSha256=null;
 try{
  assert.equal(outcome.exitCode,0);assert.equal(outcome.signal,null);assert.equal(outcome.error,null);assert.equal(protocolError,null);assert.equal(ready,true);result=await read('summary.json');assert.equal(result.validationComplete,true);assert.equal(result.token,TOKEN);assert.equal(result.completeDirectedJournals,1);assert.equal(result.formalDatasetCasesAdded,0);assert.equal(result.uiOperations,0);assert.equal(result.acceptedCommands,8);assert.equal(result.rejectedCommands,5);assert.equal(result.observedStateValidationCalls,14);assert.equal(result.phase,'defeat');assert.equal(result.coins,240);assert.equal(result.acceptedEvents,1);
  const final=await read('final-state.json');assert.equal(sha(final),result.finalStateSha256);assert.equal(final.revision,8);assert.equal(final.phase,'defeat');assert.equal(final.coins,240);assert.equal(final.eventHistory.length,1);
  after=await maps();assert.deepEqual(after,before);assert.deepEqual(await read('child-snapshot-before.json'),before);assert.deepEqual(await read('child-snapshot-after.json'),before);assert.equal(sha(await readFile(SELF)),sourceSha256);assert.equal(sha(await readFile(join(OUT,'helper-source.mjs'))),sourceSha256);await write('snapshot-after.json',after);
  const files=[];async function walk(dir=''){for(const entry of(await readdir(join(OUT,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert(!entry.isSymbolicLink());const path=dir?`${dir}/${entry.name}`:entry.name;if(entry.isDirectory())await walk(path);else{const bytes=await readFile(join(OUT,path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}}}await walk();
  await write('artifact-index.json',{schemaVersion:1,scope:'Hash index of directed child artifacts; success still requires the actual wrapper terminal.json with validationComplete=true.',excludes:['artifact-index.json','terminal.json'],files});artifactIndexSha256=sha(await readFile(join(OUT,'artifact-index.json')));
 }catch(caught){error=String(caught);}
 const valid=outcome.exitCode===0&&outcome.signal===null&&outcome.error===null&&protocolError===null&&error===null;
 const terminal={schemaVersion:1,token:TOKEN,pid:process.pid,childPid:processChild.pid,startedAt,finishedAt:new Date().toISOString(),exitCode:outcome.exitCode,signal:outcome.signal,error:outcome.error,protocolError,resultError:error,validationComplete:valid,acceptedCommands:result?.acceptedCommands??null,rejectedCommands:result?.rejectedCommands??null,completeDirectedJournals:result?.completeDirectedJournals??null,observedStateValidationCalls:result?.observedStateValidationCalls??null,coins:result?.coins??null,features:result?.features??[],formalDatasetCasesAdded:0,uiOperations:0,snapshotFilesUnchanged:after?JSON.stringify(after)===JSON.stringify(before):false,artifactIndexSha256};
 await write('terminal.json',terminal);console.log(JSON.stringify(terminal));process.exitCode=valid?0:1;
}

if(process.argv[2]==='--child')await child().catch(async error=>{await write('child-failure.json',{validationComplete:false,at:new Date().toISOString(),error:String(error)}).catch(()=>{});console.error(error);process.exitCode=1;if(process.connected)process.disconnect();});
else await wrapper();
