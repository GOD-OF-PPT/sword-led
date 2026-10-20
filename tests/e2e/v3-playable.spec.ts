import {test,expect} from '@playwright/test';
import type {Page,Locator} from '@playwright/test';
import {applyCommand,validateRun,quotaFor} from '../../src/core-v3/index.js';
import type {Action,RunState} from '../../src/core-v3/index.js';
import {writeFile,mkdir} from 'node:fs/promises';
const reports='tmp/v3-ui-states';
test.beforeEach(async({page})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});(page as Page&{v3Errors:string[]}).v3Errors=errors;});
test.afterEach(async({page})=>{expect((page as Page&{v3Errors:string[]}).v3Errors).toEqual([]);});
async function read(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v3'));if(!raw)throw Error('Missing v3 actual save');const r=validateRun(JSON.parse(raw).state);if(!r.ok)throw Error(r.detail);return r.state;}
async function expectCommand(before:RunState,page:Page,action:Action){const expected=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!expected.ok)throw Error(expected.error);const actual=await read(page);expect(actual).toEqual(expected.state);return actual;}
async function strike(page:Page,keyboard=false){const before=await read(page),pieceId=await page.locator('#v3-inventory button[aria-pressed=true]').getAttribute('data-piece');if(!pieceId)throw Error('no blade');
 if(keyboard){await page.locator('#v3-strike').focus();await page.keyboard.press('Space');}else await page.locator('#v3-strike').click();
 const s=await expectCommand(before,page,{type:'strike',pieceId});await expect(page.locator('#v3-value')).toHaveText(s.blades.find(b=>b.id===pieceId)!.value.toLocaleString('zh-CN'));await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');return s;}
async function confirm(page:Page){await expect(page.locator('#v3-dialog')).toBeVisible();await page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}).click();}
async function settle(page:Page){const before=await read(page);await page.locator('#v3-settle').click();await confirm(page);return expectCommand(before,page,{type:'settle'});}
async function advance(page:Page){const before=await read(page);await page.getByRole('button',{name:'领取下一轮三柄剑'}).click();return expectCommand(before,page,{type:'advance'});}
async function open(page:Page){await page.goto('/v3.html?mode=3');await expect(page.locator('#v3-strike')).toBeEnabled();await expect(page.locator('#v3-workshop')).toBeVisible();}
async function saveState(page:Page,label:string){const s=await read(page);await mkdir(reports,{recursive:true});await writeFile(`${reports}/${test.info().project.name}-${label}.json`,JSON.stringify(s,null,2)+'\n');}
test('primary hammer remains readable while hovered',async({page})=>{
 await open(page);await page.locator('#v3-strike').hover();
 const contrast=await page.locator('#v3-strike').evaluate(b=>{const s=getComputedStyle(b),luminance=(value:string)=>{const channels=(value.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*channels[0]!+.7152*channels[1]!+.0722*channels[2]!;};const a=luminance(s.color),c=luminance(s.backgroundColor);return(Math.max(a,c)+.05)/(Math.min(a,c)+.05);});
 expect(contrast).toBeGreaterThanOrEqual(4.5);
});
test('first click is live; keyboard has no timing requirement; reduced motion, pause and reload keep results',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await expect(page.locator('#v3-value')).toHaveText('40');let s=await strike(page);expect(s.rng.forge.draws).toBe(1);
 await page.locator('#v3-settings summary').click();await page.locator('#v3-motion').check();await page.locator('#v3-muted').check();await page.locator('#v3-settings summary').click();s=await strike(page,true);expect(s.blades[0]?.hits).toBe(2);
 await page.locator('#v3-strike').focus();await page.keyboard.down('Enter');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');const oneEnter=await read(page);await page.keyboard.down('Enter');await page.keyboard.up('Enter');expect(await read(page)).toEqual(oneEnter);
 const before=await read(page);await page.locator('#v3-strike').focus();await page.keyboard.down('Space');await page.keyboard.press('Escape');await page.keyboard.up('Space');expect(await read(page)).toEqual(before);await page.getByRole('button',{name:'继续锻造',exact:true}).click();
 await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(before);expect(errors).toEqual([]);await saveState(page,'reload');
});
test('actual three rounds, optional gift, insurance, merchant trade and upgrade; honest ending at two desktop sizes',async({page})=>{
 await open(page);let s=await read(page);
 // Forge an insurance blade, explicitly store it, then fill today's quota with the other supply.
 for(let i=0;i<3;i++)s=await strike(page,i%2===1);const stored=s.blades[0]!;let before=s;await page.locator('#v3-store').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});expect(s.reserveId).toBe(stored.id);
 for(let round=1;round<=3;round++){
  s=await read(page);
  if(round===2){const exact=s.blades.find(b=>b.id===stored.id);expect(exact).toEqual(stored);before=s;await page.locator('#v3-reserve-slot button').click();s=await expectCommand(before,page,{type:'reserve',pieceId:stored.id});}
  if(round===3){const id=s.shop[0]!;await page.locator('#v3-shop').click();await page.getByRole('button',{name:/用当前剑交换/}).first().click();await expect(page.locator('#v3-dialog-body')).toContainText('将交出');before=await read(page);const selected=(await page.locator('#v3-inventory button[aria-pressed=true]').getAttribute('data-piece'))!;await confirm(page);s=await expectCommand(before,page,{type:'buy',pieceId:selected,traitId:id});expect(s.traits).toContain(id);
   await page.locator('#v3-shop').click();const upgrade=page.getByRole('button',{name:/升级炉具/});if(await upgrade.isEnabled()){await upgrade.click();before=await read(page);await confirm(page);s=await expectCommand(before,page,{type:'upgrade'});expect(s.base).toBe(80);expect(s.blades.filter(b=>b.suppliedRound===3).every(b=>b.base===40)).toBe(true);}else await page.getByRole('button',{name:'回铁砧'}).click();
  }
  for(let guard=0;guard<80;guard++){
   s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(b=>b.status==='active'&&b.id!==s.reserveId);if(!b)break;
   await page.locator(`[data-piece="${b.id}"]`).click();if(b.value<quotaFor(round)-s.delivered&&!b.cracked){s=await strike(page);continue;}
   before=s;await page.locator('#v3-deliver').click();s=await expectCommand(before,page,{type:'deliver',pieceId:b.id});
  }
  if(round===1){await page.getByRole('button',{name:'首次达标 · 领一门免费手艺'}).click();before=await read(page);await page.getByRole('button',{name:/稳手护符 ·/}).click();s=await expectCommand(before,page,{type:'claimGift',traitId:'steady'});}
  for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});for(const id of ['v3-value','v3-risk','v3-strike','v3-deliver','v3-settle']){const box=await page.locator('#'+id).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height!);}
   if(round===3){await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-forge-${width}.png`});}}
  await saveState(page,`round-${round}`);s=await settle(page);if(round<3)await advance(page);
 }
 expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(s.blades.filter(b=>b.suppliedRound===4)).toHaveLength(0);await expect(page.locator('#v3-screen-title')).toHaveText('前三轮体验结束');await expect(page.getByRole('button',{name:'领取下一轮三柄剑'})).toHaveCount(0);await saveState(page,'experience-end');
});
test('three misses really fail; restart respects a changed seed; invalid main recovers actual backup',async({page})=>{
 await open(page);for(let i=0;i<3;i++){await settle(page);if(i<2)await advance(page);}expect((await read(page)).phase).toBe('defeat');await expect(page.locator('#v3-screen-title')).toHaveText('契约终止');await page.getByRole('button',{name:'再开一炉'}).click();await page.locator('#v3-seed').fill('restart-new-seed');await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-strike')).toBeEnabled();expect((await read(page)).seed).toBe('restart-new-seed');
 await strike(page);const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('sword-led.save.backup.v3')!).state);await page.evaluate(()=>localStorage.setItem('sword-led.save.v3','{broken'));await page.reload();await page.locator('#v3-recover').click();await expect(page.locator('#v3-dialog-body')).toContainText('保存于');await confirm(page);expect(await read(page)).toEqual(backup);await saveState(page,'recovered');
});
test('same-origin v2 writer blocks v3 safely; write refusal carries exact state into unsaved play',async({page,context})=>{
 const old=await context.newPage();await old.goto('/v2.html');await expect(old.locator('#v2-new')).toBeEnabled();await old.locator('#v2-new').click();await old.locator('#v2-starters button').first().click();const oldBytes=await old.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
 await page.goto('/v3.html?mode=3');await expect(page.locator('#v3-save-text')).toContainText('只读');await old.close();await page.locator('#v3-reread').click();await confirm(page); // no v3 main exists yet; use the explicit new-game menu
 await page.getByRole('button',{name:'开一炉新契约'}).click();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(oldBytes);
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sword-led.save.v3')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});
 const before=await read(page);await page.locator('#v3-strike').click();await expect(page.locator('#v3-save-text')).toContainText('保存失败');expect(await read(page)).toEqual(before);await page.locator('#v3-memory').click();await confirm(page);await expect(page.locator('#v3-save-text')).toContainText('不保存');await expect(page.locator('#v3-value')).not.toHaveText('40');
});
test('real seeded burst survives interruption; crack then break and next-piece action are distinct',async({page})=>{
 await open(page);await page.locator('#v3-menu').click();await page.locator('#v3-seed').fill('path-0');await page.getByRole('button',{name:'开一炉新契约'}).click();await confirm(page);
 expect((await read(page)).seed).toBe('path-0');
 for(let i=0;i<6;i++)await strike(page);await expect(page.locator('#v3-risk')).toContainText('本次无裂损');const before=await read(page);await page.locator('#v3-strike').click();const burst=await expectCommand(before,page,{type:'strike',pieceId:'r1-1'});expect(burst.rng.forge.draws-before.rng.forge.draws).toBe(2);await page.reload();await expect(page.locator('#v3-workshop')).toBeVisible();expect(await read(page)).toEqual(burst);
 for(let i=0;i<5;i++)await strike(page);let s=await read(page);expect(s.blades[0]?.cracked).toBe(true);await expect(page.locator('#v3-risk')).toContainText('再裂会断');await saveState(page,'cracked');await mkdir(reports,{recursive:true});await page.screenshot({path:`${reports}/${test.info().project.name}-cracked.png`});
 s=await strike(page);expect(s.blades[0]?.status).toBe('broken');await expect(page.locator('#v3-risk')).toContainText('已断');const rev=s.revision;await page.locator('#v3-strike').click();expect((await read(page)).revision).toBe(rev);await expect(page.locator('[data-piece="r1-2"]')).toHaveAttribute('aria-pressed','true');await saveState(page,'broken');
});
test('menu seed survives resize and asynchronous asset arrivals before confirmed replacement',async({page})=>{
 await page.route('**/assets/d/*.webp',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();});await open(page);await page.locator('#v3-menu').click();await page.locator('#v3-seed').fill('kept-draft');await page.setViewportSize({width:1280,height:720});await expect(page.locator('#v3-seed')).toHaveValue('kept-draft');await page.getByRole('button',{name:'开一炉新契约'}).click();await confirm(page);expect((await read(page)).seed).toBe('kept-draft');
});
async function tabTo(page:Page,target:Locator){for(let i=0;i<100;i++){if(await target.evaluate(e=>e===document.activeElement))return;const backwards=await target.evaluate(e=>Boolean(document.activeElement&&(document.activeElement.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)));await page.keyboard.press(backwards?'Shift+Tab':'Tab');}throw Error('Control not keyboard reachable');}
async function activateKey(page:Page,target:Locator){await tabTo(page,target);await page.keyboard.press('Enter');}
test('keyboard completes all three rounds with zero pointer events and no timing recipe',async({page})=>{
 await page.addInitScript(()=>window.addEventListener('pointerdown',()=>{document.documentElement.dataset.v3Pointers=String(Number(document.documentElement.dataset.v3Pointers??0)+1);}));await open(page);let s=await read(page);
 for(let round=1;round<=3;round++){
  for(let guard=0;guard<75;guard++){
   s=await read(page);if(s.delivered>=quotaFor(round))break;const b=s.blades.find(p=>p.status==='active'&&p.id!==s.reserveId);if(!b)break;
   await activateKey(page,page.locator(`[data-piece="${b.id}"]`));
   if(b.value<quotaFor(round)-s.delivered&&!b.cracked){await tabTo(page,page.locator('#v3-strike'));await page.keyboard.press('Space');await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');}
   else await activateKey(page,page.locator('#v3-deliver'));
  }
  await activateKey(page,page.locator('#v3-settle'));await activateKey(page,page.locator('#v3-dialog-actions').getByRole('button',{name:'确认',exact:true}));if(round<3)await activateKey(page,page.getByRole('button',{name:'领取下一轮三柄剑'}));
 }
 s=await read(page);expect(s.phase).toBe('experienceComplete');expect(s.round).toBe(3);expect(Number(await page.locator('html').getAttribute('data-v3-pointers'))).toBe(0);await saveState(page,'keyboard-end');
});
