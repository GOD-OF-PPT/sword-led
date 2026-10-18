# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v2-resilience.spec.ts >> v2 combined settings and primary/backup write failures preserve exact progress and recovery at 1280
- Location: tests/e2e/v2-resilience.spec.ts:6:69

# Error details

```
Error: expect(locator).toBeInViewport() failed

Locator:  locator('#v2-order')
Expected: in viewport
Received: viewport ratio 0.7566964030265808
Timeout:  5000ms

Call log:
  - Expect "toBeInViewport" locator('#v2-order') with timeout 5000ms
  - waiting for locator('#v2-order')
    14 × locator resolved to <div id="v2-order">第 1 / 12 轮 · 新交 0 + 信用 0 / 150 · 还差 150</div>
       - unexpected value "viewport ratio 0.7566964030265808"

```

```yaml
- text: 第 1 / 12 轮 · 新交 0 + 信用 0 / 150 · 还差 150
```

# Test source

```ts
  1  | import {test,expect} from './fixtures';
  2  | import {readV2,openV2,startV2,strikeV2,confirmV2} from './v2-helpers';
  3  | import {applyCommand} from '../../src/core-v2/index.js';
  4  | import {SETTINGS_KEY} from '../../src/platform/settings.js';
  5  | 
  6  | for(const size of[{width:1280,height:720},{width:1920,height:1080}])test(`v2 combined settings and primary/backup write failures preserve exact progress and recovery at ${size.width}`,async({page},info)=>{
  7  |   await page.setViewportSize(size);await page.addInitScript(()=>{const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(['sword-led.save.v2','sword-led.save.backup.v2','sword-led.settings.v1'].includes(key)&&Reflect.get(window,'releaseV2WriteFault'))throw new DOMException('Test quota','QuotaExceededError');return native.call(this,key,value);};});
  8  |   await openV2(page);await startV2(page,'v2-combined-fault');const before=await readV2(page),disk=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  9  |   await page.evaluate(()=>Reflect.set(window,'releaseV2WriteFault',true));await strikeV2(page,0);await page.locator('#v2-settings summary').click();await page.locator('#v2-muted').check();await expect(page.locator('#v2-settings-state')).toContainText('尚未保存');await expect(page.locator('#v2-save-state')).toContainText('尚未成功保存');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(disk);expect(await page.evaluate(()=>localStorage.getItem('sword-led.settings.v1'))).toBeNull();
> 10 |   await page.locator('#v2-settings summary').click();for(const selector of['#v2-order','#v2-wallet','#v2-retry','#v2-keep-memory','#v2-node-0','#v2-node-9','#v2-strike','#v2-outcomes','#v2-price-preview']){await expect(page.locator(selector)).toBeInViewport({ratio:.95});}
     |                                                                                                                                                                                                                                                    ^ Error: expect(locator).toBeInViewport() failed
  11 |   const path=info.outputPath(`v2-combined-${size.width}.png`);await page.screenshot({path});await info.attach(`v2-combined-${size.width}`,{path,contentType:'image/png'});
  12 |   await strikeV2(page,1);await page.evaluate(()=>Reflect.set(window,'releaseV2WriteFault',false));await page.locator('#v2-retry').click();let expected=before;for(const node of[0,1]){const r=applyCommand(expected,{runId:expected.runId,expectedRevision:expected.revision,action:{type:'strike',pieceId:'1:1',node,mode:'standard',timingMark:5000}});if(!r.ok)throw Error(r.error);expected=r.state;}expect(await readV2(page)).toEqual(expected);
  13 |   await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-settings-state')).toContainText('尚未保存');await page.locator('#v2-settings-retry').click();await expect(page.locator('#v2-settings-state')).toHaveText('设置已保存');expect(await readV2(page)).toEqual(expected);await page.reload();await page.locator('#v2-continue').click();expect(await readV2(page)).toEqual(expected);await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-muted')).toBeChecked();
  14 |   await info.attach(`v2-combined-recovered-${size.width}`,{body:Buffer.from(JSON.stringify({before,recovered:expected},null,2)),contentType:'application/json'});
  15 | });
  16 | 
  17 | test('v2 backup-only refusal preserves the accepted primary and exposes its warning without another action',async({page},info)=>{
  18 |   await page.addInitScript(()=>{const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.save.backup.v2')throw new DOMException('Test quota','QuotaExceededError');return native.call(this,key,value);};});await openV2(page);await startV2(page);await strikeV2(page);const accepted=await readV2(page);await expect(page.locator('#v2-save-state')).toContainText('主档已保存；备份未能更新');await expect(page.locator('#v2-retry')).toBeHidden();await page.reload();await page.locator('#v2-continue').click();expect(await readV2(page)).toEqual(accepted);await info.attach('v2-backup-warning',{body:Buffer.from(JSON.stringify(accepted,null,2)),contentType:'application/json'});
  19 | });
  20 | 
  21 | test('v2 corrupt primary needs explicit backup recovery and preserves the actual earlier sword',async({page},info)=>{
  22 |   await openV2(page);await startV2(page);await strikeV2(page,0);const backup=await readV2(page);await strikeV2(page,1);const rawBackup=await page.evaluate(()=>localStorage.getItem('sword-led.save.backup.v2'));
  23 |   await page.evaluate(()=>localStorage.setItem('sword-led.save.v2','{damaged'));await page.reload();await expect(page.locator('#v2-save-state')).toContainText('不兼容或已损坏');await page.locator('#v2-recover').click();await page.locator('#v2-dialog-actions button:first-child').click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe('{damaged');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.backup.v2'))).toBe(rawBackup);
  24 |   await page.locator('#v2-recover').click();await confirmV2(page);expect(await readV2(page)).toEqual(backup);await page.locator('#v2-continue').click();await expect(page.locator('#v2-piece-stats')).toContainText('已锻 1锤');await info.attach('v2-recovered-backup',{body:Buffer.from(JSON.stringify(backup,null,2)),contentType:'application/json'});
  25 | });
  26 | 
  27 | test('v2 future rules and settings stay untouched on read and cancelled replacement',async({page})=>{
  28 |   await openV2(page);await startV2(page);const future=await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('sword-led.save.v2')??'{}');save.rulesVersion='forge-future';const raw=JSON.stringify(save);localStorage.setItem('sword-led.save.v2',raw);return raw;});const prefs=JSON.stringify({schemaVersion:99,volume:999,muted:false,slow:true,reducedMotion:false});await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:SETTINGS_KEY,raw:prefs});await page.reload();
  29 |   await page.locator('#v2-new').click();await page.locator('#v2-dialog-actions button:first-child').click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(future);expect(await page.evaluate(()=>localStorage.getItem('sword-led.settings.v1'))).toBe(prefs);await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-settings-state')).toContainText('无法读取');await expect(page.locator('#v2-volume')).toHaveValue('55');await page.locator('#v2-slow').check();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sword-led.settings.v1')??'{}').schemaVersion)).toBe(1);expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).toBe(future);
  30 | });
  31 | 
  32 | test('v2 denied storage provides actual no-save forging while preferences fail separately',async({page})=>{
  33 |   await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));await openV2(page);await expect(page.locator('#v2-new')).toBeDisabled();await expect(page.locator('#v2-save-state')).toContainText('无法读取');await page.locator('#v2-settings summary').click();await page.locator('#v2-muted').check();await expect(page.locator('#v2-settings-state')).toContainText('尚未保存');await page.locator('#v2-settings summary').click();await page.locator('#v2-memory').click();await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();await strikeV2(page);await expect(page.locator('#v2-piece-stats')).toContainText('已锻 1锤');await expect(page.locator('#v2-save-state')).toContainText('不保存试玩');
  34 | });
  35 | 
  36 | test('v2 real writer handoff rereads the last accepted command and only then accepts a new strike',async({page,context},info)=>{
  37 |   await openV2(page);await startV2(page);const other=await context.newPage();await openV2(other);await expect(other.locator('#v2-new')).toBeDisabled();await page.bringToFront();if(await page.locator('#v2-resume').isVisible())await page.locator('#v2-resume').click();await strikeV2(page);const latest=await readV2(page);await page.close();await other.bringToFront();await other.locator('#v2-reread').click();await confirmV2(other);await expect(other.locator('#v2-new')).toBeEnabled();await other.locator('#v2-continue').click();expect(await readV2(other)).toEqual(latest);await strikeV2(other,1);const after=await readV2(other);expect(after.revision).toBe(latest.revision+1);expect(after.pieces[0]?.strikes).toBe(2);await info.attach('v2-writer-handoff',{body:Buffer.from(JSON.stringify({latest,after},null,2)),contentType:'application/json'});await other.close();
  38 | });
  39 | 
```