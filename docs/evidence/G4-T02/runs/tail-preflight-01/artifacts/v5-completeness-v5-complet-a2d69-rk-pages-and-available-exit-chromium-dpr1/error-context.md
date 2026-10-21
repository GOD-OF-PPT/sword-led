# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v5-completeness.spec.ts >> v5 completeness restored second-chapter-defeat: factual ending art, real memories, work pages and available exit
- Location: tests/e2e/v5-completeness.spec.ts:50:72

# Error details

```
Error: expect(locator).not.toContainText(expected) failed

Locator: locator('[data-mastery="heavy"]')
Expected substring: not "可自由使用"
Received string: "重锋：随主线借用后解锁；走完相应章节即可自由使用交出等级≥9的合格名器，可留下熟练记录"
Timeout: 5000ms

Call log:
  - Expect "not toContainText" locator('[data-mastery="heavy"]') with timeout 5000ms
  - waiting for locator('[data-mastery="heavy"]')
    14 × locator resolved to <p data-mastery="heavy">…</p>
       - unexpected value "重锋：随主线借用后解锁；走完相应章节即可自由使用交出等级≥9的合格名器，可留下熟练记录"

```

```yaml
- paragraph: 重锋：随主线借用后解锁；走完相应章节即可自由使用 交出等级≥9的合格名器，可留下熟练记录
```

# Test source

```ts
  1  | // Current v5 UI boundaries. Each test labels restored fixtures and fresh openings explicitly.
  2  | import {test,expect} from '@playwright/test';
  3  | import type {Page,TestInfo} from '@playwright/test';
  4  | import {writeFile} from 'node:fs/promises';
  5  | import type {RunState} from '../../src/core-v5/index.js';
  6  | import {KeyboardV5,v5Sdk,v5VictoryGuide} from './v5-helpers.js';
  7  | import {buildJourney,replayV5} from './v5-plans.js';
  8  | import {acceptedByV5,giftFixture,reloadExactV5} from './v5-interaction-helpers.js';
  9  | import {startGame} from './helpers.js';
  10 | import {protectedTwinBoundaries} from './v5-completeness-helpers.js';
  11 | 
  12 | const OLD_KEYS=['sword-led.save.v1','sword-led.save.backup.v1','sword-led.save.v2','sword-led.save.backup.v2','sword-led.save.v3','sword-led.save.backup.v3','sword-led.save.v4','sword-led.save.backup.v4','sword-led.collection.v1','sword-led.collection.backup.v1']as const;
  13 | const oldSlots=(page:Page)=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),[...OLD_KEYS]);
  14 | const freshInput=(name:string)=>({runId:`T02-completeness-${name}`,seed:'v5-economy-0'});
  15 | 
  16 | test('v5 completeness: all five real entries preserve every old save slot across a current accepted strike',async({page},info)=>{
  17 |  const h=new KeyboardV5(page,info,'mouse');await h.install();
  18 |  const visit=async(url:string)=>{await page.waitForLoadState('networkidle');await page.goto(url);await h.assertDpr();};
  19 |  await page.goto('/legacy.html');await expect(page.locator('#new-game')).toBeEnabled();await startGame(page,'T02-real-old-entry');await expect(page.locator('#strike')).toBeEnabled();
  20 |  await visit('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.locator('#v2-new').click();await page.locator('#v2-starters button').first().click();await page.getByRole('button',{name:'这轮只做市场',exact:true}).click();await expect(page.locator('#v2-strike')).toBeVisible();
  21 |  await visit('/v3.html?mode=3');await expect(page.locator('#v3-hit')).toBeEnabled();await page.locator('#v3-hit').click();await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');
  22 |  await visit('/v4.html');await expect(page.locator('.v5-app')).toHaveCount(0);await expect(page.locator('#v4-start')).toBeEnabled();await page.locator('#v4-start').click();await page.getByRole('button',{name:'点火开炉',exact:true}).click();await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
  23 |  const before=await oldSlots(page);for(const key of ['sword-led.save.v1','sword-led.save.v2','sword-led.save.v3','sword-led.save.v4'])expect(before[key],key).not.toBeNull();
  24 |  await page.waitForLoadState('networkidle');await h.start('v5-economy-0');await h.command({type:'continue'});await h.command({type:'strike',pieceId:'d1-1'});expect(await oldSlots(page)).toEqual(before);
  25 |  const current=await h.record('all-five-entries-current-strike');expect(current.state.rulesVersion).toBe('forge-v5');expect(current.state.journal.map(action=>action.type)).toEqual(['continue','strike']);await reloadExactV5(h);expect(await oldSlots(page)).toEqual(before);
  26 |  await writeFile(info.outputPath('all-five-entry-old-slots.json'),JSON.stringify({scope:'Actual five-entry smoke plus one current-run strike, not five fresh complete games',oldBefore:before,oldAfter:await oldSlots(page),current:current.state},null,2));await h.finish({scope:'Actual legacy/v2/v3/v4/default entries, separate rule identities and ten old slots preserved byte-for-byte',freshUIJourneys:0});
  27 | });
  28 | 
  29 | type EndingKind='victory'|'return'|'second-chapter-defeat';
  30 | function endingBoundary(kind:EndingKind):RunState{
  31 |  const input=freshInput(kind);
  32 |  if(kind==='victory')return replayV5(v5Sdk,input,v5VictoryGuide);
  33 |  if(kind==='return')return buildJourney(v5Sdk,input,{preferOld:true,mixedRelay:true,skipDays:[4]}).state;
  34 |  const chapter=buildJourney(v5Sdk,input,{throughDay:4});
  35 |  return replayV5(v5Sdk,input,[...chapter.actions,{type:'advance'},{type:'settle'},{type:'advance'},{type:'settle'},{type:'advance'},{type:'settle'}]);
  36 | }
  37 | 
  38 | async function endingGeometry(h:KeyboardV5,info:TestInfo,kind:EndingKind,state:RunState){
  39 |  const image=h.page.locator('#v4-stage-image'),file=kind==='victory'?'ending-twelve-lights-v1.webp':kind==='return'?'ending-homeward-v1.webp':'ending-embers-v1.webp';
  40 |  for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]){
  41 |   await h.page.setViewportSize(viewport);await h.assertDpr();await h.page.evaluate(()=>document.fonts.ready);
  42 |   await expect(image).toHaveAttribute('src','/assets/d/v07-chapter3/'+file);await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);await expect(image).toHaveCSS('object-fit','contain');
  43 |   const actions=await h.page.locator('#v4-stage-actions button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:node.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,screenWidth:innerWidth,screenHeight:innerHeight,unoccluded:hit===node||!!hit&&node.contains(hit)};}));
  44 |   expect(actions.length).toBeGreaterThanOrEqual(3);for(const action of actions){expect(action.width,action.label??'').toBeGreaterThanOrEqual(44);expect(action.height,action.label??'').toBeGreaterThanOrEqual(44);expect(action.left).toBeGreaterThanOrEqual(0);expect(action.right).toBeLessThanOrEqual(viewport.width);expect(action.top).toBeGreaterThanOrEqual(0);expect(action.bottom).toBeLessThanOrEqual(viewport.height);expect(action.unoccluded,action.label??'').toBe(true);}
  45 |   expect(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await h.page.screenshot({path:info.outputPath(`restored-${kind}-${viewport.width}.png`)});await writeFile(info.outputPath(`restored-${kind}-${viewport.width}-geometry.json`),JSON.stringify({scope:'Restored replay-validated ending; native browser geometry, not a new full UI journey',phase:state.phase,metrics:await h.metrics(),actions},null,2));
  46 |  }
  47 |  await h.page.setViewportSize(info.project.use.viewport??{width:1280,height:720});await h.assertDpr();
  48 | }
  49 | 
  50 | for(const kind of ['victory','return','second-chapter-defeat']as const)test(`v5 completeness restored ${kind}: factual ending art, real memories, work pages and available exit`,async({page},info)=>{
  51 |  const h=new KeyboardV5(page,info,'mouse');await h.install();const source=endingBoundary(kind);expect(source.phase).toBe(kind==='second-chapter-defeat'?'defeat':kind);await h.restoreLegitimate(source);const before=await h.read();
  52 |  await expect(page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending',source.phase);await endingGeometry(h,info,kind,source);
  53 |  await h.activate(page.locator('.v4-ending-listen'));await expect(page.locator('.v4-ending-memories > h3')).toBeInViewport({ratio:.9});const people=page.locator('.v4-ending-person');await expect(people).toHaveCount(3);
  54 |  for(let index=0;index<3;index++){const person=people.nth(index);await h.activate(person.locator('summary'));await expect(person).toHaveAttribute('open','');}
  55 |  const memories=page.locator('.v4-ending-memory');await expect(memories).toHaveCount(12);
  56 |  for(const commissionId of source.commissionOrder){const record=source.history.find(item=>item.commissionId===commissionId);await expect(page.locator(`.v4-ending-memory[data-commission="${commissionId}"]`)).toHaveAttribute('data-result',record?record.met?'met':'missed':'unreached');}
  57 |  await expect(page.locator('.v4-ending-memory[data-result="met"]')).toHaveCount(source.history.filter(record=>record.met).length);await expect(page.locator('.v4-ending-memory[data-result="missed"]')).toHaveCount(source.history.filter(record=>!record.met).length);await expect(page.locator('.v4-ending-memory[data-result="unreached"]')).toHaveCount(12-source.history.length);
  58 |  if(kind==='victory'){
  59 |   await h.activate(page.locator('#v4-stage-actions').getByRole('button',{name:'翻开完整炉谱',exact:true}));await expect(page.locator('#v4-dialog-body [data-record][data-rules-version="forge-v5"]')).toHaveCount(12);const work=before.collection?.works.find(item=>item.commissionId===12);if(!work)throw Error('No legitimate final work');
  60 |   await h.activate(page.locator('#v4-dialog-body [data-record="12"]').getByRole('button',{name:'翻看这件作品',exact:true}));await expect(page.locator('#v4-dialog')).toHaveAttribute('data-kind','collection-work');const detail=page.locator('.v4-work-page');await expect(detail).toHaveAttribute('data-rules-version','forge-v5');expect(await page.locator('#v4-dialog-body').evaluate(node=>node.scrollTop)).toBe(0);await expect(detail.locator('h3').first()).toBeInViewport();await expect(detail.locator('canvas[data-blade]')).toHaveCount(work.blades.length);
  61 |   for(const blade of work.blades){const receipt=detail.locator(`[data-piece="${blade.id}"]`);await expect(receipt).toContainText(`${v5Sdk.RECIPES[blade.recipe].name} · ${blade.value.toLocaleString('zh-CN')}身价`);await expect(receipt).toContainText(`等级 ${blade.level} · 普通锤 ${blade.hits}次 · 安全连锻 ${blade.bursts}次 · ${blade.cracked?'有裂纹':'无裂纹'}`);await expect(receipt).toContainText(`来料底价 ${blade.base.toLocaleString('zh-CN')} · 曾达身价 ${blade.peak.toLocaleString('zh-CN')}`);}
  62 |   await h.activate(detail.locator('.v4-work-scene summary'));await expect(detail.locator('.v4-work-scene img')).toHaveAttribute('src','/assets/d/v07-chapter3/last-lantern-delivered-v1.webp');await expect.poll(()=>detail.locator('.v4-work-scene img').evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);await h.capture('actual-current-final-work-detail');await h.activate(page.getByRole('button',{name:'回到炉谱',exact:true}));await expect(page.locator('#v4-dialog-body [data-record]')).toHaveCount(12);await h.activate(page.getByRole('button',{name:'收好炉谱',exact:true}));
  63 |   await expect.poll(()=>page.evaluate(()=>{const active=document.activeElement;return active instanceof HTMLElement&&!!active.closest('#v4-stage-actions')&&active.getClientRects().length>0&&!active.closest('[hidden]');})).toBe(true);
  64 |  }
  65 |  if(kind==='second-chapter-defeat'){
> 66 |   expect(before.collection?.chapters).toEqual([1]);expect(before.collection?.challenge).toBe(false);await expect(page.getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);await h.activate(page.getByRole('button',{name:'看看留下的炉谱',exact:true}));await expect(page.locator('[data-mastery="guard"]')).toContainText('护刃：可自由使用');await expect(page.locator('[data-mastery="heavy"]')).toContainText('随主线借用后解锁');await expect(page.locator('[data-mastery="heavy"]')).not.toContainText('可自由使用');await h.activate(page.getByRole('button',{name:'收好炉谱',exact:true}));
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      ^ Error: expect(locator).not.toContainText(expected) failed
  67 |  }
  68 |  expect((await h.read()).raw).toEqual(before.raw);expect((await h.read()).state).toEqual(source);
  69 |  if(kind==='second-chapter-defeat'){
  70 |   await h.activate(page.getByRole('button',{name:'回到路口，再开一炉',exact:true}));await expect(page.locator('#v4-start')).toBeEnabled();expect((await h.read()).raw).toEqual(before.raw);await h.activate(page.locator('#v4-start'));await expect(page.locator('#v4-dialog-title')).toHaveText('另启一程？');await h.activate(page.getByRole('button',{name:'再想想',exact:true}));expect((await h.read()).raw).toEqual(before.raw);
  71 |   await h.activate(page.locator('#v4-start'));await h.confirm();const fresh=await h.record('actual-new-run-after-second-chapter-defeat');expect(fresh.state.runId).not.toBe(source.runId);expect(fresh.state).toMatchObject({phase:'opening',revision:0,coins:0,upgradeCount:0,inheritance:0,seals:3,traits:[],modifications:[],journal:[]});expect(fresh.state.blades).toHaveLength(3);expect(fresh.state.initialEligibility).toEqual({recipes:['light','guard'],challenge:false});expect(fresh.collection).toEqual(before.collection);
  72 |   const expected=v5Sdk.createRun({runId:fresh.state.runId,seed:fresh.state.seed,mode:'story',eligibility:v5Sdk.collectionEligibility(before.collection!)});if(!expected.ok)throw Error(expected.error);expect(fresh.state).toEqual(expected.state);const backup=await page.evaluate(()=>localStorage.getItem('sword-led.save.backup.v5'));const old=v5Sdk.decodeV5Save(backup);expect(old.status).toBe('valid');if(old.status==='valid')expect(old.state).toEqual(source);
  73 |  }
  74 |  await h.finish({scope:'Restored replay-validated ending; actual ending/collection/exit UI, not a fresh full journey',freshUIJourneys:0,ending:source.phase,actualNewOpening:kind==='second-chapter-defeat'});
  75 | });
  76 | 
  77 | for(const count of [0,1]as const)test(`v5 completeness restored twin ${count}/2: first actual pardon protects one miss, survives reload and cannot protect twice`,async({page},info)=>{
  78 |  const h=new KeyboardV5(page,info,'mouse');await h.install();const source=protectedTwinBoundaries(v5Sdk,giftFixture.input,giftFixture.marketActions)[count];await h.restoreLegitimate(source);expect(source.pardonUsed).toBe(false);expect(source.seals).toBe(3);expect(v5Sdk.commissionProgress(source).routes[0]?.count).toBe(count);const preview=v5Sdk.settlementPreview(source);expect(preview.protected).toBe(true);expect(preview.sealsAfter).toBe(3);
  79 |  const raw=(await h.read()).raw;await h.activate(page.locator('#v4-settle'));await expect(page.locator('#v4-dialog-body')).toContainText('护炉契');await h.activate(page.getByRole('button',{name:'再想想',exact:true}));expect((await h.read()).raw).toEqual(raw);
  80 |  const accepted=await acceptedByV5(h,{type:'settle'},async()=>{await h.activate(page.locator('#v4-settle'));await expect(page.locator('#v4-dialog-body')).toContainText('本局护印机会随后用尽');await h.confirm();});const settled=accepted.state;expect(settled.phase).toBe('chapter');expect(settled.history.at(-1)).toMatchObject({day:8,met:false,baseFees:count*125,sealsBefore:3,sealsAfter:3,protected:true});expect(settled.pardonUsed).toBe(true);expect(settled.coins).toBe(source.coins+preview.recovered);expect(settled.chapterChoices).toEqual(['windbox','wideMouth']);
  81 |  await expect(page.locator('#v4-stage-title')).toHaveText(count?'一站有灯，一站仍在风雪里':'双驿仍在等剑');await expect(page.locator('#v4-stage-image')).toHaveAttribute('src',`/assets/d/v07-chapter2/twin-stations-${count?'one':'dark'}-v1.webp`);await expect(page.locator('#v4-stage-copy .v4-delivery-works canvas[data-blade]')).toHaveCount(count);const protection=page.locator('.v4-protection-receipt');await protection.scrollIntoViewIfNeeded();await expect(protection).toBeInViewport({ratio:1});await expect(protection).toContainText('本局不会再次保印');await expect(page.locator('#v4-stage-copy [data-modification]')).toHaveCount(2);await expect(page.locator('#v4-stage-copy [data-modification="warmRack"]')).toHaveCount(0);await h.capture(`actual-first-protected-twin-${count}`);
  82 |  const choice=count?'windbox':'wideMouth',chosen=await h.command({type:'chooseModification',modification:choice});expect(chosen.modifications).toEqual(['warmRack',choice]);expect(chosen.pardonUsed).toBe(true);await expect(page.locator('#v4-stage-copy')).toContainText(`双驿实际交付 ${count}/2`);await expect(page.locator('#v4-stage-copy')).toContainText('护炉契保住了这次契印');await reloadExactV5(h);await expect(page.locator('#v4-stage-copy')).toContainText('护炉契保住了这次契印');const saved=await h.read();expect(saved.collection?.chapters).toEqual([1,2]);expect(saved.collection?.works.some(work=>work.commissionId===8)).toBe(false);
  83 |  await h.command({type:'advance'});await h.leaveIntro();await expect(page.locator('[data-trait="pardon"]')).toContainText('已用');const second=await h.command({type:'settle'});expect(second.history.at(-1)).toMatchObject({day:9,met:false,sealsBefore:3,sealsAfter:2,protected:false});expect(second.pardonUsed).toBe(true);await reloadExactV5(h);await h.finish({scope:'Restored legitimate day8 prefix; actual first UI pardon consumption, reload and a later unprotected miss. Original unprotected0/1 cases remain unchanged.',freshUIJourneys:0,partialCount:count,prefixCommands:source.journal.length,acceptedAfterRestore:h.accepted.length});
  84 | });
  85 | 
```