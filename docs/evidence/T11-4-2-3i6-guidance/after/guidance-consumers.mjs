// PREPARED ONLY. Run after the model/audit freeze ends and guidance has actually been implemented/built.
// This tool never starts a server, attaches to an existing browser, or edits application/model inputs.
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium, firefox, webkit} from '@playwright/test';

const root=process.cwd(), task=resolve(root,'tmp/T11-4-2-3i6'), scriptPath=fileURLToPath(import.meta.url);
const known=new Set(['url','snapshot','out','ack-guidance-built']);
const args={};
for(let index=2;index<process.argv.length;index++){
 const key=process.argv[index];assert(key.startsWith('--'),'Unknown positional argument: '+key);
 const name=key.slice(2);assert(known.has(name)&&!(name in args),'Unknown/duplicate option: '+name);
 if(name==='ack-guidance-built')args[name]=true;
 else {const value=process.argv[++index];assert(value&&!value.startsWith('--'),'Missing value: '+name);args[name]=value;}
}
assert(args['ack-guidance-built'],'Prepared only: require --ack-guidance-built after implementation and the model/audit freeze has ended.');
for(const key of ['url','snapshot','out'])assert(typeof args[key]==='string','Required --'+key);
const baseURL=new URL(args.url);assert(['127.0.0.1','localhost'].includes(baseURL.hostname)&&baseURL.protocol==='http:','Local HTTP target only.');
assert(baseURL.pathname==='/'&&!baseURL.search&&!baseURL.hash,'Supply the local server origin.');
const snapshot=resolve(root,args.snapshot),out=resolve(root,args.out);
assert.equal(dirname(out),task,'Output must be a new direct child of this task directory.');
assert(snapshot.startsWith(root+'/dist')||snapshot.startsWith(root+'/tmp/previews/'),'Snapshot must be an explicit build or frozen preview.');
const sdk=await import(pathToFileURL(join(snapshot,'sword-led-v4.js')).href);
const sha=value=>createHash('sha256').update(value).digest('hex');
const startedAt=new Date().toISOString(),results=[],errors=[],stateObjects=[],inputs=[];
await mkdir(out,{recursive:false});
const writeJSON=async(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
await writeFile(join(out,'guidance-consumers.mjs'),await readFile(scriptPath),{flag:'wx'});

async function tree(directory,prefix=''){
 const result=[];
 for(const entry of(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  assert(!entry.isSymbolicLink(),'Symlink runtime entry rejected.');
  if(entry.isDirectory())result.push(...await tree(join(directory,entry.name),prefix+entry.name+'/'));
  else if(entry.isFile())result.push(prefix+entry.name);
 }
 return result;
}
async function fingerprint(directory){const files={};for(const name of await tree(directory)){const bytes=await readFile(join(directory,name));files[name]={bytes:bytes.length,sha256:sha(bytes)};}return files;}
async function http(name){const response=await fetch(new URL(name,baseURL),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,name);return Buffer.from(await response.arrayBuffer());}
function checked(state){const parsed=sdk.validateRun(state);assert(parsed.ok,'Invalid restored state');assert.deepEqual(parsed.state,state);return parsed.state;}
function send(state,action){const result=sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});assert(result.ok,`${state.day}/${action.type}: ${result.error}`);return result.state;}
function create(input){const result=sdk.createRun(input);assert(result.ok);return result.state;}
function envelope(state){const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};const repository=sdk.createV4SaveRepository(()=>storage,()=> '2026-10-21T00:00:00.000Z');repository.load();assert(repository.write(state).ok);return values.get('sword-led.save.v4');}
const publicInput=state=>({runId:state.runId,seed:state.seed,mode:state.mode,eligibility:state.initialEligibility});
function prefix(winner,predicate){let state=create(publicInput(winner));for(const action of winner.journal){if(predicate(state))return checked(state);state=send(state,action);}assert(predicate(state),'Declared prefix missing');return checked(state);}
async function saveState(label,state,scope){checked(state);stateObjects.push({label,state,scope});await writeJSON('states/'+label+'.json',{scope,state});}
async function readSlots(page){return page.evaluate(()=>Object.fromEntries(['sword-led.save.v4','sword-led.save.backup.v4','sword-led.collection.v1','sword-led.collection.backup.v1'].map(key=>[key,localStorage.getItem(key)])));}
async function readRun(page){const raw=(await readSlots(page))['sword-led.save.v4'],result=sdk.decodeV4Save(raw);assert.equal(result.status,'valid');return{raw,state:result.state};}
async function awaitState(page,expected){const deadline=Date.now()+15000;while(Date.now()<deadline){const actual=await readRun(page);if(actual.state.revision===expected.revision){assert.deepEqual(actual.state,expected);return actual;}await page.waitForTimeout(40);}throw Error('Expected actual UI command did not reach saved revision '+expected.revision);}
function monitor(page,label){page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(25000);page.on('pageerror',error=>errors.push({label,type:'pageerror',message:error.message}));page.on('console',message=>{if(message.type()==='error')errors.push({label,type:'console',message:message.text()});});page.on('response',response=>{if(response.status()>=400)errors.push({label,type:'http',message:response.status()+' '+response.url()});});}
async function focusVisible(page){assert(await page.evaluate(()=>{const node=document.activeElement;return node instanceof HTMLElement&&node.isConnected&&!node.matches(':disabled')&&!node.closest('[hidden]')&&node.getClientRects().length>0;}),'Focus must return to a visible enabled control.');}
async function controls(page,selector){const locator=page.locator(selector);for(let index=0;index<await locator.count();index++){const node=locator.nth(index);if(!await node.isVisible()||!await node.isEnabled())continue;const box=await node.boundingBox();assert(box&&box.width>=44&&box.height>=44,'Action target below 44px: '+await node.innerText());const viewport=page.viewportSize();assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'Action outside viewport: '+await node.innerText());}}
async function capture(page,label){
 const directory=dirname(join(out,'screens',label+'.png'));await mkdir(directory,{recursive:true});
 await page.screenshot({path:join(out,'screens',label+'.png')});
 const body=await page.locator('body').innerText();await writeFile(join(out,'screens',label+'.txt'),body+'\n',{flag:'wx'});
 return {screenshot:'screens/'+label+'.png',text:'screens/'+label+'.txt'};
}
function fullGoal(text){assert.match(text,/第\s*4\s*[、，,]\s*8\s*[、，,]\s*12\s*天/);assert.match(text,/至少(?:完成)?\s*10\s*项/);assert.match(text,/契印/);assert.match(text,/十二灯复明/);}
async function goalVisible(container){const line=container.getByText(/守住第\s*4\s*[、，,]\s*8\s*[、，,]\s*12\s*天/).first();assert(await line.isVisible(),'Complete goal must be an actual visible sentence.');const visible=await line.evaluate(node=>{const box=node.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight&&box.left>=0&&box.right<=innerWidth;});assert(visible,'Complete goal must be readable before scrolling the opening/review.');}
async function restore(browser,viewport,state,label){
 const context=await browser.newContext({baseURL:baseURL.origin,viewport}),page=await context.newPage();monitor(page,label);const raw=envelope(state);
 await page.addInitScript(raw=>{if(!sessionStorage.getItem('guidance-restored')){localStorage.setItem('sword-led.save.v4',raw);sessionStorage.setItem('guidance-restored','true');}},raw);
 await page.goto('/');await page.locator('#v4-continue:not(:disabled)').waitFor();await page.locator('#v4-continue').click();await page.locator('#v4-workshop:not([hidden])').waitFor();
 assert.equal((await readRun(page)).raw,raw);assert.deepEqual((await readRun(page)).state,state);return{context,page,raw};
}
async function cancelWithoutCommand(page,before){await page.getByRole('button',{name:'再想想',exact:true}).click();assert.deepEqual(await readSlots(page),before);await focusVisible(page);}

let runtime;
try{
 runtime=await fingerprint(snapshot);assert(Object.keys(runtime).length>=75);
 for(const name of ['browser-session-BQdQqpuu.js','core-CvAZnNjA.js','rules-CAo3EZyg.js','sword-led-core.js','sword-led-session.js','sword-led-v2.js','sword-led-v3.js','sword-led-v4.js']){const audited=await readFile(resolve(root,'tmp/previews/T11-4-2-3i5-mountain-pass',name));assert.equal(runtime[name]?.sha256,sha(audited),'Guidance must retain the formally audited rules/SDK: '+name);}
 for(const [name,expected]of Object.entries(runtime)){const bytes=await http(name);assert.equal(sha(bytes),expected.sha256,name);assert.equal(bytes.length,expected.bytes,name);await mkdir(dirname(join(out,'runtime',name)),{recursive:true});await writeFile(join(out,'runtime',name),bytes,{flag:'wx'});}
 await writeJSON('runtime-before.json',{at:new Date().toISOString(),baseURL:baseURL.origin,snapshot:relative(root,snapshot),files:runtime});
 await mkdir(join(out,'states'),{recursive:false});
 const historicalPath=resolve(root,'docs/evidence/T11-4-2-3i1/witness-fixed/complete.json'),historicalBytes=await readFile(historicalPath),winner=checked(JSON.parse(historicalBytes));assert.equal(winner.phase,'victory');assert.equal(winner.journal.length,210);
 inputs.push({path:relative(root,historicalPath),sha256:sha(historicalBytes),scope:'Historical actual victory replayed only to explicit restored boundaries.'});await writeFile(join(out,'historical-complete210.json'),historicalBytes,{flag:'wx'});
 const ordinary=prefix(winner,s=>s.day===2&&s.phase==='workshop'),critical=prefix(winner,s=>s.day===4&&s.phase==='workshop'),protectedCritical=prefix(winner,s=>s.day===8&&s.phase==='workshop');
 assert.equal(sdk.getRunView(ordinary).settlement.complete,false);assert(sdk.getRunView(ordinary).settlement.sealsAfter>0);
 assert.equal(sdk.getRunView(critical).settlement.complete,false);assert.equal(sdk.getRunView(protectedCritical).settlement.protected,true);assert.equal(protectedCritical.pardonUsed,false);
 let exhausted=prefix(winner,s=>s.day===2&&s.phase==='workshop');
 while(exhausted.day<4){exhausted=send(exhausted,{type:'settle'});assert.equal(exhausted.phase,'summary');exhausted=send(exhausted,{type:'advance'});}checked(exhausted);assert.equal(exhausted.seals,1);assert.equal(sdk.getRunView(exhausted).settlement.sealsAfter,0);
 let salvage=create({runId:'guidance-salvage-3',seed:'v4-guidance-salvage-3'});salvage=send(salvage,{type:'continue'});while(salvage.day<3){salvage=send(salvage,{type:'settle'});salvage=send(salvage,{type:'advance'});}checked(salvage);
 assert.equal(sdk.getRunView(salvage).event.id,'salvage');assert.equal(salvage.eventStatus,'available');assert.equal(salvage.reserveId,null);assert(sdk.getRunView(salvage).blades.some(item=>!item.reserved));
 let salvageEmpty=salvage;for(const item of sdk.getRunView(salvage).blades)salvageEmpty=send(salvageEmpty,{type:'scrap',pieceId:item.blade.id});checked(salvageEmpty);assert.equal(salvageEmpty.phase,'workshop');assert.equal(salvageEmpty.reserveId,null);assert.equal(sdk.getRunView(salvageEmpty).blades.length,0);assert.equal(salvageEmpty.eventStatus,'available');
 for(const [label,state]of Object.entries({ordinary,critical,protectedCritical,exhausted,salvage,salvageEmpty}))await saveState('fixture-'+label,state,'Declared legal journal restoration boundary; not a new full UI game.');
 for(const [label,state]of Object.entries({ordinary,critical,protectedCritical,exhausted})){
  const expected=checked(send(state,{type:'settle'}));assert.equal(expected.history.at(-1).met,false);
  if(label==='protectedCritical'){assert.equal(expected.history.at(-1).protected,true);assert.equal(expected.seals,state.seals);assert.equal(expected.history.at(-1).day,8);}
  if(label==='exhausted')assert.equal(expected.phase,'defeat');
   if(label==='ordinary'){assert.equal(expected.phase,'summary');assert(expected.seals>0);}
  await saveState('core-forecast-'+label,expected,'Actual formal SDK settlement used solely to prove the forecast; this action is never sent by the cancellation UI case.');
 }
 const matrix=[{engine:'chromium',type:chromium},{engine:'firefox',type:firefox},{engine:'webkit',type:webkit}];
 for(const {engine,type}of matrix){
  const browser=await type.launch({headless:true,...(engine==='chromium'?{args:['--no-proxy-server']}:{})});
  try{for(const viewport of[{width:1280,height:720},{width:1920,height:1080}]){
   const project=`${engine}-${viewport.width}x${viewport.height}`,record={project,browserVersion:browser.version(),cases:[]};
   const fresh=await browser.newContext({baseURL:baseURL.origin,viewport});
   try{
    const page=await fresh.newPage();monitor(page,project+'/opening');await page.goto('/');await page.locator('#v4-start:not(:disabled)').waitFor();await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('v4-guidance-consumer-opening');await page.locator('#v4-start').click();await page.locator('#v4-stage:not([hidden])').waitFor();
    const before=await readSlots(page),opening=(await readRun(page)).state;checked(opening);assert.equal(opening.phase,'opening');assert.equal(opening.journal.length,0);fullGoal(await page.locator('#v4-stage-copy').innerText());await goalVisible(page.locator('#v4-stage-copy'));await controls(page,'#v4-stage-actions button');const openingImage=await capture(page,project+'/opening-full-goal');
    await page.locator('#v4-menu').click();await page.locator('#v4-journey-open').click();fullGoal(await page.locator('#v4-dialog-body').innerText());await goalVisible(page.locator('#v4-dialog-body'));await controls(page,'#v4-dialog-actions button');const journeyImage=await capture(page,project+'/journey-full-goal');await page.getByRole('button',{name:'回铁砧',exact:true}).click();assert.deepEqual(await readSlots(page),before);await focusVisible(page);
    record.cases.push({id:'opening-and-journey',scope:'Actual isolated new-game creation; zero gameplay commands; reading/cancelling keeps saved bytes unchanged.',...openingImage,journey:journeyImage});await saveState(project+'-actual-opening',opening,'Actual isolated UI creation, no restored state and no forging commands.');
   }finally{await fresh.close();}
   for(const [kind,state]of Object.entries({ordinary,critical,protectedCritical,exhausted})){
    const restored=await restore(browser,viewport,state,project+'/'+kind);
    try{
     const {page}=restored,before=await readSlots(page),objective=await page.locator('.v4-objective').innerText();
     if(kind==='ordinary')assert(!objective.includes('关键'),'Ordinary day2 must not be marked as a critical station.');else assert.match(objective,/关键/);
     await page.locator('#v4-settle').click();const copy=await page.locator('#v4-dialog-body').innerText();
     if(kind==='ordinary'){
      assert.match(copy,/仍可继续|可以.*(?:继续|下一)|带着.*契印.*(?:下一|继续)|下一(?:天|程|站)/);
      assert(!/(?:今日|今天|这份|本日)(?:是|属于|的)?(?:一份)?关键(?:约定|灯站)/.test(copy),'Ordinary miss must not be described as a critical promise.');
      assert(!/(?:不能|无法|不可)(?:再)?(?:继续|前往下一|进入下一)/.test(copy),'A surviving ordinary miss must not deny continuation.');
      assert(!/契印(?:已|会|将)?(?:归零|用尽)|炉火暂熄|本局.{0,6}停下/.test(copy),'A surviving ordinary miss must not claim a terminal failure.');
     }else{assert.match(copy,/关键/);assert.match(copy,/十二灯复明/);}
     if(kind==='critical')assert.match(copy,/缺口|替代|补回|补上|失约/);
     if(kind==='protectedCritical'){assert.match(copy,/护炉契/);assert.match(copy,/保.*印|只保/);assert.match(copy,/不.*补|仍.*失约|缺口|不能.*替代/);}
     if(kind==='exhausted'){assert.match(copy,/契印.*(?:归零|0\s*\/\s*3|用尽)|(?:归零|用尽).*契印/);assert.match(copy,/停下|结束|暂熄/);assert(!copy.includes('仍可继续'));}
     await controls(page,'#v4-dialog-actions button');const image=await capture(page,project+'/'+kind+'-settlement');await cancelWithoutCommand(page,before);assert.equal((await readRun(page)).raw,restored.raw);
     record.cases.push({id:kind+'-settlement-cancel',scope:'Declared restored legal boundary. Confirmation is read and cancelled; no settlement command is sent.',body:copy,savedSlotsUnchanged:true,...image});
    }finally{await restored.context.close();}
   }
   const old=await restore(browser,viewport,salvage,project+'/salvage');
   try{
    const {page}=old,original=await readSlots(page);await page.locator('#v4-event-open').click();assert.match(await page.locator('#v4-dialog-body').innerText(),/挂|剑架/);const navigate=page.getByRole('button',{name:'回铁砧选剑挂上',exact:true});await controls(page,'#v4-dialog-actions button');assert(await navigate.isVisible());const startImage=await capture(page,project+'/salvage-no-reserve');await navigate.click();assert.deepEqual(await readSlots(page),original);await focusVisible(page);
    assert(await page.evaluate(()=>{const node=document.activeElement;return node?.id==='v4-reserve'||!!node?.closest('#v4-inventory');}),'Rack navigation must focus an existing piece/retain control, not invent a command.');
    const piece=sdk.getRunView(salvage).blades.filter(item=>!item.reserved).sort((a,b)=>a.blade.value-b.blade.value||a.blade.id.localeCompare(b.blade.id))[0].blade;
    await page.locator(`#v4-inventory [data-piece="${piece.id}"]`).click();assert.deepEqual(await readSlots(page),original);const kept=send(salvage,{type:'reserve',pieceId:piece.id});await page.locator('#v4-reserve').click();await awaitState(page,kept);await saveState(project+'-actual-ui-reserved',kept,'One actual reserve command after navigation; baseline was an explicitly restored legal boundary.');
    const beforeConfirm=await readSlots(page);
    const choose=async()=>{await page.locator('#v4-event-open').click();await page.locator(`[data-event-piece="${piece.id}"]`).getByRole('button',{name:/^选这柄/}).click();await page.locator('#v4-dialog[data-kind="confirm"]').waitFor();};
    await choose();const confirmCopy=await page.locator('#v4-dialog-body').innerText();assert(confirmCopy.includes(String(piece.value)));assert(confirmCopy.includes('160'));assert.match(confirmCopy,/交付|留剑|剑架/);await controls(page,'#v4-dialog-actions button');const confirmImage=await capture(page,project+'/salvage-confirm-values');await cancelWithoutCommand(page,beforeConfirm);
    await choose();const expected=send(kept,{type:'chooseEvent',choice:'accept',pieceId:piece.id});await page.getByRole('button',{name:'确认',exact:true}).click();const actual=(await awaitState(page,expected)).state;checked(actual);assert.equal(actual.coins-kept.coins,160);assert.equal(actual.reserveId,null);assert.equal(actual.blades.find(item=>item.id===piece.id).status,'bartered');assert.equal(actual.blades.find(item=>item.id===piece.id).commissionId,null);assert.equal(actual.eventHistory.length,kept.eventHistory.length+1);assert.equal(actual.eventHistory.at(-1).pieceId,piece.id);assert.equal(actual.eventHistory.at(-1).coins,160);
    for(const other of kept.blades.filter(item=>item.id!==piece.id))assert.deepEqual(actual.blades.find(item=>item.id===other.id),other);
    const after=await readSlots(page);await page.locator('#v4-menu').click();await page.getByRole('button',{name:'继续锻造',exact:true}).click();assert.deepEqual(await readSlots(page),after);await focusVisible(page);const acceptedImage=await capture(page,project+'/salvage-actual-once');await saveState(project+'-actual-ui-exchanged',actual,'One actual reserve and one actual event acceptance from an explicitly restored legal boundary. Not a new full-game UI playthrough.');
    record.cases.push({id:'salvage-guided-exchange',scope:'Restored boundary → navigation/selection no commands → actual reserve → cancel preserves exact saved slots → actual unique 160 event acceptance.',navigationNoCommand:true,cancelSavedSlotsUnchanged:true,acceptedCommandCount:2,coinDelta:160,pieceId:piece.id,body:confirmCopy,...startImage,confirmation:confirmImage,accepted:acceptedImage});
   }finally{await old.context.close();}
   const empty=await restore(browser,viewport,salvageEmpty,project+'/salvage-empty');
   try{
    const {page}=empty,before=await readSlots(page);await page.locator('#v4-event-open').click();
    const copy=await page.locator('#v4-dialog-body').innerText();assert.match(copy,/没有|暂无|无可/);assert.match(copy,/拒绝/);
    assert.equal(await page.getByRole('button',{name:'回铁砧选剑挂上',exact:true}).isVisible(),false,'No rack-navigation offer may imply a selectable sword exists.');
    assert.equal(await page.locator('[data-event-piece]').count(),0,'Empty inventory must not fabricate an exchange candidate.');
    assert(await page.getByRole('button',{name:'拒绝，保留眼前资源',exact:true}).isEnabled());await controls(page,'#v4-dialog-actions button');const image=await capture(page,project+'/salvage-no-active-sword');
    await page.getByRole('button',{name:'暂不决定',exact:true}).click();assert.deepEqual(await readSlots(page),before);await focusVisible(page);
    record.cases.push({id:'salvage-empty-cancel',scope:'Declared legal day3 boundary, then three actual SDK scrap commands produced an empty workshop before restoration. UI only opens/cancels the event; no UI economic command is sent.',body:copy,navigationAbsent:true,candidates:0,savedSlotsUnchanged:true,...image});
   }finally{await empty.context.close();}
   results.push(record);await writeJSON(project+'-result.json',record);
  }}finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(await fingerprint(snapshot),runtime);assert.equal(sha(await http('index.html')),runtime['index.html'].sha256);for(const entry of stateObjects)checked(entry.state);
 await writeJSON('states-index.json',stateObjects.map(({label,scope,state})=>({label,scope,sha256:sha(JSON.stringify(state)),day:state.day,phase:state.phase,revision:state.revision})));
 await writeJSON('result.json',{startedAt,completedAt:new Date().toISOString(),scriptSha256:sha(await readFile(scriptPath)),baseURL:baseURL.origin,snapshot:relative(root,snapshot),runtimeFiles:Object.keys(runtime).length,projects:results.length,targetedCases:results.reduce((sum,row)=>sum+row.cases.length,0),inputs,errors,results,scope:'Targeted guidance consumers only: three browser engines by two PC sizes, explicit restored boundaries and two real UI economic commands per salvage case. Not a full-game, DPR, native Safari/Chrome lifecycle, physical-refresh, audio/performance, or human acceptance matrix.'});
 const files={};for(const name of await tree(out)){const bytes=await readFile(join(out,name));files[name]={bytes:bytes.length,sha256:sha(bytes)};}await writeJSON('artifact-index.json',{excludes:'This artifact-index.json only.',files});
 console.log(JSON.stringify({completed:true,projects:results.length,targetedCases:results.reduce((sum,row)=>sum+row.cases.length,0),errors:errors.length,out:relative(root,out)}));
}catch(error){await writeJSON('failure.json',{at:new Date().toISOString(),startedAt,error:String(error),stack:error?.stack,results,errors,scope:'Targeted consumer failure; no success receipt.'});throw error;}
