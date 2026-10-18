import { test, expect } from './fixtures';
import { openGame, startGame, preciseKeyStrike, readRun } from './helpers';
import { applyCommand, getRunView } from '../../src/core/index.js';

for(const size of[{width:1280,height:720},{width:1920,height:1080}])test(`combined save/settings failures keep results and visible recovery controls at ${size.width}x${size.height}`,async({page},info)=>{
  await page.setViewportSize(size);await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(['sword-led.save.v1','sword-led.settings.v1'].includes(key)&&Reflect.get(window,'combinedWriteFailure'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await openGame(page);await startGame(page,'combined-write-failure');const initial=await readRun(page),disk=await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'));
  await page.evaluate(()=>Reflect.set(window,'combinedWriteFailure',true));await preciseKeyStrike(page);await page.locator('#mute').click();
  await expect(page.locator('#app')).toHaveAttribute('data-revision','1');await expect(page.locator('#game-note')).toContainText('设置尚未保存');
  for(const selector of['#retry-save','#refresh-slot','#keep-memory','#strike','#risk-row','#break-warning','#stress-meter'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
  const note=await page.locator('#game-note').boundingBox();if(!note)throw new Error('No status notice');
  for(const button of['#retry-save','#refresh-slot','#keep-memory']){
    const box=await page.locator(button).boundingBox();if(!box)throw new Error('No recovery control');
    expect(note.x<box.x+box.width&&note.x+note.width>box.x&&note.y<box.y+box.height&&note.y+note.height>box.y,`status overlaps ${button}`).toBe(false);
  }
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBe(disk);expect(await page.evaluate(()=>localStorage.getItem('sword-led.settings.v1'))).toBeNull();
  const shot=info.outputPath(`combined-failure-${size.width}.png`);await page.screenshot({path:shot});await info.attach(`combined-failure-${size.width}`,{path:shot,contentType:'image/png'});
  await preciseKeyStrike(page);await expect(page.locator('#app')).toHaveAttribute('data-revision','2');
  await page.evaluate(()=>Reflect.set(window,'combinedWriteFailure',false));await page.locator('#retry-save').click();
  let expected=initial;for(let i=0;i<2;i++){const result=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action:{type:'strike',pieceId:'1:1',mode:'standard',timingMark:5000}});if(!result.ok)throw new Error(result.error);expected=result.state;}
  expect(await readRun(page)).toEqual(expected);await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();
  await expect(page.locator('#settings-status')).toContainText('尚未保存');await page.locator('#settings-retry').click();await expect(page.locator('#settings-status')).toHaveText('设置已保存');
  expect(await readRun(page)).toEqual(expected);await info.attach(`combined-recovery-${size.width}`,{body:Buffer.from(JSON.stringify({initial,recovered:expected,view:getRunView(expected)},null,2)),contentType:'application/json'});
});

test('desktop context identity and image/control scale are reported from the real engine',async({page,browserName},info)=>{
  await openGame(page);await startGame(page);const environment=await page.evaluate(()=>({userAgent:navigator.userAgent,dpr:devicePixelRatio,secureContext:isSecureContext,webLocks:typeof navigator.locks?.request,audio:typeof AudioContext}));
  expect(environment.secureContext).toBe(true);expect(environment.webLocks).toBe('function');
  expect(environment.dpr).toBe(info.project.use.deviceScaleFactor ?? 1);
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(size);
    for(const selector of['#strike','#risk-row','#piece-3','#break-warning','#stress-meter','#mute'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const canvas=await page.locator('#forge-scene').evaluate(node=>{const canvas=node as HTMLCanvasElement,ctx=canvas.getContext('2d');return{width:canvas.width,cssWidth:canvas.getBoundingClientRect().width,filterSupported:!!ctx&&'filter'in ctx,sidePixel:ctx?[...ctx.getImageData(1,Math.floor(canvas.height/2),1,1).data]:[]};});
    if(environment.dpr>1)expect(canvas.width).toBeGreaterThan(canvas.cssWidth*1.8);expect(canvas.width).toBeLessThanOrEqual(4096);
    if(!canvas.filterSupported){expect(canvas.sidePixel[3]).toBe(255);expect(Math.max(...canvas.sidePixel.slice(0,3))).toBeLessThanOrEqual(70);}
    await info.attach(`canvas-capability-${size.width}`,{body:Buffer.from(JSON.stringify({size,...canvas},null,2)),contentType:'application/json'});
    const path=info.outputPath(`${browserName}-desktop-${size.width}-dpr${environment.dpr}.png`);await page.screenshot({path});await info.attach(`desktop-${size.width}-dpr${environment.dpr}`,{path,contentType:'image/png'});
  }
  await info.attach('engine-environment',{body:Buffer.from(JSON.stringify({browserName,version:await page.context().browser()?.version(),environment},null,2)),contentType:'application/json'});
});

test('a read-only game window acquires ownership only after rereading the latest saved command',async({page,context},info)=>{
  await openGame(page);await startGame(page,'ui-window-handoff');const initial=await readRun(page);
  const other=await context.newPage();await openGame(other);await expect(other.locator('#new-game')).toBeDisabled();
  await page.bringToFront();if(await page.getByRole('button',{name:'继续锻造',exact:true}).isVisible())await page.getByRole('button',{name:'继续锻造',exact:true}).click();
  await preciseKeyStrike(page);const latest=await readRun(page);expect(latest.revision).toBe(initial.revision+1);await page.close();
  await other.bringToFront();await other.locator('#reconnect').click();await expect(other.locator('#new-game')).toBeEnabled();await other.locator('#continue').click();
  expect(await readRun(other)).toEqual(latest);await preciseKeyStrike(other);const after=await readRun(other);expect(after.revision).toBe(2);expect(after.rng.strike.draws).toBe(2);
  await info.attach('ui-window-handoff',{body:Buffer.from(JSON.stringify({initial,latest,after},null,2)),contentType:'application/json'});await other.close();
});
