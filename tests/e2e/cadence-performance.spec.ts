import { test, expect } from './fixtures';
import { openGame, startGame, readRun } from './helpers';

// Timing samples should not include trace screenshot/DOM collection overhead; other UI specs retain failure traces.
test.use({ trace: 'off' });

interface FrameProbe { callbacks:number; costs:number[]; stamps:number[] }
declare global { interface Window { frameTestProbe: FrameProbe } }
for (const hz of [60,120,144]) test(`simulated ${hz}Hz drawing preserves the event-time strike and stops when idle`,async({page},info)=>{
  await openGame(page);
  await page.evaluate(hz=>{
    window.frameTestProbe={callbacks:0,costs:[],stamps:[]};
    window.requestAnimationFrame=callback=>window.setTimeout(()=>{window.frameTestProbe.callbacks++;callback(performance.now());},1000/hz);
    window.cancelAnimationFrame=id=>window.clearTimeout(id);
  },hz);
  await startGame(page,'cadence-invariance');await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);
  const drawing=await page.evaluate(()=>window.frameTestProbe.callbacks);expect(drawing).toBeGreaterThanOrEqual(Math.floor(hz*.35)-1);
  await page.keyboard.up('Space');await page.clock.runFor(500);const run=await readRun(page);
  expect(run.journal[0]).toMatchObject({type:'strike',mode:'standard',timingMark:5000});expect(run.pieces[0]).toMatchObject({progress:3,heat:88});expect(run.rng.strike.draws).toBe(1);
  const idle=await page.evaluate(()=>window.frameTestProbe.callbacks);await page.clock.runFor(1000);expect(await page.evaluate(()=>window.frameTestProbe.callbacks)).toBe(idle);
  await info.attach(`cadence-${hz}`,{body:Buffer.from(JSON.stringify({method:'test-only rAF timer cadence; not a physical display benchmark',hz,drawing,callbacks:idle,state:run},null,2)),contentType:'application/json'});
});

for(const size of [{width:1280,height:720},{width:1920,height:1080}])test(`native rAF callback budget and idle work at ${size.width}x${size.height}`,async({page},info)=>{
  await page.setViewportSize(size);await openGame(page,false);
  await page.evaluate(()=>{
    const native=requestAnimationFrame.bind(window);window.frameTestProbe={callbacks:0,costs:[],stamps:[]};
    window.requestAnimationFrame=callback=>native(stamp=>{const begin=performance.now();callback(stamp);window.frameTestProbe.callbacks++;window.frameTestProbe.costs.push(performance.now()-begin);window.frameTestProbe.stamps.push(stamp);});
  });
  await startGame(page,'native-budget');
  for(let strike=0;strike<3;strike++){
    await page.locator('#strike').focus();await page.keyboard.down('Space');await page.waitForTimeout(350);await page.keyboard.up('Space');await expect(page.locator('#strike')).toBeEnabled();
  }
  const before=await page.evaluate(()=>window.frameTestProbe.callbacks);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.frameTestProbe.callbacks)).toBe(before);
  const sample=await page.evaluate(()=>window.frameTestProbe);expect(sample.costs.length).toBeGreaterThan(30);
  const costs=[...sample.costs].sort((a,b)=>a-b),p95=costs[Math.min(costs.length-1,Math.ceil(costs.length*.95)-1)]??Infinity;
  await info.attach(`native-frame-budget-${size.width}`,{body:Buffer.from(JSON.stringify({size,browser:await page.context().browser()?.version(),method:'native rAF callback wall-time cost, includes JS drawing/feedback; not GPU or physical high-refresh certification',p95Ms:p95,sample},null,2)),contentType:'application/json'});
  expect(p95).toBeLessThan(16.7);expect((await readRun(page)).stats.strikes).toBe(3);
});
