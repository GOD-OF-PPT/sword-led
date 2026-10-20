// Isolated before-change observation only. It never starts/replaces the official server or mutates source.
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile, copyFile, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join, resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import * as sdk from '../../dist/sword-led-v4.js';

const root = process.cwd(), task = resolve(root, 'tmp/T11-4-2-3i6');
const out = resolve(root, process.argv[2] ?? 'tmp/T11-4-2-3i6/before-guidance-evidence');
assert.equal(dirname(out), task, 'Output must be a new direct child of this task directory.');
const baseURL = 'http://127.0.0.1:4179', snapshot = await realpath(resolve(root, 'tmp/previews/T11-4-2-3i5-mountain-pass'));
const startedAt = new Date().toISOString(), scriptPath = fileURLToPath(import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const json = async (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
await mkdir(out, {recursive:false});
await copyFile(scriptPath, join(out, 'before-guidance.mjs'));
const observations = [], errors = [], states = [], trials = [];
let browser;

async function tree(directory, prefix = '') {
 const files = [];
 for (const entry of (await readdir(directory, {withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
  assert(!entry.isSymbolicLink());
  if (entry.isDirectory()) files.push(...await tree(join(directory, entry.name), prefix + entry.name + '/'));
  else if (entry.isFile()) files.push(prefix + entry.name);
 }
 return files;
}
async function fingerprint(directory) {
 const result = {};
 for (const name of await tree(directory)) { const bytes = await readFile(join(directory, name)); result[name] = {bytes:bytes.length, sha256:sha(bytes)}; }
 return result;
}
async function readHTTP(name) {
 const response = await fetch(baseURL + '/' + name.split('/').map(encodeURIComponent).join('/'), {signal:AbortSignal.timeout(15000)});
 assert.equal(response.status, 200, name); return Buffer.from(await response.arrayBuffer());
}
function command(state, action) {
 const result = sdk.applyCommand(state, {runId:state.runId, expectedRevision:state.revision, action});
 assert(result.ok, `${state.day}/${action.type}: ${result.error}`); return result.state;
}
function checked(state) {const result = sdk.validateRun(state); assert(result.ok); assert.deepEqual(result.state, state); return result.state;}
function envelope(state) {
 const values = new Map(), storage = {getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key)};
 const repository = sdk.createV4SaveRepository(()=>storage, ()=>'2026-10-21T00:00:00.000Z'); repository.load();
 assert(repository.write(state).ok); const raw = values.get('sword-led.save.v4'); assert.equal(sdk.decodeV4Save(raw).status, 'valid'); return raw;
}
function monitor(page, label) {
 page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(25000);
 page.on('pageerror', error=>errors.push({label, kind:'pageerror', message:error.message}));
 page.on('console', item=>{if(item.type()==='error')errors.push({label,kind:'console',message:item.text()});});
 page.on('response', response=>{if(response.status()>=400)errors.push({label,kind:'http',message:`${response.status()} ${response.url()}`});});
}
async function slots(page) {return page.evaluate(()=>Object.fromEntries(['sword-led.save.v4','sword-led.save.backup.v4','sword-led.collection.v1','sword-led.collection.backup.v1'].map(key=>[key,localStorage.getItem(key)])));}
async function restored(state, label, viewport) {
 const context = await browser.newContext({baseURL, viewport}), page = await context.newPage(); monitor(page,label);
 const raw = envelope(state);
 await page.addInitScript(raw=>{if(!sessionStorage.getItem('before-guidance-restored')){localStorage.setItem('sword-led.save.v4',raw);sessionStorage.setItem('before-guidance-restored','true');}},raw);
 await page.goto('/'); await page.locator('#v4-continue:not(:disabled)').waitFor(); await page.locator('#v4-continue').click();
 await page.locator('#v4-workshop:not([hidden])').waitFor();
 assert.equal((await slots(page))['sword-led.save.v4'], raw);
 const actual = sdk.decodeV4Save((await slots(page))['sword-led.save.v4']); assert.equal(actual.status,'valid'); assert.deepEqual(actual.state,state);
 return {context, page, raw};
}
async function capture(page, label) {
 const text = await page.locator('body').innerText();
 const dialog = await page.locator('#v4-dialog').isVisible() ? {title:await page.locator('#v4-dialog-title').innerText(),body:await page.locator('#v4-dialog-body').innerText(),buttons:await page.locator('#v4-dialog-actions button').allTextContents()} : null;
 await page.screenshot({path:join(out,label+'.png')});
 await writeFile(join(out,label+'.txt'),text+'\n',{flag:'wx'});
 const result = {label, viewport:page.viewportSize(), objective:await page.locator('#v4-objective').count() ? await page.locator('#v4-objective').innerText() : await page.locator('.v4-objective').innerText().catch(()=>''), dialog, text};
 observations.push(result); return result;
}

try {
 const processCommand = execFileSync('rtk',['proxy','ps','-p','71430','-o','pid=,ppid=,command='],{encoding:'utf8'}).trim();
 assert.match(processCommand,/^71430\s+71409\s+node /); assert(processCommand.includes('--port 4179')); assert(processCommand.includes('--outDir '+snapshot));
 const runtime = await fingerprint(snapshot); assert.equal(Object.keys(runtime).length,75);
 const sdkBytes = await readFile(resolve(root,'dist/sword-led-v4.js')); assert.equal(sha(sdkBytes),runtime['sword-led-v4.js'].sha256);
 const http = [];
 for (const [name, expected] of Object.entries(runtime)) {
  const bytes = await readHTTP(name); assert.equal(sha(bytes),expected.sha256,name); assert.equal(bytes.length,expected.bytes,name);
  await mkdir(dirname(join(out,'runtime',name)),{recursive:true}); await writeFile(join(out,'runtime',name),bytes,{flag:'wx'});
  http.push({name,...expected});
 }
 await json('preview-binding.json',{at:startedAt,pid:71430,processCommand,snapshot:relative(root,snapshot),baseURL,index:runtime['index.html'],sdk:runtime['sword-led-v4.js'],http,runtime});
 const sourcePath = resolve(root,'docs/evidence/T11-4-2-3i1/witness-fixed/complete.json'), sourceBytes = await readFile(sourcePath), winner = checked(JSON.parse(sourceBytes));
 assert.equal(winner.phase,'victory'); assert.equal(winner.journal.length,210); await writeFile(join(out,'source-complete210.json'),sourceBytes,{flag:'wx'});
 const made = sdk.createRun({runId:winner.runId,seed:winner.seed,mode:winner.mode,eligibility:winner.initialEligibility}); assert(made.ok);
 let dayFour = made.state, replayed = 0;
 for (const action of winner.journal) {if(dayFour.day===4&&dayFour.phase==='workshop')break; dayFour=command(dayFour,action); replayed++;}
 checked(dayFour); assert.equal(dayFour.day,4); assert.equal(dayFour.phase,'workshop'); assert.equal(sdk.getRunView(dayFour).commission.progress.complete,false);
 await json('day-four-restored-boundary.json',{scope:'Explicit restored boundary, legal replay prefix of a historical 210-command victory; no new full-game browser playthrough.',source:relative(root,sourcePath),sourceSha256:sha(sourceBytes),replayed,state:dayFour});
 states.push(dayFour);
 let salvage;
 for(let index=0;index<64;index++) {
  const created = sdk.createRun({runId:`guidance-salvage-${index}`,seed:`v4-guidance-salvage-${index}`}); assert(created.ok);
  let state=command(created.state,{type:'continue'});
  while(state.day<3){state=command(state,{type:'settle'});assert.equal(state.phase,'summary');state=command(state,{type:'advance'});}
  const view=sdk.getRunView(state); trials.push({index,seed:state.seed,day:view.day,phase:view.phase,event:view.event?.id??null,status:view.event?.status??null,activeCandidates:view.blades.filter(item=>!item.reserved).length});
  if(view.event?.id==='salvage'&&view.event.status==='available'&&!state.reserveId&&view.blades.some(item=>!item.reserved)){salvage=checked(state);break;}
 }
 assert(salvage,'No public available salvage event found in the declared bounded seed range.');
 assert.equal(salvage.coins,0); assert.equal(salvage.seals,1); assert.equal(salvage.blades.filter(item=>item.status==='active').length,3);
 await json('salvage-trials.json',{scope:'First public available salvage event at day3, using only continue/settle/advance; no RNG inspected and no success-seed selection for a game result.',trials});
 await json('salvage-restored-boundary.json',{scope:'Explicit restored boundary from legal fresh creation and five public commands; no completed UI game or actual exchange.',state:salvage,publicEvent:sdk.getRunView(salvage).event,quote:sdk.eventQuote(salvage)}); states.push(salvage);
 browser = await chromium.launch({headless:true,args:['--no-proxy-server']});
 for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
  const size=`${viewport.width}x${viewport.height}`;
  const day = await restored(dayFour,'critical-'+size,viewport);
  try {
   const before=await slots(day.page); await day.page.locator('#v4-settle').click();
   const sample=await capture(day.page,'critical-settle-'+size); assert.equal(sample.dialog.title,'收好这一炉');
   assert.match(sample.dialog.body,/尚未完成主委托/); assert(!/关键|十二灯复明|4.{0,3}8.{0,3}12|至少.{0,3}10/.test(sample.dialog.body));
   await day.page.getByRole('button',{name:'再想想',exact:true}).click(); assert.deepEqual(await slots(day.page),before);
   assert.equal((await slots(day.page))['sword-led.save.v4'],day.raw);
   sample.scope='Restored day4 workshop; only opened and cancelled settlement confirmation. No settlement dispatched.'; sample.savedSlotsUnchangedAfterCancel=true;
  } finally {await day.context.close();}
  const old = await restored(salvage,'salvage-'+size,viewport);
  try {
   const before=await slots(old.page); await old.page.locator('#v4-event-open').click();
   const sample=await capture(old.page,'salvage-no-rack-'+size); assert.equal(sample.dialog.title,'旧刃回收');
   assert.match(sample.dialog.body,/剑架上没有留剑，可以拒绝这次交换/);
   assert.deepEqual(sample.dialog.buttons,['暂不决定','拒绝，保留眼前资源']);
   await old.page.getByRole('button',{name:'暂不决定',exact:true}).click(); assert.deepEqual(await slots(old.page),before);
   assert.equal((await slots(old.page))['sword-led.save.v4'],old.raw);
   sample.scope='Restored legal day3 salvage boundary, no reserve and three usable raw blades; only opened and cancelled event. No exchange/reserve/settlement dispatched.'; sample.savedSlotsUnchangedAfterCancel=true;
  } finally {await old.context.close();}
  const context=await browser.newContext({baseURL,viewport}),page=await context.newPage(); monitor(page,'opening-'+size);
  try {
   await page.goto('/'); await page.locator('#v4-start:not(:disabled)').waitFor(); await page.locator('.v4-journey-options summary').click(); await page.locator('#v4-seed').fill('v4-guidance-opening-before'); await page.locator('#v4-start').click();
   await page.locator('#v4-stage:not([hidden])').waitFor();
   const raw=(await slots(page))['sword-led.save.v4'],decoded=sdk.decodeV4Save(raw); assert.equal(decoded.status,'valid'); checked(decoded.state); assert.equal(decoded.state.phase,'opening'); assert.equal(decoded.state.journal.length,0);
   const sample=await capture(page,'opening-'+size); sample.scope='Actual fresh isolated UI creation; opening only, zero gameplay commands.'; states.push(decoded.state);
  } finally {await context.close();}
 }
 assert.deepEqual(errors,[]); assert.deepEqual(await fingerprint(snapshot),runtime); assert.equal(sha(await readHTTP('index.html')),runtime['index.html'].sha256);
 await json('states.json',states); await json('observations.json',observations);
 const findings={criticalBeforeSettle:'Both sizes show only pending-main/seal/recovery/reserve consequences. No identification of day4 as a critical promise or full twelve-light condition.',salvageWithoutRack:'Both sizes show no reserve, can decline; footer only defer/decline. No visible return-to-anvil/rack-and-reopen action or instructions.',opening:'Fresh opening states the immediate commission and seals but not the full critical-day/count requirement. Detailed original text and screenshots retained.'};
 await json('result.json',{startedAt,completedAt:new Date().toISOString(),scriptSha256:sha(await readFile(scriptPath)),scope:'Before-change independent headless Chromium observations, six screenshots at two PC sizes. Explicit restored boundaries are not completed UI playthroughs. No user browser/tab/profile/save accessed. No source, strategy, SDK, contract, official process or game rules modified.',previewPid:71430,runtimeFiles:75,observations:observations.length,checkedStates:states.length,findings,errors});
 console.log(JSON.stringify({completed:true,observations:observations.length,checkedStates:states.length,errors,output:relative(root,out)}));
} catch(error) {
 await json('failure.json',{at:new Date().toISOString(),startedAt,error:String(error),stack:error?.stack,observations,errors,trials,scope:'Failed before-change observation; no success receipt.'}); throw error;
} finally {await browser?.close();}
