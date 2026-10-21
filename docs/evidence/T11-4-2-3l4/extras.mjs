import {harness,assert,expect,sdk,readFile,writeFile} from './ui/helpers.mjs';
import * as legacy from '../../dist/sword-led-v4.js';
const url='http://127.0.0.1:4210/',base='tmp/T11-4-2-3l4/extras-02';
const records=JSON.parse(await readFile('tmp/T11-4-2-3l4/ui/run-02/states.json','utf8'));
function raw(state,extra={}){assert(sdk.validateRun(state).ok);const map=new Map(),repo=sdk.createV5SaveRepository(()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}));repo.load();assert(repo.write(state).ok);return{...Object.fromEntries(map),...extra};}
async function restored(name,state){const h=await harness(`${base}/${name}`,url,raw(state));await h.page.goto(url);await expect(h.page.locator('#v4-continue')).toBeEnabled();await h.page.locator('#v4-continue').click();assert.deepEqual(await h.keep('legal-prefix-restored'),state);return h;}
async function manual(h,action,input){const before=await h.actual(),expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});assert(expected.ok,expected.error);await input();await expect.poll(async()=>(await h.actual()).revision).toBe(expected.state.revision);assert.deepEqual(await h.actual(),expected.state);h.actions.push({action,events:expected.events,coinsBefore:before.coins,coinsAfter:expected.state.coins});await writeFile(`${h.out}/actions.json`,JSON.stringify(h.actions,null,2));await h.keep(action.type);return expected;}
const summary=[];
{
 const state=records.find(o=>o.state.day===3&&o.state.phase==='workshop'&&o.state.eventId==='donation').state,h=await restored('donation',state);
 try{
  await h.ui({type:'reserve',pieceId:'d3-3'},0);
  await h.page.locator('#v4-event-open').click();await expect(h.page.locator('#v4-dialog-body')).toContainText('留剑时两柄');await h.close();
  await h.ui({type:'chooseEvent',choice:'accept',pieceId:'d3-2'},1);await h.ui({type:'settle'},2);
  await expect(h.page.locator('#v4-stage-copy')).toContainText('新坯2柄');await expect(h.page.locator('#v4-stage-copy')).not.toContainText('三个铁坯');
  await h.page.screenshot({path:`${h.out}/receipt-1280.png`});await h.ui({type:'advance'},3);
  const after=await h.actual(),fresh=after.blades.filter(b=>b.suppliedDay===4);assert.equal(fresh.length,2);assert(fresh.every(b=>b.base===48));assert.equal(after.blades.find(b=>b.id==='d3-3').value,40);await h.finish({scope:'actual donation with reserved old sword; only two new blanks receive20%',freshBases:fresh.map(b=>b.base),oldValue:40});summary.push({case:'donation',commands:h.actions.length});
 }catch(e){await h.fail(e);throw e;}finally{await h.dispose();}
}
{
 const state=records.find(o=>o.state.day===9&&o.state.phase==='workshop'&&o.state.eventId==='loan').state,h=await restored('loan',state);
 try{
  await h.ui({type:'reserve',pieceId:'d9-3'},0);await h.page.locator('#v4-event-open').click();await expect(h.page.locator('#v4-dialog-body')).toContainText('第一柄新坯');await h.close();
  await h.ui({type:'chooseEvent',choice:'accept'},1);await h.ui({type:'settle'},2);await expect(h.page.locator('#v4-stage-copy')).toContainText('第一柄新坯');await h.ui({type:'advance'},3);
  await h.ui({type:'reserve',pieceId:'d9-3'},4);await h.ui({type:'strike',pieceId:'d9-3'},5);assert(!h.actions.at(-1).events.find(e=>e.type==='Strike').hits.some(hit=>hit.triggers.includes('loan')));
  await h.ui({type:'strike',pieceId:'d10-1'},6);assert(h.actions.at(-1).events.find(e=>e.type==='Strike').hits.some(hit=>hit.triggers.includes('loan')));
  await h.ui({type:'strike',pieceId:'d10-2'},7);assert(!h.actions.at(-1).events.find(e=>e.type==='Strike').hits.some(hit=>hit.triggers.includes('loan')));
  await h.finish({scope:'real loan effect belongs to first new blank; retained old and second blank do not trigger'});summary.push({case:'loan',commands:h.actions.length});
 }catch(e){await h.fail(e);throw e;}finally{await h.dispose();}
}
{
 const state=records.find(o=>o.state.day===12&&o.state.phase==='workshop').state,h=await restored('final-rack',state);
 try{
  await h.select('d12-3');await manual(h,{type:'reserve',pieceId:'d12-3'},async()=>{await h.page.locator('#v4-reserve').click();await expect(h.page.locator('#v4-dialog-body')).toContainText('不会带入新局');await h.confirm();});
  for(const id of ['d12-1','d12-2']){await h.select(id);await manual(h,{type:'scrap',pieceId:id},async()=>{await h.page.locator('#v4-scrap').click();await h.confirm();});}
  await expect(h.page.locator('#v4-plan-copy')).toContainText('不会带入新局');await expect(h.page.locator('#v5-rack-title')).toHaveText('本局暂放的剑');await expect(h.page.locator('#v4-reserve-zone')).toHaveAttribute('aria-label','本局暂放的剑');
  await h.unchanged('reserved navigation is zero economy',async()=>{await h.page.locator('#v4-strike').click();await expect(h.page.locator('#v4-status')).toContainText('不会带入新局');});await h.capture('last-day-only-reserved');
  await h.finish({scope:'final-day rack/nav conveys local-only retention; same reserve rule'});summary.push({case:'final-rack',commands:h.actions.length});
 }catch(e){await h.fail(e);throw e;}finally{await h.dispose();}
}
{
 const oldRun=JSON.parse(await readFile('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')),awards=legacy.collectionFromRun(oldRun);assert(awards.ok);
 const oldRaw=JSON.stringify({schemaVersion:1,rulesVersion:'forge-v4-collection-v1',savedAt:'2026-10-21T00:00:00.000Z',state:awards.state});
 const created=sdk.createRun({runId:'preview-list',seed:'preview-list'});assert(created.ok);const h=await harness(`${base}/legacy-list`,url,raw(created.state,{'sword-led.collection.v1':oldRaw}));
 try{
  await h.page.goto(url);await expect(h.page.locator('#v4-continue')).toBeEnabled();await h.page.locator('#v4-continue').click();await h.keep('new-run-before-import');
  async function preview(){await h.page.locator('#v4-book').click();await h.page.getByRole('button',{name:'旧炉谱主册导入',exact:true}).click();await expect(h.page.locator('#v4-dialog-title')).toHaveText('把旧炉谱带上路');}
  await preview();const section=h.page.locator('.v5-import-unlocks');await expect(section).toContainText('章节：');for(const id of awards.state.chapters)await expect(section).toContainText(sdk.CHAPTERS[id-1].title);for(const id of awards.state.mastery)await expect(section).toContainText(sdk.RECIPES[id].name);for(const id of awards.state.traits)await expect(section).toContainText(sdk.TRAITS[id].name);await expect(section).toContainText('行脚挑战：已解锁');await expect(section).toContainText('合并后可用配方');
    await h.page.screenshot({path:`${h.out}/unlock-preview-1280.png`});
  await h.page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(h.page.locator('#v4-dialog')).not.toBeVisible();assert.equal((await h.raw()).collection,null);assert.deepEqual(await h.actual(),created.state);h.checks.push({label:'synthetic blur exercises controller cancellation, not native OS lifecycle',ok:true});
  await preview();await h.page.getByRole('button',{name:'确认导入这份炉谱',exact:true}).click();await expect(h.page.locator('#v4-dialog-title')).toHaveText('炉谱 · 带得走的手艺');assert.deepEqual(await h.keep('confirmed-old-unlocks-current-run-frozen'),created.state);await h.finish({scope:'all displayed unlock sets; canceled preview requires new preview before import',syntheticBlurNotNativeLifecycle:true});summary.push({case:'legacy-list',commands:h.actions.length});
 }catch(e){await h.fail(e);throw e;}finally{await h.dispose();}
}
await writeFile(`${base}/summary.json`,JSON.stringify({ok:true,cases:summary,domainCommands:summary.reduce((n,c)=>n+c.commands,0),scope:'specific R3.23 fixes from real UI prefixes; not additional full runs'},null,2)+'\n');console.log(JSON.stringify({ok:true,cases:summary.length,domainCommands:summary.reduce((n,c)=>n+c.commands,0)}));
