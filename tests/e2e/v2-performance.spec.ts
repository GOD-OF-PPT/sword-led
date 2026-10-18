import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
import {validateRun} from '../../src/core-v2/index.js';
import {openV2,startV2,readV2} from './v2-helpers';

test.use({trace:'off'});
interface FrameV2 {callbacks:number;costs:number[];stamps:number[];keyupCosts:number[]}
declare global{interface Window{frameV2Probe:FrameV2}}
async function observeReleaseCost(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    window.frameV2Probe={callbacks:0,costs:[],stamps:[],keyupCosts:[]};const wrappers=new WeakMap<object,EventListener>();
    window.addEventListener=new Proxy(window.addEventListener,{apply(target,that,args){const [type,listener]=args;if(type==='keyup'&&listener){let wrapped=wrappers.get(listener);if(!wrapped){wrapped=(event:Event)=>{const before=performance.now();try{if(typeof listener==='function')Reflect.apply(listener,that,[event]);else listener.handleEvent(event);}finally{if(event instanceof KeyboardEvent&&event.code==='Space')window.frameV2Probe.keyupCosts.push(performance.now()-before);}};wrappers.set(listener,wrapped);}args[1]=wrapped;}return Reflect.apply(target,that,args);}});
    window.removeEventListener=new Proxy(window.removeEventListener,{apply(target,that,args){if(args[0]==='keyup'&&args[1])args[1]=wrappers.get(args[1])??args[1];return Reflect.apply(target,that,args);}});
  });
}

for(const hz of[60,120,144])test(`v2 simulated ${hz}Hz release uses event time and leaves no idle callback`,async({page},info)=>{
  await openV2(page);await page.evaluate(hz=>{window.frameV2Probe={callbacks:0,costs:[],stamps:[],keyupCosts:[]};window.requestAnimationFrame=callback=>window.setTimeout(()=>{window.frameV2Probe.callbacks++;callback(performance.now());},1000/hz);window.cancelAnimationFrame=id=>window.clearTimeout(id);},hz);await startV2(page,'v2-cadence');await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);const drawing=await page.evaluate(()=>window.frameV2Probe.callbacks);expect(drawing).toBeGreaterThanOrEqual(Math.floor(hz*.35)-1);await page.keyboard.up('Space');await page.clock.runFor(600);const state=await readV2(page);expect(state.journal.at(-1)).toMatchObject({type:'strike',timingMark:5000});expect(state.pieces[0]).toMatchObject({strikes:1,ratings:{edge:3,toughness:2,balance:0},heat:84,stress:4});const idle=await page.evaluate(()=>window.frameV2Probe.callbacks);await page.clock.runFor(1000);expect(await page.evaluate(()=>window.frameV2Probe.callbacks)).toBe(idle);await info.attach(`v2-cadence-${hz}`,{body:Buffer.from(JSON.stringify({method:'test-only timer rAF cadence, not physical display certification',hz,drawing,callbacks:idle,state},null,2)),contentType:'application/json'});
});
for(const size of[{width:1280,height:720},{width:1920,height:1080}])test(`v2 native callback cost and idle budget at ${size.width}`,async({page},info)=>{
  await page.setViewportSize(size);await observeReleaseCost(page);await openV2(page,false);await page.evaluate(()=>{const native=requestAnimationFrame.bind(window);window.frameV2Probe={callbacks:0,costs:[],stamps:[],keyupCosts:[]};window.requestAnimationFrame=callback=>native(stamp=>{const start=performance.now();callback(stamp);window.frameV2Probe.callbacks++;window.frameV2Probe.costs.push(performance.now()-start);window.frameV2Probe.stamps.push(stamp);});});await startV2(page,'v2-native-budget');
  for(const node of[0,1,2]){await page.locator(`#v2-node-${node}`).click();await page.keyboard.down('Space');await page.waitForTimeout(450);await page.keyboard.up('Space');}await page.waitForTimeout(500);const before=await page.evaluate(()=>window.frameV2Probe.callbacks);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.frameV2Probe.callbacks)).toBe(before);const sample=await page.evaluate(()=>window.frameV2Probe);expect(sample.costs.length).toBeGreaterThan(30);const costs=[...sample.costs].sort((a,b)=>a-b),p95=costs[Math.min(costs.length-1,Math.ceil(costs.length*.95)-1)]??Infinity;await info.attach(`v2-native-frame-${size.width}`,{body:Buffer.from(JSON.stringify({method:'native rAF callback cost plus separately wrapped actual Space-keyup handler duration without trace; not GPU or physical refresh certification',size,browser:await page.context().browser()?.version(),p95Ms:p95,sample,state:await readV2(page)},null,2)),contentType:'application/json'});expect(p95).toBeLessThan(16.7);expect((await readV2(page)).pieces[0]?.strikes).toBe(3);
});

// Restore an actual earlier UI save to sample a longer journal, never to claim a fresh campaign or manufacture victory.
test('v2 longer genuine UI journal has measured release cost and a replayable next strike',async({page},info)=>{
  const archived=JSON.parse(await readFile('docs/evidence/T11-3/polish-runtime/ui/v2-three-round-contract.json','utf8'));const checked=validateRun(archived.bought);if(!checked.ok)throw Error(checked.detail);expect(checked.state.phase).toBe('merchant');expect(checked.state.round).toBe(3);
  const raw=JSON.stringify({schemaVersion:2,rulesVersion:'forge-v2',savedAt:new Date().toISOString(),state:checked.state});await page.addInitScript(raw=>localStorage.setItem('sword-led.save.v2',raw),raw);await observeReleaseCost(page);await openV2(page,false);await page.locator('#v2-continue').click();await page.locator('#v2-phase-actions button:first-child').click();await page.locator('#v2-decline').click();const before=await readV2(page);
  for(const node of[0,1,2]){await page.locator(`#v2-node-${node}`).click();await page.keyboard.down('Space');await page.waitForTimeout(350);await page.keyboard.up('Space');}
  const after=await readV2(page),sample=await page.evaluate(()=>window.frameV2Probe);expect(after.revision).toBe(before.revision+3);expect(after.pieces[0]?.strikes).toBe(3);expect(sample.keyupCosts).toHaveLength(3);
  await info.attach('v2-longer-journal-cost',{body:Buffer.from(JSON.stringify({source:'actual T11.3 three-round UI save, restored only for latency/recovery measurement; not a fresh whole-game proof',sourceJournal:checked.state.journal.length,before,after,keyUpHandlerCostsMs:sample.keyupCosts},null,2)),contentType:'application/json'});
});
