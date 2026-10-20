import {test,expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {applyCommand,getRunView,validateRun} from '../../src/core-v4/index.js';
import type {RunState} from '../../src/core-v4/index.js';
import {installAudioProbe,audioProbe} from './audio-probe';
import {installV4HammerProbe,installV4SlowFrames} from './v4-forge-probe';

const dir='tmp/T11-4-2-3i3/forge-pilot';
async function record(info:TestInfo,name:string,value:unknown){await mkdir(dir,{recursive:true});await writeFile(`${dir}/${info.project.name}-${name}.json`,JSON.stringify(value,null,2)+'\n');}
async function read(page:Page):Promise<RunState>{const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));if(!raw)throw Error('No real v4 save');const parsed=validateRun(JSON.parse(raw).state);if(!parsed.ok)throw Error(parsed.detail);return parsed.state;}
async function start(page:Page){await page.goto('/');await expect(page.locator('#v4-start')).toBeEnabled();await page.locator('#v4-title details summary').click();await page.locator('#v4-seed').fill('lantern-witness-0');await page.locator('#v4-start').click();await page.getByRole('button',{name:'点火开炉',exact:true}).click();await expect(page.locator('#v4-hit')).toBeEnabled();await page.locator('#v4-hammer img').evaluate(async(image:HTMLImageElement)=>{await image.decode();});await expect(page.locator('#v4-blade')).toHaveAttribute('data-illustrated','true');}
async function point(page:Page){const box=await page.locator('#v4-hit').boundingBox();if(!box)throw Error('Missing actual forge surface');return{x:box.x+box.width*.59,y:box.y+box.height*.55};}
async function left(page:Page){await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');const before=await read(page),id=await page.locator('#v4-inventory button[aria-pressed=true]').getAttribute('data-piece');if(!id)throw Error('No selected actual piece');const p=await point(page);await page.mouse.click(p.x,p.y);const after=await read(page),oracle=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'strike',pieceId:id}});if(!oracle.ok)throw Error(oracle.error);expect(after).toEqual(oracle.state);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');return{before,after};}
async function closeDelivery(page:Page){const back=page.getByRole('button',{name:'回到铁砧',exact:true});if(await back.isVisible())await back.click();await expect(page.locator('#v4-workshop')).toBeVisible();}
async function settleAndAdvance(page:Page){await page.locator('#v4-settle').click();await page.getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'沿灯路，去下一天',exact:true}).click();await expect(page.locator('#v4-workshop')).toBeVisible();}
async function geometry(page:Page,info:TestInfo,name:string){await expect.poll(()=>page.evaluate(()=>window.v4HammerGeometry.complete),{timeout:8000}).toBe(true);const probe=await page.evaluate(()=>window.v4HammerGeometry),contacts=probe.frames.filter(f=>f.phase==='contact'&&f.gap<6&&f.metalGap<6&&Math.abs(f.angle)<10);await record(info,name,{probe,state:await read(page)});expect(probe.source).toContain('/assets/d/hammer-forge-v2.webp');expect(Math.min(...probe.sourceAlpha)).toBeGreaterThan(200);expect(contacts.length).toBeGreaterThanOrEqual(2);for(const contact of contacts){expect(contact.pivotGap).toBeLessThan(4);expect(contact.gap).toBeLessThan(6);expect(contact.metalGap).toBeLessThan(6);expect(Math.abs(contact.angle)).toBeLessThan(10);}return probe;}

test('v4 left-click lands the real flat hammer face on opaque steel at both desktop sizes',async({page},info)=>{
  await start(page);for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width:width!,height:height!});await installV4HammerProbe(page);const result=await left(page);expect(result.after.revision).toBe(result.before.revision+1);await geometry(page,info,`normal-${width}`);await page.screenshot({path:`${dir}/${info.project.name}-normal-${width}.png`});}
});

test('v4 250 ms presentation frames retain two contacts; busy Space and cancelled recoil never add a command',async({page},info)=>{
  await installV4SlowFrames(page);await start(page);await installV4HammerProbe(page);
  const before=await read(page),p=await point(page);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.up();const accepted=await read(page);expect(accepted.revision).toBe(before.revision+1);await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','true');
  await page.keyboard.down('Space');const probe=await geometry(page,info,'slow-250ms');await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.keyboard.up('Space');expect(await read(page)).toEqual(accepted);expect(probe.inputToFirstSampleMs).toBeGreaterThanOrEqual(240);
  await page.mouse.click(p.x,p.y);const cancelled=await read(page);expect(cancelled.revision).toBe(accepted.revision+1);await page.keyboard.press('Escape');await expect(page.locator('#v4-dialog')).toHaveAttribute('open','');await page.waitForTimeout(1300);expect(await read(page)).toEqual(cancelled);await expect(page.locator('#v4-hammer')).toHaveAttribute('data-phase','idle');expect(await page.locator('#v4-scene').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);
  await page.getByRole('button',{name:'继续锻造',exact:true}).click();await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.waitForTimeout(350);expect(await read(page)).toEqual(cancelled);await record(info,'cancelled',{before,accepted,cancelled});
});

test('v4 normal sound is real, while saved mute and reduced motion keep an accepted strike quiet and still',async({page},info)=>{
  await installAudioProbe(page);await start(page);const starts=(await audioProbe(page)).starts;await left(page);await expect.poll(async()=>(await audioProbe(page)).starts).toBeGreaterThan(starts);const normal=await audioProbe(page);expect(normal.maxActive).toBeLessThanOrEqual(12);
  await page.locator('#v4-settings').click();await page.getByLabel('静音',{exact:true}).check();await page.getByLabel('减弱动效',{exact:true}).check();await page.getByRole('button',{name:'收好',exact:true}).click();
  const mutedStarts=(await audioProbe(page)).starts,result=await left(page);expect(result.after.revision).toBe(result.before.revision+1);const quiet=await audioProbe(page);expect(quiet.starts).toBe(mutedStarts);expect(quiet.active).toBe(0);expect(await page.locator('#v4-scene').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0);await expect(page.locator('#v4-impact-badge')).toHaveText(/锻成|大成|裂纹/);await record(info,'audio-reduced',{normal,quiet,before:result.before,after:result.after});
});

test('v4 first-chapter recipe silhouettes follow genuine light and day-four guard; heavy remains locked',async({page},info)=>{
  test.setTimeout(120000);await start(page);const states:RunState[]=[];
  await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','0');
  for(const day of [1,2]){
    let met=false;
    for(let pieces=0;pieces<3&&!met;pieces++){
      const s=await read(page),candidate=s.blades.find(b=>b.suppliedDay===day&&b.status==='active'&&b.id!==s.reserveId);if(!candidate)break;
      await page.locator(`#v4-inventory [data-piece="${candidate.id}"]`).click();
      for(let hits=0;hits<5;hits++){
        const actual=await read(page),b=actual.blades.find(b=>b.id===candidate.id)!,v=getRunView(actual),assessed=v.blades.find(p=>p.blade.id===b.id);
        if(assessed?.assessment.qualifies)break;if(!assessed?.canStrike||b.cracked||day===2&&b.hits>=4)break;await left(page);
      }
      await page.locator('#v4-deliver').click();await closeDelivery(page);met=getRunView(await read(page)).commission.progress.complete;
    }
    expect(met).toBe(true);states.push(await read(page));await settleAndAdvance(page);
  }
  expect((await read(page)).day).toBe(3);await settleAndAdvance(page);const day4=await read(page);expect(day4.day).toBe(4);expect(day4.blades.find(b=>b.id==='d4-1')!.recipe).toBe('guard');await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','1');await expect(page.locator('#v4-recipes [data-recipe="heavy"]')).toHaveCount(0);await expect(page.locator('#v4-recipes [data-recipe="light"]')).toBeEnabled();
  const guardPixels=await page.locator('#v4-blade').evaluate((c:HTMLCanvasElement)=>c.toDataURL());await page.locator('#v4-recipes [data-recipe="light"]').click();const changed=await read(page);expect(changed.blades.find(b=>b.id==='d4-1')!.recipe).toBe('light');await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','0');expect(await page.locator('#v4-blade').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).not.toBe(guardPixels);
  await page.locator('#v4-recipes [data-recipe="guard"]').click();await left(page);await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','1');states.push(day4,await read(page));await record(info,'reachable-recipes',{states,heavy:'Unavailable before day seven or earned chapter-two eligibility; no unlock injection used.'});await page.screenshot({path:`${dir}/${info.project.name}-guard.png`});
});
