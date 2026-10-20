import {expect} from '@playwright/test';
import type {Page,TestInfo} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installV4HammerProbe} from './v4-forge-probe.js';
import type {RunState} from '../../src/core-v4/index.js';

declare global {interface Window {v4HeavyRestoreFrames?:()=>void;v4HeavyHoldStartedAt?:number}}

export async function heavyEvidence(page:Page,info:TestInfo,label:string,state:RunState){
  await expect.poll(()=>page.evaluate(()=>window.v4HammerGeometry.complete),{timeout:8000}).toBe(true);
  const probe=await page.evaluate(()=>window.v4HammerGeometry),contacts=probe.frames.filter(f=>f.phase==='contact'&&f.gap<6&&f.metalGap<6&&Math.abs(f.angle)<10);
  const ratio=await page.locator('#v4-blade').evaluate(e=>{const r=e.getBoundingClientRect();return r.width/r.height;});
  expect(ratio).toBeCloseTo(11/4,2);expect(contacts.length).toBeGreaterThanOrEqual(2);expect(Math.min(...probe.sourceAlpha)).toBeGreaterThan(200);
  for(const sample of contacts){expect(sample.gap).toBeLessThan(6);expect(sample.metalGap).toBeLessThan(6);expect(Math.abs(sample.angle)).toBeLessThan(10);expect(sample.pivotGap).toBeLessThan(4);}
  await expect(page.locator('#v4-blade')).toHaveAttribute('data-family','2');await expect(page.locator('#v4-blade')).toHaveAttribute('data-illustrated','true');
  const dir=`${process.env.V4_HEAVY_EVIDENCE_ROOT??'tmp/T11-4-2-3i4/forge-heavy'}/${info.project.name}/${info.testId.replace(/[^\w-]/g,'_')}`;await mkdir(dir,{recursive:true});await writeFile(`${dir}/${label}.json`,JSON.stringify({state,ratio,probe,contacts,holdStartedAt:await page.evaluate(()=>window.v4HeavyHoldStartedAt??null)},null,2)+'\n');await page.screenshot({path:`${dir}/${label}.png`});return probe;
}

/** Slow presentation only. Optional hold after two measured contacts makes trusted Escape deterministic; no game state or native animation duration is changed. */
export async function setHeavySlowFrames(page:Page,enabled:boolean,holdAfterContacts=false){
  await page.evaluate(({enabled,holdAfterContacts})=>{
    window.v4HeavyRestoreFrames?.();delete window.v4HeavyRestoreFrames;delete window.v4HeavyHoldStartedAt;if(!enabled)return;
    const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),pending=new Map<number,number>();let serial=0;
    window.requestAnimationFrame=callback=>{const id=++serial,started=performance.now();const step=(time:number)=>{if(!pending.has(id))return;if(performance.now()-started>=250&&holdAfterContacts&&window.v4HammerGeometry?.complete&&window.v4HammerGeometry.frames.filter(f=>f.phase==='contact'&&f.gap<6&&f.metalGap<6&&Math.abs(f.angle)<10).length>=2){window.v4HeavyHoldStartedAt??=performance.now();pending.set(id,raf(step));return;}if(performance.now()-started>=250){pending.delete(id);callback(time);}else pending.set(id,raf(step));};pending.set(id,raf(step));return id;};
    window.cancelAnimationFrame=id=>{const actual=pending.get(id);if(actual!==undefined)cancel(actual);pending.delete(id);};
    window.v4HeavyRestoreFrames=()=>{for(const handle of pending.values())cancel(handle);pending.clear();window.requestAnimationFrame=raf;window.cancelAnimationFrame=cancel;};
  },{enabled,holdAfterContacts});
}
export {installV4HammerProbe};
