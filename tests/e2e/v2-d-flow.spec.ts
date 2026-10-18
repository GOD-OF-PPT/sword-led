import {test,expect} from './fixtures';
import {keyActivate,tabTo} from './keyboard';
import {applyCommand,validateRun} from '../../src/core-v2/index.js';
import type {Action,RunState} from '../../src/core-v2/index.js';
import {HAMMERS,TECHNIQUES,SECTION_NAMES} from '../../src/core-v2/rules.js';
import {readFile} from 'node:fs/promises';
import type {Page,TestInfo} from '@playwright/test';

async function state(page:Page):Promise<RunState>{const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));if(!raw)throw Error('missing actual disk state');const r=validateRun(JSON.parse(raw).state);if(!r.ok)throw Error(r.detail);return r.state;}
async function boot(page:Page,seed:string,keyboard=false){await page.clock.install({time:new Date('2026-10-19T10:00:00Z')});await page.goto('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.clock.pauseAt(new Date('2026-10-19T10:01:00Z'));if(keyboard){await tabTo(page,'#v2-seed');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(seed);await keyActivate(page,'#v2-new');}else{await page.locator('#v2-seed').fill(seed);await page.locator('#v2-new').click();}}
async function activate(page:Page,selector:string,keyboard:boolean){if(keyboard)await keyActivate(page,selector);else await page.locator(selector).click();}
async function confirm(page:Page,keyboard:boolean){await expect(page.locator('#v2-dialog')).toBeVisible();await activate(page,'#v2-dialog-actions button:last-child',keyboard);}
async function runAction(page:Page,action:Action,keyboard:boolean){
  if('pieceId'in action){const slot=Number(action.pieceId.split(':')[1])-1;if(keyboard)await page.keyboard.press(String(slot+1));else await page.locator(`#v2-piece-${slot}`).click();}
  if(action.type==='chooseTechnique'){const i=await page.locator('#v2-starters button').allTextContents();const index=i.findIndex(s=>s.includes(TECHNIQUES[action.techniqueId].label));await activate(page,`#v2-starters button:nth-child(${index+1})`,keyboard);}
  else if(action.type==='chooseRequest'){if(action.requestId===null)await activate(page,'#v2-decline',keyboard);else{const s=await state(page),index=s.requests.findIndex(r=>r.id===action.requestId);await activate(page,`#v2-requests button:nth-child(${index+1})`,keyboard);}}
  else if(action.type==='strike'){
    if(keyboard){await page.keyboard.press(action.mode==='light'?'q':action.mode==='heavy'?'e':'w');for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');await page.keyboard.press(action.node<5?'ArrowDown':'ArrowUp');for(let i=0;i<action.node%5;i++)await page.keyboard.press('ArrowRight');await expect(page.locator('#v2-strike')).toBeFocused();}
    else{await page.locator(`#v2-mode-${action.mode}`).click();await page.locator(`#v2-node-${action.node}`).click();await expect(page.locator('#v2-strike')).toBeFocused();}
    expect(action.timingMark).toBe(5000);await page.keyboard.down('Space');await page.clock.runFor(HAMMERS[action.mode].periodMs/4);await page.keyboard.up('Space');
  }else if(action.type==='buy'){
    const s=await state(page);if(action.productId==='repair')await activate(page,'#v2-phase-content > button',keyboard);else{const index=s.merchant.indexOf(action.productId);await activate(page,`.merchant-card:nth-of-type(${index+1}) button`,keyboard);if(action.replaceId){await expect(page.locator('#v2-dialog-title')).toContainText('换下');const index=s.techniques.indexOf(action.replaceId);await activate(page,`#v2-dialog-body button:nth-of-type(${index+1})`,keyboard);}}
    await confirm(page,keyboard);
  }else if(action.type==='advanceSummary'||action.type==='leaveMerchant')await activate(page,'#v2-phase-actions button:first-child',keyboard);
  else{await activate(page,action.type==='quench'?`#v2-${action.medium}`:action.type==='settleRound'?'#v2-settle':`#v2-${action.type==='scrap'?'scrap':action.type}`,keyboard);await confirm(page,keyboard);}
}
async function shot(page:Page,info:TestInfo,name:string){const path=info.outputPath(name+'.png');await page.screenshot({path});await info.attach(name,{path,contentType:'image/png'});}

test('D keyboard-only twelve-round campaign reaches all three merchants, keeps exact rules and reloads victory',async({page},info)=>{
  test.setTimeout(480000);await page.addInitScript(()=>{Reflect.set(window,'dPointerCount',0);window.addEventListener('pointerdown',()=>Reflect.set(window,'dPointerCount',Number(Reflect.get(window,'dPointerCount'))+1));});
  const witness=validateRun(JSON.parse(await readFile('docs/evidence/T11-2/simulation/victory.json','utf8')));if(!witness.ok)throw Error(witness.detail);
  await boot(page,witness.state.seed,true);let expected=await state(page);const visited:number[]=[];let reloaded=false,pointerEvents=0;
  for(const[actionIndex,action]of witness.state.journal.entries()){
    await runAction(page,action,true);const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action});if(!r.ok)throw Error(`${actionIndex}: ${r.error}`);expected=r.state;expect(await state(page)).toEqual(expected);
    if(action.type==='advanceSummary'&&expected.phase==='merchant'){visited.push(expected.round);await shot(page,info,`d-keyboard-merchant-${expected.round}`);}
    if(expected.round===4&&expected.phase==='workshop'&&expected.requestDecided&&!reloaded){reloaded=true;pointerEvents+=await page.evaluate(()=>Number(Reflect.get(window,'dPointerCount')));await page.reload();await expect(page.locator('#v2-continue')).toBeEnabled();await keyActivate(page,'#v2-continue');expect(await state(page)).toEqual(expected);}
    if(expected.round===4&&action.type==='chooseRequest'){await page.setViewportSize({width:1280,height:720});for(const selector of['#v2-node-0','#v2-node-9','#v2-strike','#v2-deliver','#v2-techniques','#v2-price-preview','#v2-current-request'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});await shot(page,info,'d-three-techniques-720');}
  }
  expect(visited).toEqual([3,6,9]);expect(expected).toMatchObject({phase:'victory',round:12,seals:3,coins:5258});expect(expected.journal).toHaveLength(301);pointerEvents+=await page.evaluate(()=>Number(Reflect.get(window,'dPointerCount')));expect(pointerEvents).toBe(0);
  await shot(page,info,'d-keyboard-victory');await page.reload();await keyActivate(page,'#v2-continue');await expect(page.locator('#v2-phase-title')).toHaveText('十二轮，炉火仍在');expect(await state(page)).toEqual(expected);
  await keyActivate(page,'#v2-phase-actions button:last-child');await expect(page.locator('#v2-dialog .sword-record')).toHaveCount(36);const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));await page.keyboard.press('Escape');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  await info.attach('d-keyboard-campaign',{body:Buffer.from(JSON.stringify({pointerEvents,visited,state:expected},null,2)),contentType:'application/json'});
});

test('D real failed contract has three receipts per round, no terminal merchant and an explicit restart',async({page},info)=>{
  await boot(page,'d-real-defeat');await page.locator('#v2-starters button:first-child').click();let expected=await state(page);
  for(let round=1;round<=3;round++){for(const action of[{type:'chooseRequest',requestId:null},{type:'settleRound',recycleRemaining:true}]as const){await runAction(page,action,false);const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action});if(!r.ok)throw Error(r.error);expected=r.state;expect(await state(page)).toEqual(expected);}await expect(page.locator('.piece-receipts .sword-record')).toHaveCount(3);if(round<3){await runAction(page,{type:'advanceSummary'},false);const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action:{type:'advanceSummary'}});if(!r.ok)throw Error(r.error);expected=r.state;}}
  expect(expected).toMatchObject({phase:'defeat',round:3,seals:0});await expect(page.locator('.merchant-card')).toHaveCount(0);await shot(page,info,'d-real-defeat');await info.attach('d-failed-contract',{body:Buffer.from(JSON.stringify(expected,null,2)),contentType:'application/json'});
  await page.getByRole('button',{name:'重新开炉',exact:true}).click();await page.locator('#v2-new').click();await page.locator('#v2-dialog-actions button:last-child').click();expect(await state(page)).toMatchObject({round:1,seals:3,coins:0,starterChosen:false});
});

test('D private practice really forges, quenches and delivers without touching an existing formal contract',async({page},info)=>{
  await boot(page,'keep-my-real-contract');await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();await page.locator('#v2-menu-button').click();const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  await page.locator('#v2-tutorial').click();for(const node of[0,1,2,7,8,9]){const label=SECTION_NAMES[node%5];await page.getByRole('button',{name:`练习${label}${node<5?'刃':'脊'}落点`,exact:true}).click();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');}
  await expect(page.locator('#v2-lesson-hint')).toContainText('两种锻纹完成');await shot(page,info,'d-private-practice');await page.locator('#v2-lesson-oil').click();await expect(page.locator('#v2-lesson')).toContainText('试剑：');await page.locator('#v2-lesson-deliver').click();await expect(page.locator('#v2-lesson-hint')).toContainText('练习完成');
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);await page.keyboard.press('Escape');await expect(page.locator('#v2-dialog')).not.toBeVisible();await page.keyboard.up('Space');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);await page.locator('#v2-continue').click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
});

test('D actual target and hammer motion cancel cleanly and reduced motion leaves only accepted results',async({page},info)=>{
  await boot(page,'d-motion');await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));await page.locator('#v2-strike').focus();const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));await page.keyboard.down('Space');await page.clock.runFor(250);await expect(page.locator('#v2-hammer-anchor')).toHaveClass(/preparing/);await shot(page,info,'d-hammer-preparing');await page.keyboard.press('ArrowRight');await expect(page.locator('#v2-hammer-anchor')).not.toHaveClass(/preparing/);await page.keyboard.up('Space');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');expect((await state(page)).pieces[0]?.strikes).toBe(1);await expect.poll(()=>page.locator('#v2-hammer').evaluate(i=>i.getAnimations().length)).toBeGreaterThan(0);await page.keyboard.press('ArrowRight');expect(await page.locator('#v2-hammer').evaluate(i=>i.getAnimations().length)).toBe(0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');expect((await state(page)).pieces[0]?.strikes).toBe(2);expect(await page.locator('#v2-hammer').evaluate(i=>i.getAnimations().length)).toBe(0);await shot(page,info,'d-reduced-motion');
  await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-settings-state')).toHaveText('正在使用默认设置');await page.locator('#v2-muted').check();await expect(page.locator('#v2-settings-state')).toHaveText('设置已保存');await expect(page.locator('#v2-audio-state')).toHaveText('已静音');
});

test('D unavailable artwork and unavailable audio have real visible exits while forging remains usable',async({page,runtimeAudit})=>{
  runtimeAudit.allowHttpStatus(503);await page.route('**/assets/d/metal-atlas-v1.webp',route=>route.fulfill({status:503,body:'art unavailable'}));await page.addInitScript(()=>{Object.defineProperty(window,'AudioContext',{configurable:true,value:class{constructor(){throw new Error('audio absent');}}});});
  await boot(page,'d-asset-failure');await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();await expect(page.locator('#v2-art-state')).toContainText('部分画稿未能加载');await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-audio-state')).toContainText('没有可用音频');await page.locator('#v2-settings summary').click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');expect((await state(page)).pieces[0]?.strikes).toBe(1);
});

test('D earned merchant resources pay for real seal repair and atomic full-slot replacement with cancel preserved',async({page},info)=>{
  test.setTimeout(180000);const witness=validateRun(JSON.parse(await readFile('docs/evidence/T11-2/simulation/victory.json','utf8')));if(!witness.ok)throw Error(witness.detail);
  await boot(page,witness.state.seed);let expected=await state(page);
  async function send(action:Action){await runAction(page,action,false);const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action});if(!r.ok)throw Error(r.error);expected=r.state;expect(await state(page)).toEqual(expected);}
  await send({type:'chooseTechnique',techniqueId:'edgeTooth'});await send({type:'chooseRequest',requestId:null});await send({type:'settleRound',recycleRemaining:true});await send({type:'advanceSummary'});
  const original=witness.state;
  // Partition the already verified journal by accepted round transitions, never inject its snapshots.
  let round=1,phase='workshop';for(const action of original.journal){const beforeRound=round,beforePhase=phase;if(action.type==='settleRound')phase='roundSummary';if(action.type==='advanceSummary'){phase=[3,6,9].includes(round)?'merchant':'workshop';if(phase==='workshop')round++;}if(action.type==='leaveMerchant'){round++;phase='workshop';}if(beforeRound>=2&&beforeRound<=3&&beforePhase!=='merchant')await send(action);if(expected.phase==='merchant')break;}
  expect(expected).toMatchObject({round:3,phase:'merchant',coins:682,scrap:28,seals:2});await send({type:'buy',productId:'repair'});expect(expected.seals).toBe(3);
  for(const id of['bridgeClip','reheatSand']as const)await send({type:'buy',productId:id});expect(expected.techniques).toHaveLength(3);
  const before=expected,raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));await page.locator('.merchant-card').filter({has:page.getByRole('heading',{name:'断纹匣',exact:true})}).getByRole('button',{name:'购买',exact:true}).click();await expect(page.locator('#v2-dialog-title')).toContainText('换下');await shot(page,info,'d-replacement-choice');await page.getByRole('button',{name:'保留原样',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  await send({type:'buy',productId:'shardBox',replaceId:'edgeTooth'});expect(expected.coins).toBe(before.coins-160);expect(expected.scrap).toBe(before.scrap-5);expect(expected.techniques).toEqual(['bridgeClip','reheatSand','shardBox']);await shot(page,info,'d-merchant-after-repair-and-replace');await page.reload();await page.locator('#v2-continue').click();expect(await state(page)).toEqual(expected);
  await info.attach('d-earned-repair-replacement',{body:Buffer.from(JSON.stringify({before,state:expected},null,2)),contentType:'application/json'});
});

test('D exported art really decodes with source alpha and both desktop canvases show the live forging scene',async({page},info)=>{
  const manifest: {assets: {name:string;src:string;width:number;height:number;sha256:string;alphaSha256:string}[];totalBytes:number}=JSON.parse(await readFile('public/assets/d/manifest.json','utf8'));expect(manifest.totalBytes).toBeLessThan(3*1024*1024);expect(manifest.assets).toHaveLength(8);
  await boot(page,'d-actual-art');await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-requests button:first-child').click();
  const decoded=await page.evaluate(async assets=>{const digest=async(bytes:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(v=>v.toString(16).padStart(2,'0')).join('');const results=[];for(const asset of assets){const response=await fetch(asset.src);if(!response.ok)throw Error(asset.name);const bytes=new Uint8Array(await response.arrayBuffer()),bitmap=await createImageBitmap(new Blob([bytes]));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');if(!c)throw Error('2d');c.drawImage(bitmap,0,0);const rgba=c.getImageData(0,0,canvas.width,canvas.height).data,alpha=new Uint8Array(canvas.width*canvas.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3]??0;results.push({name:asset.name,width:canvas.width,height:canvas.height,sha256:await digest(bytes),alphaSha256:await digest(alpha)});bitmap.close();}return results;},manifest.assets);
  expect(decoded).toEqual(manifest.assets.map(({name,width,height,sha256,alphaSha256})=>({name,width,height,sha256,alphaSha256})));
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);for(const selector of['#v2-node-0','#v2-node-9','#v2-deliver','#v2-outcomes','#v2-price-preview','#v2-piece-stats'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});for(const mode of['light','standard','heavy']){await page.locator(`#v2-mode-${mode}`).click();await expect(page.locator('#v2-hammer')).toHaveAttribute('src',`/assets/d/hammer-${mode}-v1.webp`);}const targets=await page.locator('#v2-nodes button').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height};}));for(const a of targets){expect(a.w).toBeGreaterThanOrEqual(44);expect(a.h).toBeGreaterThanOrEqual(44);}for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j];if(!a||!b)throw Error('target');expect(Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y))).toBe(0);}await shot(page,info,`d-fresh-forge-${size.width}`);}
  await info.attach('d-decoded-art',{body:Buffer.from(JSON.stringify({bytes:manifest.totalBytes,decoded},null,2)),contentType:'application/json'});
});
