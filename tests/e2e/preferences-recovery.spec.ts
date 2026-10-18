import { test, expect } from './fixtures';
import { openGame, startGame, preciseKeyStrike, readRun } from './helpers';
import { SETTINGS_KEY } from '../../src/platform/settings.js';
import { applyCommand } from '../../src/core/index.js';

test('preferences survive reload, honour the system and do not modify a contract', async ({ page }) => {
  await openGame(page);await startGame(page, 'settings-persist');await preciseKeyStrike(page);
  const before = await readRun(page);await page.locator('#menu-logo').click();await page.locator('#options').click();
  await expect(page.locator('#slow-setting')).toBeFocused();await page.locator('#mute-setting').check();await page.locator('#slow-setting').check();await page.locator('#motion-setting').check();
  await page.locator('#volume-setting').press('Home');for (let i = 0; i < 3; i++) await page.locator('#volume-setting').press('ArrowRight');
  await expect(page.locator('#volume-value')).toHaveText('3%');await expect(page.locator('#sound-test')).toBeDisabled();
  expect(await readRun(page)).toEqual(before);await page.getByRole('button', { name: '完成', exact: true }).click();await page.locator('#continue').click();
  await expect(page.locator('#strike')).toBeFocused();await expect(page.locator('#timing-speed')).toHaveText('慢速 ×1.5');await preciseKeyStrike(page, 525);
  const accepted = await readRun(page), expected = applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'strike',pieceId:'1:1',mode:'standard',timingMark:5000}});
  if (!expected.ok) throw new Error(expected.error);expect(accepted).toEqual(expected.state);expect(accepted.stats.strikes).toBe(2);
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#options').click();
  for (const id of ['#mute-setting','#slow-setting','#motion-setting']) await expect(page.locator(id)).toBeChecked();await expect(page.locator('#volume-setting')).toHaveValue('3');
  await page.emulateMedia({ reducedMotion: 'reduce' });await expect(page.locator('#motion-setting')).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });await expect(page.locator('#motion-setting')).toBeEnabled();await expect(page.locator('#motion-setting')).toBeChecked();
  expect(await readRun(page)).toEqual(accepted);
});

test('settings write failure retains live controls, retries separately and does not block accepted saves', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'sword-led.settings.v1' && Reflect.get(window, 'settingsFail')) throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value); };
  });
  await openGame(page);await startGame(page);await preciseKeyStrike(page);const before = await readRun(page);
  await page.evaluate(() => Reflect.set(window,'settingsFail',true));await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();
  await page.locator('#mute-setting').check();await expect(page.locator('#settings-status')).toContainText('尚未保存');await expect(page.locator('#settings-retry')).toBeVisible();
  expect(await readRun(page)).toEqual(before);await page.evaluate(() => Reflect.set(window,'settingsFail',false));await page.locator('#settings-retry').click();
  await expect(page.locator('#settings-status')).toHaveText('设置已保存');expect(await readRun(page)).toEqual(before);
  await page.getByRole('button',{name:'返回暂停',exact:true}).click();await page.getByRole('button',{name:'继续锻造',exact:true}).click();await preciseKeyStrike(page);
  expect((await readRun(page)).revision).toBe(2);expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').muted,SETTINGS_KEY)).toBe(true);
});

test('future settings remain untouched until an explicit preference change', async ({ page }) => {
  const raw = JSON.stringify({ schemaVersion:99,volume:999,muted:false,slow:true,reducedMotion:false });
  await page.addInitScript(({key,raw}) => localStorage.setItem(key,raw),{key:SETTINGS_KEY,raw});await openGame(page);
  expect(await page.evaluate(key => localStorage.getItem(key),SETTINGS_KEY)).toBe(raw);await expect(page.locator('#menu-settings-notice')).toContainText('原数据保留');
  await page.locator('#options').click();await expect(page.locator('#volume-setting')).toHaveValue('55');await expect(page.locator('#slow-setting')).not.toBeChecked();
  await page.locator('#slow-setting').check();expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').schemaVersion,SETTINGS_KEY)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBeNull();
});

test('a corrupt primary offers its real backup, and cancellation never overwrites either slot', async ({ page }, info) => {
  await openGame(page);await startGame(page);await preciseKeyStrike(page);const backup = await readRun(page);await preciseKeyStrike(page);
  const originalBackup = await page.evaluate(() => localStorage.getItem('sword-led.save.backup.v1'));
  await page.evaluate(() => localStorage.setItem('sword-led.save.v1','{damaged'));await page.reload();await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#menu-storage')).toContainText('内容损坏');await expect(page.locator('#continue')).toBeHidden();await page.locator('#recover').click();
  await expect(page.locator('#dialog-body')).toContainText('第 1 / 12 轮');await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBe('{damaged');
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.backup.v1'))).toBe(originalBackup);
  await page.locator('#recover').click();await page.getByRole('button',{name:'恢复备份',exact:true}).click();
  expect(await readRun(page)).toEqual(backup);await expect(page.locator('#feedback')).toBeEmpty();await expect(page.locator('#saved')).toHaveText('已保存');
  const screenshot=info.outputPath('backup-recovered.png');await page.screenshot({path:screenshot});await info.attach('backup-recovered',{path:screenshot,contentType:'image/png'});
});

test('an incompatible primary is explained and is not silently reset by opening and cancelling a new contract', async ({ page }) => {
  await openGame(page);await startGame(page);
  const raw = await page.evaluate(() => { const envelope=JSON.parse(localStorage.getItem('sword-led.save.v1') ?? '{}');envelope.rulesVersion='forge-future';const raw=JSON.stringify(envelope);localStorage.setItem('sword-led.save.v1',raw);return raw; });
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await expect(page.locator('#menu-storage')).toContainText('其他规则版本');
  await page.locator('#new-game').click();await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(() => localStorage.getItem('sword-led.save.v1'))).toBe(raw);
});

test('retaining dirty progress as memory play keeps accepted work and leaves the disk contract unchanged', async ({ page }) => {
  await page.addInitScript(() => {
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.save.v1'&&Reflect.get(window,'carryFail'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await openGame(page);await startGame(page);const disk=await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'));
  await page.evaluate(()=>Reflect.set(window,'carryFail',true));await preciseKeyStrike(page);await expect(page.locator('#piece-progress')).toHaveText('3 / 5');
  await page.locator('#keep-memory').click();await page.getByRole('button',{name:'取消',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBe(disk);
  await page.locator('#keep-memory').click();await page.getByRole('button',{name:'保留进度并继续试玩',exact:true}).click();
  await expect(page.locator('#saved')).toHaveText('不保存试玩');await preciseKeyStrike(page);await expect(page.locator('#app')).toHaveAttribute('data-revision','2');await expect(page.locator('#piece-progress')).toHaveText('6 / 9');
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBe(disk);await page.locator('#menu-logo').click();await page.locator('#continue').click();await expect(page.locator('#piece-progress')).toHaveText('6 / 9');
  await page.locator('#menu-logo').click();await page.locator('#reconnect').click();await page.getByRole('button',{name:'重新载入并读取',exact:true}).click();
  await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();await expect(page.locator('#app')).toHaveAttribute('data-revision','0');
});

test('a backup-only write failure truthfully reports the saved primary and does not repeat its reward', async ({ page }) => {
  await page.addInitScript(() => {
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.save.backup.v1')throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await openGame(page);await startGame(page);await preciseKeyStrike(page);const accepted=await readRun(page);
  await expect(page.locator('#storage-text')).toHaveText('进度已保存，备份未更新。');await expect(page.locator('#retry-save')).toBeHidden();
  await page.reload();await expect(page.locator('#menu')).toBeVisible();await page.locator('#continue').click();expect(await readRun(page)).toEqual(accepted);
});

test('denied storage has a clear memory-play exit while settings also degrade safely', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}); });
  await openGame(page);await expect(page.locator('#new-game')).toBeDisabled();await expect(page.locator('#menu-storage')).toContainText('无法读取');
  await page.locator('#options').click();await expect(page.locator('#settings-status')).toContainText('无法读取');await page.locator('#mute-setting').check();await expect(page.locator('#settings-status')).toContainText('尚未保存');
  await page.getByRole('button',{name:'完成',exact:true}).click();await page.locator('#memory-game').click();await page.locator('#seed').fill('policy-memory');
  await page.getByRole('button',{name:'开始不保存试玩',exact:true}).click();await page.getByRole('button',{name:'开始锻造',exact:true}).click();await preciseKeyStrike(page);
  await expect(page.locator('#app')).toHaveAttribute('data-revision','1');await expect(page.locator('#saved')).toHaveText('不保存试玩');
});

test('an explicit slow change overrides the lesson default even when it matches the saved formal preference',async({page})=>{
  await openGame(page);await startGame(page);await page.locator('#menu-logo').click();await page.locator('#practice').click();
  await expect(page.locator('#timing-speed')).toHaveText('慢速 ×1.5');await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();
  await expect(page.locator('#slow-setting')).toBeChecked();await page.locator('#slow-setting').uncheck();await expect(page.locator('#slow-setting')).not.toBeChecked();
  await page.getByRole('button',{name:'返回暂停',exact:true}).click();await page.getByRole('button',{name:'继续锻造',exact:true}).click();await expect(page.locator('#timing-speed')).toHaveText('标准速度');
  await page.locator('#lesson-exit').click();await page.locator('#continue').click();await expect(page.locator('#timing-speed')).toHaveText('标准速度');
});

test('native settings events preserve a dirty local preference and never rebase the contract',async({page,context})=>{
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.settings.v1'&&Reflect.get(window,'settingsFail'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await openGame(page);await startGame(page);await preciseKeyStrike(page);const before=await readRun(page);
  await page.evaluate(()=>Reflect.set(window,'settingsFail',true));await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();await page.locator('#slow-setting').check();
  const other=await context.newPage();await other.goto('/');await expect(other.locator('#menu')).toBeVisible();await other.locator('#options').click();await other.locator('#mute-setting').check();
  await expect(page.locator('#mute-setting')).not.toBeChecked();await expect(page.locator('#slow-setting')).toBeChecked();await expect(page.locator('#settings-status')).toContainText('尚未保存');expect(await readRun(page)).toEqual(before);
  await page.evaluate(()=>Reflect.set(window,'settingsFail',false));await page.locator('#settings-retry').click();
  await expect(other.locator('#mute-setting')).not.toBeChecked();await expect(other.locator('#slow-setting')).toBeChecked();expect(await readRun(page)).toEqual(before);await other.close();
});

for(const size of [{width:1280,height:720},{width:1920,height:1080}])test(`storage failure leaves controls and critical readings reachable at ${size.width}x${size.height}`,async({page},info)=>{
  await page.setViewportSize(size);await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sword-led.save.v1'&&Reflect.get(window,'carryFail'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await openGame(page);await startGame(page);await page.evaluate(()=>Reflect.set(window,'carryFail',true));await preciseKeyStrike(page);
  for(const selector of ['#retry-save','#keep-memory','#strike','#piece-3','#risk-row','#break-warning','#stress-meter'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
  const screenshot=info.outputPath(`storage-failure-${size.width}.png`);await page.screenshot({path:screenshot});await info.attach(`storage-failure-${size.width}`,{path:screenshot,contentType:'image/png'});
});
