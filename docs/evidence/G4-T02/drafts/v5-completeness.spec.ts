// UNEXECUTED DRAFT. Copy with its helper to tests/e2e only after matrix-01 is terminal
// and its frozen fingerprints verify. This file is outside the active testDir/glob.
import {test,expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {RunState} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Sdk,v5VictoryGuide} from './v5-helpers.js';
import {buildJourney,replayV5} from './v5-plans.js';
import {acceptedByV5,giftFixture,reloadExactV5} from './v5-interaction-helpers.js';
import {startGame} from './helpers.js';
import {protectedTwinBoundaries} from './v5-completeness-helpers.js';

const OLD_KEYS=['sword-led.save.v1','sword-led.save.backup.v1','sword-led.save.v2','sword-led.save.backup.v2','sword-led.save.v3','sword-led.save.backup.v3','sword-led.save.v4','sword-led.save.backup.v4','sword-led.collection.v1','sword-led.collection.backup.v1']as const;
const oldSlots=(page:Page)=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),[...OLD_KEYS]);
const freshInput=(name:string)=>({runId:`T02-completeness-${name}`,seed:'v5-economy-0'});

test('v5 completeness: all five real entries preserve every old save slot across a current accepted strike',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();
 const visit=async(url:string)=>{await page.waitForLoadState('networkidle');await page.goto(url);await h.assertDpr();};
 await page.goto('/legacy.html');await expect(page.locator('#new-game')).toBeEnabled();await startGame(page,'T02-real-old-entry');await expect(page.locator('#strike')).toBeEnabled();
 await visit('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.locator('#v2-new').click();await page.locator('#v2-starters button').first().click();await page.getByRole('button',{name:'这轮只做市场',exact:true}).click();await expect(page.locator('#v2-strike')).toBeVisible();
 await visit('/v3.html?mode=3');await expect(page.locator('#v3-hit')).toBeEnabled();await page.locator('#v3-hit').click();await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');
 await visit('/v4.html');await expect(page.locator('.v5-app')).toHaveCount(0);await expect(page.locator('#v4-start')).toBeEnabled();await page.locator('#v4-start').click();await page.getByRole('button',{name:'点火开炉',exact:true}).click();await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
 const before=await oldSlots(page);for(const key of ['sword-led.save.v1','sword-led.save.v2','sword-led.save.v3','sword-led.save.v4'])expect(before[key],key).not.toBeNull();
 await page.waitForLoadState('networkidle');await h.start('v5-economy-0');await h.command({type:'continue'});await h.command({type:'strike',pieceId:'d1-1'});expect(await oldSlots(page)).toEqual(before);
 const current=await h.record('all-five-entries-current-strike');expect(current.state.rulesVersion).toBe('forge-v5');expect(current.state.journal.map(action=>action.type)).toEqual(['continue','strike']);await reloadExactV5(h);expect(await oldSlots(page)).toEqual(before);
 await writeFile(info.outputPath('all-five-entry-old-slots.json'),JSON.stringify({scope:'Actual five-entry smoke plus one current-run strike, not five fresh complete games',oldBefore:before,oldAfter:await oldSlots(page),current:current.state},null,2));await h.finish({scope:'Actual legacy/v2/v3/v4/default entries, separate rule identities and ten old slots preserved byte-for-byte',freshUIJourneys:0});
});

type EndingKind='victory'|'return'|'second-chapter-defeat';
function endingBoundary(kind:EndingKind):RunState{
 const input=freshInput(kind);
 if(kind==='victory')return replayV5(v5Sdk,input,v5VictoryGuide);
 if(kind==='return')return buildJourney(v5Sdk,input,{preferOld:true,mixedRelay:true,skipDays:[4]}).state;
 const chapter=buildJourney(v5Sdk,input,{throughDay:4});
 return replayV5(v5Sdk,input,[...chapter.actions,{type:'advance'},{type:'settle'},{type:'advance'},{type:'settle'},{type:'advance'},{type:'settle'}]);
}

async function endingGeometry(h:KeyboardV5,info:TestInfo,kind:EndingKind,state:RunState){
 const image=h.page.locator('#v4-stage-image'),file=kind==='victory'?'ending-twelve-lights-v1.webp':kind==='return'?'ending-homeward-v1.webp':'ending-embers-v1.webp';
 for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]){
  await h.page.setViewportSize(viewport);await h.assertDpr();await h.page.evaluate(()=>document.fonts.ready);
  await expect(image).toHaveAttribute('src','/assets/d/v07-chapter3/'+file);await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);await expect(image).toHaveCSS('object-fit','contain');
  const actions=await h.page.locator('#v4-stage-actions button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:node.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,screenWidth:innerWidth,screenHeight:innerHeight,unoccluded:hit===node||!!hit&&node.contains(hit)};}));
  expect(actions.length).toBeGreaterThanOrEqual(3);for(const action of actions){expect(action.width,action.label??'').toBeGreaterThanOrEqual(44);expect(action.height,action.label??'').toBeGreaterThanOrEqual(44);expect(action.left).toBeGreaterThanOrEqual(0);expect(action.right).toBeLessThanOrEqual(viewport.width);expect(action.top).toBeGreaterThanOrEqual(0);expect(action.bottom).toBeLessThanOrEqual(viewport.height);expect(action.unoccluded,action.label??'').toBe(true);}
  expect(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await h.page.screenshot({path:info.outputPath(`restored-${kind}-${viewport.width}.png`)});await writeFile(info.outputPath(`restored-${kind}-${viewport.width}-geometry.json`),JSON.stringify({scope:'Restored replay-validated ending; native browser geometry, not a new full UI journey',phase:state.phase,metrics:await h.metrics(),actions},null,2));
 }
 await h.page.setViewportSize(info.project.use.viewport??{width:1280,height:720});await h.assertDpr();
}

for(const kind of ['victory','return','second-chapter-defeat']as const)test(`v5 completeness restored ${kind}: factual ending art, real memories, work pages and available exit`,async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const source=endingBoundary(kind);expect(source.phase).toBe(kind==='second-chapter-defeat'?'defeat':kind);await h.restoreLegitimate(source);const before=await h.read();
 await expect(page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending',source.phase);await endingGeometry(h,info,kind,source);
 await h.activate(page.locator('.v4-ending-listen'));await expect(page.locator('.v4-ending-memories > h3')).toBeInViewport({ratio:.9});const people=page.locator('.v4-ending-person');await expect(people).toHaveCount(3);
 for(let index=0;index<3;index++){const person=people.nth(index);await h.activate(person.locator('summary'));await expect(person).toHaveAttribute('open','');}
 const memories=page.locator('.v4-ending-memory');await expect(memories).toHaveCount(12);
 for(const commissionId of source.commissionOrder){const record=source.history.find(item=>item.commissionId===commissionId);await expect(page.locator(`.v4-ending-memory[data-commission="${commissionId}"]`)).toHaveAttribute('data-result',record?record.met?'met':'missed':'unreached');}
 await expect(page.locator('.v4-ending-memory[data-result="met"]')).toHaveCount(source.history.filter(record=>record.met).length);await expect(page.locator('.v4-ending-memory[data-result="missed"]')).toHaveCount(source.history.filter(record=>!record.met).length);await expect(page.locator('.v4-ending-memory[data-result="unreached"]')).toHaveCount(12-source.history.length);
 if(kind==='victory'){
  await h.activate(page.locator('#v4-stage-actions').getByRole('button',{name:'翻开完整炉谱',exact:true}));await expect(page.locator('#v4-dialog-body [data-record][data-rules-version="forge-v5"]')).toHaveCount(12);const work=before.collection?.works.find(item=>item.commissionId===12);if(!work)throw Error('No legitimate final work');
  await h.activate(page.locator('#v4-dialog-body [data-record="12"]').getByRole('button',{name:'翻看这件作品',exact:true}));await expect(page.locator('#v4-dialog')).toHaveAttribute('data-kind','collection-work');const detail=page.locator('.v4-work-page');await expect(detail).toHaveAttribute('data-rules-version','forge-v5');expect(await page.locator('#v4-dialog-body').evaluate(node=>node.scrollTop)).toBe(0);await expect(detail.locator('h3').first()).toBeInViewport();await expect(detail.locator('canvas[data-blade]')).toHaveCount(work.blades.length);
  for(const blade of work.blades){const receipt=detail.locator(`[data-piece="${blade.id}"]`);await expect(receipt).toContainText(`${v5Sdk.RECIPES[blade.recipe].name} · ${blade.value.toLocaleString('zh-CN')}身价`);await expect(receipt).toContainText(`等级 ${blade.level} · 普通锤 ${blade.hits}次 · 安全连锻 ${blade.bursts}次 · ${blade.cracked?'有裂纹':'无裂纹'}`);await expect(receipt).toContainText(`来料底价 ${blade.base.toLocaleString('zh-CN')} · 曾达身价 ${blade.peak.toLocaleString('zh-CN')}`);}
  await h.activate(detail.locator('.v4-work-scene summary'));await expect(detail.locator('.v4-work-scene img')).toHaveAttribute('src','/assets/d/v07-chapter3/last-lantern-delivered-v1.webp');await expect.poll(()=>detail.locator('.v4-work-scene img').evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);await h.capture('actual-current-final-work-detail');await h.activate(page.getByRole('button',{name:'回到炉谱',exact:true}));await expect(page.locator('#v4-dialog-body [data-record]')).toHaveCount(12);await h.activate(page.getByRole('button',{name:'收好炉谱',exact:true}));
  await expect.poll(()=>page.evaluate(()=>{const active=document.activeElement;return active instanceof HTMLElement&&!!active.closest('#v4-stage-actions')&&active.getClientRects().length>0&&!active.closest('[hidden]');})).toBe(true);
 }
 if(kind==='second-chapter-defeat'){
  expect(before.collection?.chapters).toEqual([1]);expect(before.collection?.challenge).toBe(false);await expect(page.getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);await h.activate(page.getByRole('button',{name:'看看留下的炉谱',exact:true}));await expect(page.locator('[data-mastery="guard"]')).toContainText('护刃：可自由使用');await expect(page.locator('[data-mastery="heavy"]')).toContainText('随主线借用后解锁');await expect(page.locator('[data-mastery="heavy"]')).not.toContainText('可自由使用');await h.activate(page.getByRole('button',{name:'收好炉谱',exact:true}));
 }
 expect((await h.read()).raw).toEqual(before.raw);expect((await h.read()).state).toEqual(source);
 if(kind==='second-chapter-defeat'){
  await h.activate(page.getByRole('button',{name:'回到路口，再开一炉',exact:true}));await expect(page.locator('#v4-start')).toBeEnabled();expect((await h.read()).raw).toEqual(before.raw);await h.activate(page.locator('#v4-start'));await expect(page.locator('#v4-dialog-title')).toHaveText('另启一程？');await h.activate(page.getByRole('button',{name:'再想想',exact:true}));expect((await h.read()).raw).toEqual(before.raw);
  await h.activate(page.locator('#v4-start'));await h.confirm();const fresh=await h.record('actual-new-run-after-second-chapter-defeat');expect(fresh.state.runId).not.toBe(source.runId);expect(fresh.state).toMatchObject({phase:'opening',revision:0,coins:0,upgradeCount:0,inheritance:0,seals:3,traits:[],modifications:[],journal:[]});expect(fresh.state.blades).toHaveLength(3);expect(fresh.state.initialEligibility).toEqual({recipes:['light','guard'],challenge:false});expect(fresh.collection).toEqual(before.collection);
  const expected=v5Sdk.createRun({runId:fresh.state.runId,seed:fresh.state.seed,mode:'story',eligibility:v5Sdk.collectionEligibility(before.collection!)});if(!expected.ok)throw Error(expected.error);expect(fresh.state).toEqual(expected.state);const backup=await page.evaluate(()=>localStorage.getItem('sword-led.save.backup.v5'));const old=v5Sdk.decodeV5Save(backup);expect(old.status).toBe('valid');if(old.status==='valid')expect(old.state).toEqual(source);
 }
 await h.finish({scope:'Restored replay-validated ending; actual ending/collection/exit UI, not a fresh full journey',freshUIJourneys:0,ending:source.phase,actualNewOpening:kind==='second-chapter-defeat'});
});

for(const count of [0,1]as const)test(`v5 completeness restored twin ${count}/2: first actual pardon protects one miss, survives reload and cannot protect twice`,async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const source=protectedTwinBoundaries(v5Sdk,giftFixture.input,giftFixture.marketActions)[count];await h.restoreLegitimate(source);expect(source.pardonUsed).toBe(false);expect(source.seals).toBe(3);expect(v5Sdk.commissionProgress(source).routes[0]?.count).toBe(count);const preview=v5Sdk.settlementPreview(source);expect(preview.protected).toBe(true);expect(preview.sealsAfter).toBe(3);
 const raw=(await h.read()).raw;await h.activate(page.locator('#v4-settle'));await expect(page.locator('#v4-dialog-body')).toContainText('护炉契');await h.activate(page.getByRole('button',{name:'再想想',exact:true}));expect((await h.read()).raw).toEqual(raw);
 const accepted=await acceptedByV5(h,{type:'settle'},async()=>{await h.activate(page.locator('#v4-settle'));await expect(page.locator('#v4-dialog-body')).toContainText('本局护印机会随后用尽');await h.confirm();});const settled=accepted.state;expect(settled.phase).toBe('chapter');expect(settled.history.at(-1)).toMatchObject({day:8,met:false,baseFees:count*125,sealsBefore:3,sealsAfter:3,protected:true});expect(settled.pardonUsed).toBe(true);expect(settled.coins).toBe(source.coins+preview.recovered);expect(settled.chapterChoices).toEqual(['windbox','wideMouth']);
 await expect(page.locator('#v4-stage-title')).toHaveText(count?'一站有灯，一站仍在风雪里':'双驿仍在等剑');await expect(page.locator('#v4-stage-image')).toHaveAttribute('src',`/assets/d/v07-chapter2/twin-stations-${count?'one':'dark'}-v1.webp`);await expect(page.locator('#v4-stage-copy .v4-delivery-works canvas[data-blade]')).toHaveCount(count);const protection=page.locator('.v4-protection-receipt');await protection.scrollIntoViewIfNeeded();await expect(protection).toBeInViewport({ratio:1});await expect(protection).toContainText('本局不会再次保印');await expect(page.locator('#v4-stage-copy [data-modification]')).toHaveCount(2);await expect(page.locator('#v4-stage-copy [data-modification="warmRack"]')).toHaveCount(0);await h.capture(`actual-first-protected-twin-${count}`);
 const choice=count?'windbox':'wideMouth',chosen=await h.command({type:'chooseModification',modification:choice});expect(chosen.modifications).toEqual(['warmRack',choice]);expect(chosen.pardonUsed).toBe(true);await expect(page.locator('#v4-stage-copy')).toContainText(`双驿实际交付 ${count}/2`);await expect(page.locator('#v4-stage-copy')).toContainText('护炉契保住了这次契印');await reloadExactV5(h);await expect(page.locator('#v4-stage-copy')).toContainText('护炉契保住了这次契印');const saved=await h.read();expect(saved.collection?.chapters).toEqual([1,2]);expect(saved.collection?.works.some(work=>work.commissionId===8)).toBe(false);
 await h.command({type:'advance'});await h.leaveIntro();await expect(page.locator('[data-trait="pardon"]')).toContainText('已用');const second=await h.command({type:'settle'});expect(second.history.at(-1)).toMatchObject({day:9,met:false,sealsBefore:3,sealsAfter:2,protected:false});expect(second.pardonUsed).toBe(true);await reloadExactV5(h);await h.finish({scope:'Restored legitimate day8 prefix; actual first UI pardon consumption, reload and a later unprotected miss. Original unprotected0/1 cases remain unchanged.',freshUIJourneys:0,partialCount:count,prefixCommands:source.journal.length,acceptedAfterRestore:h.accepted.length});
});
