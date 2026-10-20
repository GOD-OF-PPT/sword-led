// Prepared only. Execute after publishing and reviewing the completed final-journeys batch.
// Usage: rtk proxy node tmp/T11-4-2-3i5/preview-smoke.mjs <snapshot> [new-output-directory]
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {get} from 'node:http';
import {chromium} from '@playwright/test';
import * as sdk from '../../dist/sword-led-v4.js';

const root=process.cwd(),task=resolve(root,'tmp/T11-4-2-3i6'),baseURL='http://127.0.0.1:4179';
const snapshotArg=process.argv[2],out=resolve(root,process.argv[3]??'tmp/T11-4-2-3i6/official-preview');
assert(snapshotArg,'A published snapshot path is required; this script does not start or replace a server.');
assert.equal(resolve(out,'..'),task,'Output must be a new direct child of this task tmp root.');
const snapshot=await realpath(resolve(root,snapshotArg)),previewRoot=await realpath(resolve(root,'tmp/previews'));
assert(snapshot.startsWith(previewRoot+'/'),'Snapshot must be a real task preview, not dist or source.');
const startedAt=new Date().toISOString(),sha=value=>createHash('sha256').update(value).digest('hex');
const journeyRoot=resolve(root,'tmp/T11-4-2-3i5/final-journeys'),journeyTerminal=JSON.parse(await readFile(join(journeyRoot,'terminal.json'),'utf8'));
assert.equal(journeyTerminal.validationComplete,true,'The final journey batch is still pending or did not pass.');
assert.equal(journeyTerminal.exitCode,0);assert.equal(journeyTerminal.stats.expected,12);
assert.equal(journeyTerminal.stats.unexpected,0);assert.equal(journeyTerminal.stats.skipped,0);
const journeyBefore=JSON.parse(await readFile(join(journeyRoot,'baseline.json'),'utf8'));
const journeyAfter=JSON.parse(await readFile(join(journeyRoot,'after.json'),'utf8'));
assert.deepEqual(journeyBefore.sourceHashes,journeyAfter.sourceHashes,'Final journey inputs drifted.');
assert.deepEqual(journeyBefore.buildFiles,journeyAfter.buildFiles,'Final journey build drifted.');

async function tree(directory,prefix=''){
  const files=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    assert(!entry.isSymbolicLink(),'No symlink evidence or snapshot entries: '+join(directory,entry.name));
    const name=prefix+entry.name;
    if(entry.isDirectory())files.push(...await tree(join(directory,entry.name),name+'/'));
    else if(entry.isFile())files.push(name);
  }
  return files;
}
async function fingerprint(directory){
  const result={};
  for(const file of await tree(directory)){const bytes=await readFile(join(directory,file));result[file]={sha256:sha(bytes),bytes:bytes.length};}
  return result;
}
const distBefore=await fingerprint(resolve(root,'dist')),snapshotBefore=await fingerprint(snapshot);
assert.equal(Object.keys(distBefore).length,75,'Expected the final seventy-five-file runtime.');
assert.deepEqual(snapshotBefore,distBefore,'Published snapshot differs from current dist.');
const guidanceTerminal=JSON.parse(await readFile(join(task,'guidance-final-02-process/terminal.json'),'utf8'));assert.equal(guidanceTerminal.validationComplete,true);assert.equal(guidanceTerminal.childTerminal.exitCode,0);assert.equal(guidanceTerminal.targetedCases,42);
const guidanceAfter=JSON.parse(await readFile(join(task,'guidance-final-02-process/after.json'),'utf8'));
const recordedBuild=Object.fromEntries(Object.entries(guidanceAfter.buildFiles).map(([file,value])=>{
  assert(file.startsWith('dist/'),'Unexpected final build fingerprint key: '+file);return[file.slice(5),value];
}));
assert.deepEqual(distBefore,recordedBuild,'Official preview must use the actual 42-case guidance build.');

function httpGet(file){
  return new Promise((resolveRequest,reject)=>{
    const request=get(baseURL+'/'+file.split('/').map(encodeURIComponent).join('/'),response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);
      response.on('aborted',()=>reject(Error('HTTP response aborted: '+file)));
      response.on('end',()=>response.statusCode===200?resolveRequest(Buffer.concat(chunks)):reject(Error(`${file}: HTTP ${response.statusCode}`)));
    });
    request.setTimeout(15000,()=>request.destroy(Error('HTTP timeout: '+file)));request.on('error',reject);
  });
}
const http=[];
for(const [file,expected]of Object.entries(distBefore)){
  const bytes=await httpGet(file);assert.equal(bytes.length,expected.bytes,file);assert.equal(sha(bytes),expected.sha256,file);
  http.push({file,bytes:bytes.length,sha256:sha(bytes)});
}

const sampleDirectory=join(journeyRoot,'evidence/final/v4-chromium');
async function actualSample(name){
  const found=(await tree(sampleDirectory)).filter(file=>file.split('/').at(-1)===name);
  assert.equal(found.length,1,'Expected exactly one actual final-journeys Chromium sample: '+name);
  const path=join(sampleDirectory,found[0]),raw=await readFile(path),checked=sdk.validateRun(JSON.parse(raw.toString('utf8')));
  assert(checked.ok,'Actual saved sample failed current SDK validation: '+path);assert.deepEqual(checked.state,JSON.parse(raw.toString('utf8')));
  const collectionPath=path.replace(/\.json$/,'-collection-envelope.json'),collectionRaw=await readFile(collectionPath,'utf8'),profile=sdk.decodeCollection(collectionRaw);
  assert.equal(profile.status,'valid','Actual saved collection companion failed validation: '+collectionPath);
  // Formal evidence contains the actual state plus the original collection envelope. Re-envelope only the validated run.
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const repository=sdk.createV4SaveRepository(()=>storage,()=> '2026-10-21T00:00:00.000Z');repository.load();
  const write=repository.write(checked.state);assert(write.ok,'Could not encode the actual saved run.');
  const runRaw=values.get('sword-led.save.v4');assert.equal(sdk.decodeV4Save(runRaw).status,'valid');
  return{path:relative(root,path),sha256:sha(raw),collectionPath:relative(root,collectionPath),collectionSha256:sha(collectionRaw),state:checked.state,collection:profile.state,runRaw,collectionRaw};
}
const dayEight=await actualSample('saved-day-eight-before-continuing.json');
assert.equal(dayEight.state.day,8);assert.equal(dayEight.state.phase,'summary');assert.equal(dayEight.state.modifications.length,2);
const mixed=await actualSample('mixed-return-final-real-outcome.json'),mixedEnding=sdk.getRunView(mixed.state).ending;
assert.equal(mixed.state.phase,'return');assert.equal(mixed.state.day,12);assert.equal(mixedEnding.finalBladeMade,true);
assert(mixedEnding.missingCritical.length>0);assert.equal(mixed.collection.challenge,false);
assert(mixed.collection.works.some(work=>work.commissionId===12),'Actual mixed-return collection must contain the genuinely made final sword.');

await mkdir(out,{recursive:false});await mkdir(join(out,'exports'),{recursive:false});
const errors=[],states=[],samples=[dayEight,mixed].map(({path,sha256,collectionPath,collectionSha256})=>({path,sha256,collectionPath,collectionSha256,
  scope:'Restored actual saved UI checkpoint from completed final-journeys; not a new full-game UI playthrough.'}));
const browser=await chromium.launch({headless:true,args:['--no-proxy-server']});
function observe(page,label){
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(25000);
  page.on('pageerror',error=>errors.push({label,type:'pageerror',message:error.message}));
  page.on('console',message=>{if(message.type()==='error')errors.push({label,type:'console',message:message.text()});});
  page.on('response',response=>{if(response.status()>=400)errors.push({label,type:'http',message:`${response.status()} ${response.url()}`});});
}
async function readRun(page,label){
  const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));
  assert(raw,'Missing actual isolated run');const checked=sdk.decodeV4Save(raw);assert.equal(checked.status,'valid',label);
  const state=checked.state;states.push({label,state});return{raw,state};
}
async function savedBytes(page){return page.evaluate(()=>({run:localStorage.getItem('sword-led.save.v4'),collection:localStorage.getItem('sword-led.collection.v1')}));}
async function readyImage(page,selector,src){
  const image=page.locator(selector);assert.equal(await image.getAttribute('src'),src);
  await image.evaluate(async node=>{await node.decode();});
  assert.equal(await image.getAttribute('src'),src,'An automatic fallback is not the expected scene.');
  assert(await image.evaluate(node=>node.complete&&node.naturalWidth>0),'Expected a decoded scene.');
}
async function screenshot(page,name){
  await page.locator('#v4-stage-image').evaluate(async node=>{if(node.checkVisibility())await Promise.allSettled(node.getAnimations().map(animation=>animation.finished));});
  await page.screenshot({path:join(out,name+'.png')});
}
async function restored(sample,label){
  const context=await browser.newContext({baseURL,viewport:{width:1280,height:720},acceptDownloads:true}),page=await context.newPage();observe(page,label);
  await page.addInitScript(({run,collection})=>{
    if(sessionStorage.getItem('v4-preview-checkpoint-installed'))return;
    localStorage.setItem('sword-led.save.v4',run);localStorage.setItem('sword-led.collection.v1',collection);
    sessionStorage.setItem('v4-preview-checkpoint-installed','true');
  },{run:sample.runRaw,collection:sample.collectionRaw});
  await page.goto('/');await page.locator('#v4-continue:not(:disabled)').waitFor();await page.locator('#v4-continue').click();
  const actual=await readRun(page,label+'-restored');assert.deepEqual(actual.state,sample.state);assert.equal(actual.raw,sample.runRaw);
  return{context,page};
}

try{
  // A newly launched isolated context has no access to the user's actual tabs, saves or browser profile.
  const freshContext=await browser.newContext({baseURL,viewport:{width:1280,height:720},acceptDownloads:true});
  try{
    const page=await freshContext.newPage();observe(page,'fresh');
    await page.addInitScript(()=>{window.v4PreviewHitPointers=[];document.addEventListener('pointerdown',event=>{if(event.target instanceof Element&&event.target.closest('#v4-hit'))window.v4PreviewHitPointers.push({trusted:event.isTrusted,button:event.button});},true);});
    await page.goto('/');await page.locator('#v4-start:not(:disabled)').waitFor();
    assert.match(await page.locator('.v4-edition').innerText(),/山口终章/);await screenshot(page,'title');
    await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('lantern-witness-0');await page.locator('#v4-start').click();
    let before=(await readRun(page,'fresh-opening')).state;
    assert.equal(before.phase,'opening');assert.equal(before.coins,0);assert.deepEqual(before.initialEligibility,{recipes:['light'],challenge:false});
    let result=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'continue'}});assert(result.ok);
    await page.getByRole('button',{name:'点火开炉',exact:true}).click();let actual=(await readRun(page,'fresh-opened')).state;assert.deepEqual(actual,result.state);
    for(let index=0;index<3;index++){
      before=actual;result=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'strike',pieceId:'d1-1'}});assert(result.ok);
      await page.locator('#v4-hit').click({position:{x:250,y:170}});
      await page.waitForFunction(()=>document.querySelector('#v4-strike')?.getAttribute('aria-busy')==='false');
      actual=(await readRun(page,'fresh-left-click-'+(index+1))).state;assert.deepEqual(actual,result.state);
    }
    assert.equal(actual.blades.find(blade=>blade.id==='d1-1').value,148);
    assert.deepEqual(await page.evaluate(()=>window.v4PreviewHitPointers),Array.from({length:3},()=>({trusted:true,button:0})));
    await screenshot(page,'fresh-three-left-clicks');
    before=actual;result=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'deliver',pieceId:'d1-1'}});assert(result.ok);
    await page.locator('#v4-deliver').click();await page.getByRole('button',{name:'回到铁砧',exact:true}).click();actual=(await readRun(page,'fresh-delivered')).state;
    assert.deepEqual(actual,result.state);assert.equal(actual.coins,148);assert.equal(actual.blades.find(blade=>blade.id==='d1-1').status,'commissioned');
    const bytes=await savedBytes(page);await page.reload();await page.locator('#v4-continue:not(:disabled)').waitFor();await page.locator('#v4-continue').click();
    assert.deepEqual(await savedBytes(page),bytes);assert.deepEqual((await readRun(page,'fresh-reloaded')).state,actual);assert.equal(await page.locator('#v4-stage').isVisible(),false);
  }finally{await freshContext.close();}

  const continued=await restored(dayEight,'actual-day-eight');
  try{
    const {page}=continued,before=(await readRun(page,'day-eight-before-advance')).state;
    const result=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'advance'}});assert(result.ok);
    await page.getByRole('button',{name:'沿灯路，去下一天',exact:true}).click();
    assert.equal(await page.locator('#v4-stage-title').innerText(),'第三章 · 山口守灯');
    await readyImage(page,'#v4-stage-image','/assets/d/v07-chapter3/mountain-pass-arrival-v1.webp');await screenshot(page,'restored-day-eight-to-nine');
    await page.getByRole('button',{name:'回到铁砧',exact:true}).click();
    const actual=(await readRun(page,'day-nine-after-explicit-advance')).state;assert.deepEqual(actual,result.state);assert.equal(actual.day,9);assert.equal(actual.phase,'workshop');
    assert.equal(await page.locator('#v4-shop').isVisible(),true);
    const bytes=await savedBytes(page);await page.reload();await page.locator('#v4-continue:not(:disabled)').waitFor();await page.locator('#v4-continue').click();
    assert.deepEqual(await savedBytes(page),bytes);assert.deepEqual((await readRun(page,'day-nine-reloaded')).state,actual);assert.equal(await page.locator('#v4-stage').isVisible(),false);
  }finally{await continued.context.close();}

  const returned=await restored(mixed,'actual-mixed-return');
  try{
    const {page}=returned,before=await savedBytes(page);
    assert.equal(await page.locator('#v4-stage-title').innerText(),'灯下归途');assert.match(await page.locator('#v4-stage-copy').innerText(),/山口护灯剑已经做成/);
    await readyImage(page,'#v4-stage-image','/assets/d/v07-chapter3/ending-homeward-v1.webp');await screenshot(page,'restored-final-sword-made-homeward');
    await page.getByRole('button',{name:'听听三人的后话',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'SUMMARY');
    await page.locator('.v4-ending-person[data-customer="courier"] summary').click();assert(await page.locator('.v4-ending-person[data-customer="courier"]').getAttribute('open')!==null);
    await page.getByRole('button',{name:'翻开完整炉谱',exact:true}).click();assert.equal(await page.locator('#v4-dialog-body [data-record]').count(),12);
    await page.locator('#v4-dialog-body [data-record="12"]').getByRole('button',{name:'翻看这件作品',exact:true}).click();
    assert.equal(await page.locator('#v4-dialog').getAttribute('data-kind'),'collection-work');
    const work=mixed.collection.works.find(entry=>entry.commissionId===12),blade=work.blades[0];
    assert.match(await page.locator('.v4-work-page').innerText(),new RegExp(`等级 ${blade.level}`));
    assert.equal(await page.locator('.v4-work-receipt canvas[data-blade="'+blade.id+'"]').count(),1);
    await page.locator('.v4-work-scene summary').click();await readyImage(page,'.v4-work-scene img','/assets/d/v07-chapter3/last-lantern-delivered-v1.webp');await screenshot(page,'restored-actual-final-work');
    await page.getByRole('button',{name:'回到炉谱',exact:true}).click();await page.getByRole('button',{name:'收好炉谱',exact:true}).click();
    assert(await page.evaluate(()=>{const node=document.activeElement;return node instanceof HTMLElement&&node.isConnected&&!node.closest('[hidden]')&&node.getClientRects().length>0;}),'Nested book close must restore visible focus.');
    assert.deepEqual(await savedBytes(page),before,'Reading endings and works must not change either saved slot.');
    const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出这次行程',exact:true}).click();const downloaded=await downloadEvent;
    assert.equal(await downloaded.failure(),null,'Actual export download failed.');const downloadedPath=await downloaded.path();assert(downloadedPath,'Missing completed browser download.');
    const exported=await readFile(downloadedPath),checked=sdk.validateRun(JSON.parse(exported.toString('utf8')));assert(checked.ok);assert.deepEqual(checked.state,mixed.state);
    await writeFile(join(out,'exports/mixed-return.json'),exported,{flag:'wx'});
    assert.deepEqual(await savedBytes(page),before);states.push({label:'mixed-return-actual-export',state:checked.state});
    await page.reload();await page.locator('#v4-continue:not(:disabled)').waitFor();await page.locator('#v4-continue').click();
    assert.deepEqual(await savedBytes(page),before);assert.deepEqual((await readRun(page,'mixed-return-reloaded')).state,mixed.state);
  }finally{await returned.context.close();}
  assert.deepEqual(errors,[],'Official isolated preview emitted browser/asset errors.');
  assert.deepEqual(await fingerprint(resolve(root,'dist')),distBefore,'dist changed during official preview verification.');
  assert.deepEqual(await fingerprint(snapshot),snapshotBefore,'Published snapshot changed during official preview verification.');
  assert.equal(sha(await httpGet('index.html')),distBefore['index.html'].sha256,'Official server changed during verification.');
}catch(error){
  await writeFile(join(out,'failure.json'),JSON.stringify({at:new Date().toISOString(),startedAt,error:String(error),errors,scope:'Failed isolated official-preview smoke; not a successful receipt.'},null,2)+'\n',{flag:'wx'});
  throw error;
}finally{await browser.close();}

for(const {label,state}of states){const checked=sdk.validateRun(state);assert(checked.ok,label);assert.deepEqual(checked.state,state,label);}
await writeFile(join(out,'samples.json'),JSON.stringify(samples,null,2)+'\n',{flag:'wx'});
await writeFile(join(out,'states.json'),JSON.stringify(states,null,2)+'\n',{flag:'wx'});
const result={at:new Date().toISOString(),startedAt,baseURL,snapshot:relative(root,snapshot),scriptSha256:sha(await readFile(import.meta.filename)),
  finalJourneyToken:journeyTerminal.token,guidanceToken:guidanceTerminal.token,httpFiles:http.length,http,freshCommands:5,freshLeftClicks:3,restoredBoundaryCommands:1,checkedObjects:states.length,errors,
  export:{path:relative(root,join(out,'exports/mixed-return.json')),scope:'Actual awaited browser download, replayed against the restored actual UI ending.'},
  scope:'Fresh isolated Chromium against the actual official 4179 snapshot; three trusted left-click actions, delivery and exact save/reload. Two explicitly restored actual final-journeys checkpoints cover day8→9 and a made-final-sword return with real book/work/export. Restores are not extra full-game UI journeys. No existing browser, user tab, profile, or user save is read or written; this script never starts or replaces a server.'};
await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({httpFiles:result.httpFiles,freshCommands:result.freshCommands,freshLeftClicks:3,restoredBoundaryCommands:1,checkedObjects:states.length,errors}));
