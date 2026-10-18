import { test, expect } from './fixtures';
import { openGame, startGame, preciseKeyStrike } from './helpers';
import { keyActivate } from './keyboard';
import { applyCommand, validateRun } from '../../src/core-v2/index.js';
import { readFile } from 'node:fs/promises';
import type { RunState } from '../../src/core-v2/index.js';
import { TECHNIQUES } from '../../src/core-v2/rules.js';
import type { Page } from '@playwright/test';

async function readV2(page:Page):Promise<RunState>{
  const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));if(!raw)throw Error('missing v2 save');
  const envelope:unknown=JSON.parse(raw);if(!envelope||typeof envelope!=='object'||!('state'in envelope))throw Error('envelope');
  const result=validateRun(envelope.state);if(!result.ok)throw Error(result.detail);return result.state;
}
async function begin(page:Page,seed='ui-v2'){
  await page.clock.install({time:new Date('2026-10-19T06:00:00Z')});await page.goto('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.clock.pauseAt(new Date('2026-10-19T06:01:00Z'));
  await page.locator('#v2-seed').fill(seed);await page.locator('#v2-new').click();await page.locator('#v2-starters').getByRole('button',{name:/桥脊扣/}).click();
  await page.locator('#v2-requests').getByRole('button',{name:/巡卫/}).click();await expect(page.locator('#v2-strike')).toBeEnabled();
}
async function confirm(page:Page){await expect(page.locator('#v2-dialog')).toBeVisible();await page.locator('#v2-dialog').getByRole('button',{name:'确认',exact:true}).click();}
async function forge(page:Page,nodes:readonly number[]=[0,1,2,7,8,9]){
  for(const node of nodes){await page.locator(`#v2-node-${node}`).click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');}
}
async function quenchAndDeliver(page:Page){await page.locator('#v2-oil').click();await confirm(page);await page.locator('#v2-deliver').click();await confirm(page);}
async function settle(page:Page){await page.locator('#v2-settle').click();await confirm(page);}

test('v2 real blade decisions produce the approved sword, trial and reload without touching legacy data',async({page},info)=>{
  await begin(page);await forge(page);await expect(page.locator('#v2-price-preview')).toContainText('水淬后可交214 / 油淬后可交200');await page.locator('#v2-oil').click();await confirm(page);
  const forged=await readV2(page);expect(forged.pieces[0]).toMatchObject({ratings:{edge:7,toughness:12,balance:6},integrity:4,stress:24});
  const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));await page.locator('#v2-trial').click();
  await expect(page.locator('#v2-dialog')).toContainText('切麻绳 · 2/8档');await expect(page.locator('#v2-dialog')).toContainText('挡木桩 · 4/8档');
  await expect(page.locator('.rope.cleaved')).toHaveCount(2);await expect(page.locator('.trial-block-ticks .held')).toHaveCount(4);await expect(page.locator('.bell.reached')).toHaveCount(2);await page.getByRole('button',{name:'收剑',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);for(const selector of['#v2-node-0','#v2-node-9','#v2-deliver','#v2-water','#v2-strike','#v2-outcomes','#v2-piece-stats','#v2-price-preview','#v2-current-request'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const path=info.outputPath(`v2-forged-${size.width}.png`);await page.screenshot({path});await info.attach(`v2-forged-${size.width}`,{path,contentType:'image/png'});}
  await page.reload();await expect(page.locator('#v2-continue')).toBeEnabled();await page.locator('#v2-continue').click();expect(await readV2(page)).toEqual(forged);
  await page.locator('#v2-deliver').click();await confirm(page);expect((await readV2(page)).coins).toBe(200);
  await info.attach('v2-first-sword',{body:Buffer.from(JSON.stringify({forged,delivered:await readV2(page)},null,2)),contentType:'application/json'});
});

test('three v2 rounds reach a real merchant, preserve the customer return and buy a different technique',async({page},info)=>{
  test.setTimeout(120000);
  await begin(page,'three-round-ui');await forge(page);await quenchAndDeliver(page);await settle(page);
  await page.locator('#v2-phase-actions').getByRole('button',{name:/下一轮/}).click();await page.locator('#v2-decline').click();
  await forge(page);await quenchAndDeliver(page);await page.locator('#v2-piece-1').click();await page.locator('#v2-deliver').click();await confirm(page);await settle(page);
  await page.locator('#v2-phase-actions').getByRole('button',{name:/下一轮/}).click();await page.locator('#v2-decline').click();
  expect((await readV2(page)).returns[0]?.received).toBe(true);
  await forge(page);await quenchAndDeliver(page);await page.locator('#v2-piece-1').click();await forge(page,[0,1,2]);await quenchAndDeliver(page);await settle(page);
  await expect(page.locator('#v2-phase-content')).toContainText('前三轮已经走完');await page.locator('#v2-phase-actions').getByRole('button',{name:/商人的工具/}).click();
  const before=await readV2(page);expect(before).toMatchObject({round:3,phase:'merchant',seals:3});expect(before.history.map(h=>h.met)).toEqual([true,true,true]);
  const id=before.merchant[0];if(!id)throw Error('merchant offers');const price=TECHNIQUES[id];
  await page.locator('.merchant-card').filter({has:page.getByRole('heading',{name:price.label,exact:true})}).getByRole('button',{name:'购买',exact:true}).click();await confirm(page);
  const bought=await readV2(page);expect(bought.techniques).toContain(id);expect(bought.coins).toBe(before.coins-price.coins);expect(bought.scrap).toBe(before.scrap-price.scrap);
  await page.reload();await page.locator('#v2-continue').click();expect(await readV2(page)).toEqual(bought);await expect(page.locator('#v2-phase-content')).toContainText('已持有 / 本次已购');
  const path=info.outputPath('v2-first-merchant.png');await page.screenshot({path});await info.attach('v2-first-merchant',{path,contentType:'image/png'});
  await info.attach('v2-three-round-contract',{body:Buffer.from(JSON.stringify({before,bought},null,2)),contentType:'application/json'});
});

test('v1 and v2 genuine saves stay separate and contend for the same writer lease',async({page,context})=>{
  await openGame(page);await startGame(page,'legacy-before-v2');await preciseKeyStrike(page);const legacy=await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'));
  await page.goto('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.locator('#v2-new').click();await page.locator('#v2-starters').getByRole('button',{name:/巡锋齿/}).click();await page.locator('#v2-decline').click();
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBe(legacy);const v2=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  const other=await context.newPage();await other.goto('/');await expect(other.locator('#new-game')).toBeDisabled();await page.close();
  await other.locator('#reconnect').click();await expect(other.locator('#new-game')).toBeEnabled();expect(await other.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBe(legacy);expect(await other.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(v2);await other.close();
});

test('a held v2 strike is cancelled by a real target change and risky outcomes stay visible at 720px',async({page},info)=>{
  await page.setViewportSize({width:1280,height:720});await begin(page,'critical-v2');
  const initial=await readV2(page);await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(250);await page.keyboard.press('ArrowRight');await page.keyboard.up('Space');expect(await readV2(page)).toEqual(initial);
  await page.locator('#v2-mode-heavy').click();
  for(const node of[0,1,2,3]){await page.locator(`#v2-node-${node}`).click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.keyboard.up('Space');}
  await page.locator('#v2-reheat').click();await confirm(page);
  for(const node of[4,9,8]){await page.locator(`#v2-node-${node}`).click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.keyboard.up('Space');}
  await page.locator('#v2-node-7').click();const critical=await readV2(page);expect(critical.pieces[0]).toMatchObject({integrity:1,stress:26,heat:28});
  await expect(page.locator('#v2-outcomes')).toContainText('将破碎');for(const selector of['#v2-node-0','#v2-node-9','#v2-deliver','#v2-strike','#v2-outcomes','#v2-price-preview'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
  const path=info.outputPath('v2-critical-720.png');await page.screenshot({path});await info.attach('v2-critical-720',{path,contentType:'image/png'});
  await info.attach('v2-critical-state',{body:Buffer.from(JSON.stringify(critical,null,2)),contentType:'application/json'});
});

test('v2 slow timing is actually saved and changes release timing without changing its grade reward',async({page})=>{
  await begin(page,'slow-v2');const initial=await readV2(page);
  await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(250);
  await page.locator('#v2-settings summary').click();await page.locator('#v2-slow').check();await page.keyboard.up('Space');expect(await readV2(page)).toEqual(initial);
  await page.locator('#v2-settings summary').click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(525);await page.keyboard.up('Space');
  const after=await readV2(page);expect(after.journal.at(-1)).toMatchObject({type:'strike',timingMark:5000});expect(after.pieces[0]).toMatchObject({ratings:{edge:3,toughness:2,balance:0},heat:84,stress:4});
  await page.reload();await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-slow')).toBeChecked();expect(await readV2(page)).toEqual(after);
});

test('v2 failed writes can export the real accepted in-memory progress while leaving the disk contract intact',async({page},info)=>{
  await page.addInitScript(()=>{const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.save.v2'&&Reflect.get(window,'v2WriteFault'))throw new DOMException('Test quota','QuotaExceededError');native.call(this,key,value);};});
  await begin(page,'dirty-v2');const original=await readV2(page),raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  await page.evaluate(()=>Reflect.set(window,'v2WriteFault',true));await forge(page,[0]);await expect(page.locator('#v2-save-state')).toContainText('尚未成功保存');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  await page.locator('#v2-keep-memory').click();await page.locator('#v2-dialog').getByRole('button',{name:'保留进度，不保存',exact:true}).click();await expect(page.locator('#v2-save-state')).toContainText('不保存试玩');
  await page.locator('#v2-menu-button').click();const received=page.waitForEvent('download');await page.locator('#v2-export').click();const download=await received,path=info.outputPath('v2-unsaved-export.json');await download.saveAs(path);
  const envelope:unknown=JSON.parse(await readFile(path,'utf8'));if(!envelope||typeof envelope!=='object'||!('state'in envelope))throw Error('export envelope');const checked=validateRun(envelope.state);if(!checked.ok)throw Error(checked.detail);
  const expected=applyCommand(original,{runId:original.runId,expectedRevision:original.revision,action:{type:'strike',pieceId:'1:1',node:0,mode:'standard',timingMark:5000}});if(!expected.ok)throw Error(expected.error);expect(checked.state).toEqual(expected.state);expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(raw);
  await info.attach('v2-unsaved-export',{path,contentType:'application/json'});await page.reload();await expect(page.locator('#v2-continue')).toBeEnabled();expect(await readV2(page)).toEqual(original);
});

test('v2 has an explicit playable no-save route when the browser cannot provide writer locks',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'locks',{configurable:true,get:()=>undefined}));
  await page.goto('/v2.html');await expect(page.locator('#v2-save-state')).toContainText('无法单写保存');await expect(page.locator('#v2-new')).toBeDisabled();
  await page.locator('#v2-memory').click();await page.locator('#v2-starters').getByRole('button',{name:/回火砂/}).click();await page.locator('#v2-decline').click();await expect(page.locator('#v2-strike')).toBeEnabled();await expect(page.locator('#v2-save-state')).toContainText('不保存试玩');
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBeNull();
});

test('keyboard alone selects a v2 forging route, quenches, delivers and settles a real first round',async({page},info)=>{
  await page.addInitScript(()=>{Reflect.set(window,'v2PointerCount',0);window.addEventListener('pointerdown',()=>Reflect.set(window,'v2PointerCount',Number(Reflect.get(window,'v2PointerCount'))+1));});
  await page.clock.install({time:new Date('2026-10-19T06:00:00Z')});await page.goto('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.clock.pauseAt(new Date('2026-10-19T06:01:00Z'));
  await keyActivate(page,'#v2-new');await keyActivate(page,'#v2-starters button:first-child');await keyActivate(page,'#v2-requests button:first-child');
  for(const direction of[null,'ArrowRight','ArrowRight','ArrowUp','ArrowRight','ArrowRight']){if(direction)await page.keyboard.press(direction);await expect(page.locator('#v2-strike')).toBeFocused();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');}
  await keyActivate(page,'#v2-oil');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await keyActivate(page,'#v2-deliver');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await keyActivate(page,'#v2-settle');await page.keyboard.press('Tab');await page.keyboard.press('Enter');const state=await readV2(page);expect(state).toMatchObject({phase:'roundSummary',round:1,coins:228,seals:3});expect(state.history[0]).toMatchObject({met:true,delivered:228,nextCredit:39});
  expect(await page.evaluate(()=>Reflect.get(window,'v2PointerCount'))).toBe(0);await info.attach('v2-keyboard-only-round',{body:Buffer.from(JSON.stringify({pointerEvents:0,state},null,2)),contentType:'application/json'});
});
