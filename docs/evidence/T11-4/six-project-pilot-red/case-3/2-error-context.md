# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v2-critical-fault.spec.ts >> v2 720px fatal stress forecasts and recovery remain visible during simultaneous save/settings failure
- Location: tests/e2e/v2-critical-fault.spec.ts:6:1

# Error details

```
Error: expect(locator).toBeInViewport() failed

Locator:  locator('#v2-order')
Expected: in viewport
Received: viewport ratio 0.8285714285714286
Timeout:  5000ms

Call log:
  - Expect "toBeInViewport" locator('#v2-order') with timeout 5000ms
  - waiting for locator('#v2-order')
    14 × locator resolved to <div id="v2-order">第 1 / 12 轮 · 新交 0 + 信用 0 / 150 · 还差 150</div>
       - unexpected value "viewport ratio 0.8285714285714286"

```

```yaml
- text: 第 1 / 12 轮 · 新交 0 + 信用 0 / 150 · 还差 150
```

# Test source

```ts
  1  | import {test,expect} from './fixtures';
  2  | import {openV2,startV2,strikeV2,readV2,confirmV2} from './v2-helpers';
  3  | import {applyCommand} from '../../src/core-v2/index.js';
  4  | import type {Action} from '../../src/core-v2/index.js';
  5  | 
  6  | test('v2 720px fatal stress forecasts and recovery remain visible during simultaneous save/settings failure',async({page},info)=>{
  7  |   await page.setViewportSize({width:1280,height:720});await page.addInitScript(()=>{const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(['sword-led.save.v2','sword-led.save.backup.v2','sword-led.settings.v1'].includes(key)&&Reflect.get(window,'releaseV2WriteFault'))throw new DOMException('Test quota','QuotaExceededError');return native.call(this,key,value);};});await openV2(page);await startV2(page,'critical-combined-v2');
  8  |   async function miss(node:number){await page.locator('#v2-mode-heavy').click();await page.locator(`#v2-node-${node}`).click();await page.keyboard.down('Space');await page.keyboard.up('Space');}
  9  |   for(const node of[0,1,2,3])await miss(node);await page.locator('#v2-reheat').click();await confirmV2(page);for(const node of[4,9,8])await miss(node);const before=await readV2(page);expect(before.pieces[0]).toMatchObject({integrity:1,heat:28,stress:26});const disk=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
> 10 |   await page.evaluate(()=>Reflect.set(window,'releaseV2WriteFault',true));await strikeV2(page,7,'heavy');await page.locator('#v2-reheat').click();await confirmV2(page);await page.locator('#v2-node-6').click();await page.locator('#v2-settings summary').click();await page.locator('#v2-muted').check();await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-outcomes')).toContainText('将破碎');for(const selector of['#v2-order','#v2-wallet','#v2-retry','#v2-keep-memory','#v2-strike','#v2-outcomes','#v2-node-0','#v2-node-9','#v2-price-preview'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(disk);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             ^ Error: expect(locator).toBeInViewport() failed
  11 |   const path=info.outputPath('v2-critical-combined-720.png');await page.screenshot({path});await info.attach('v2-critical-combined-720',{path,contentType:'image/png'});await page.evaluate(()=>Reflect.set(window,'releaseV2WriteFault',false));await page.locator('#v2-retry').click();let expected=before;for(const action of[{type:'strike',pieceId:'1:1',node:7,mode:'heavy',timingMark:5000},{type:'reheat',pieceId:'1:1'}]satisfies Action[]){const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action});if(!r.ok)throw Error(r.error);expected=r.state;}expect(await readV2(page)).toEqual(expected);await info.attach('v2-critical-recovered',{body:Buffer.from(JSON.stringify({before,recovered:expected},null,2)),contentType:'application/json'});
  12 | });
  13 | 
```