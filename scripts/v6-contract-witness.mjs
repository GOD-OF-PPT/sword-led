import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const sdkPath=resolve(process.env.V6_SDK_PATH??'dist/sword-led-v6.js');
const output=process.env.V6_WITNESS_DIR??'docs/evidence/v0.9/1.1-kernel';
const api=await import(pathToFileURL(sdkPath).href);await mkdir(output,{recursive:true});
const summary={scope:'Finite declared-seed formal SDK command witnesses, not UI play or human fun acceptance.',seed:'v6-contract',sdkSha256:createHash('sha256').update(await readFile(sdkPath)).digest('hex'),branches:[]};
function begin(name){const result=api.createRun({runId:`v6-${name}`,seed:summary.seed});assert(result.ok);return{state:result.state,events:[]};}
function send(run,action){const before=JSON.stringify(run.state),result=api.applyCommand(run.state,{runId:run.state.runId,expectedRevision:run.state.revision,action});assert(result.ok,result.error);assert.equal(JSON.stringify(run.state),before);run.state=result.state;run.events.push({revision:run.state.revision,action,events:result.events});assert(api.validateRun(JSON.parse(JSON.stringify(run.state))).ok);}
function work(run,id,school,count){send(run,{type:'chooseSchool',pieceId:id,school});for(let i=0;i<count;i++)send(run,{type:'forge',pieceId:id,useTechnique:false});}
for(const tool of ['rebound','furnace']){
 const run=begin(tool),school=tool==='rebound'?'steady':'fissure';work(run,'main-1',school,4);send(run,{type:'forge',pieceId:'main-1',useTechnique:true});send(run,{type:'seal',pieceId:'main-1'});
 if(tool==='rebound')send(run,{type:'guard'});send(run,{type:'strike',targetId:'main-guard'});send(run,{type:'takeCache',target:tool==='rebound'?'rope':'latch'});
 work(run,'echo-1',school,3);send(run,{type:'forge',pieceId:'echo-1',useTechnique:true});send(run,{type:'seal',pieceId:'echo-1'});
 if(tool==='rebound')send(run,{type:'guard'});send(run,{type:'strike',targetId:'echo-primary'});
 if(tool==='rebound')send(run,{type:'followUp',targetId:'echo-secondary'});else{send(run,{type:'chooseSchool',pieceId:'echo-2',school:'fissure'});send(run,{type:'forge',pieceId:'echo-2',useTechnique:true});}
 assert.equal(run.state.phase,'recap');assert.equal(run.state.coins,15);assert.equal(run.state.tool,tool);assert.equal(run.state.echo.demonstrated,true);await writeFile(`${output}/${tool}.json`,JSON.stringify(run,null,2)+'\n');summary.branches.push({name:tool,commands:run.state.revision,phase:run.state.phase,toolDemonstrated:true,coins:run.state.coins});
}
const failure=begin('three-weak-blades');for(const id of ['main-1','main-2','main-3']){work(failure,id,'steady',2);send(failure,{type:'seal',pieceId:id});for(let i=0;i<3;i++)send(failure,{type:'strike',targetId:'main-guard'});}
assert.equal(failure.state.phase,'failed');assert.equal(failure.state.coins,0);await writeFile(`${output}/three-weak-blades.json`,JSON.stringify(failure,null,2)+'\n');summary.branches.push({name:'three-weak-blades',commands:failure.state.revision,phase:failure.state.phase,coins:failure.state.coins});
await writeFile(`${output}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
