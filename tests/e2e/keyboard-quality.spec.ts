import { test, expect } from './fixtures';
import { openGame, readRun, startGame } from './helpers';
import { keyActivate } from './keyboard';
import { textReadability } from './readability';

test('keyboard alone signs a contract, saves settings, forges, disposes, pauses, loses and restarts',async({page},info)=>{
  await page.addInitScript(()=>{Reflect.set(window,'keyboardPointerCount',0);window.addEventListener('pointerdown',()=>Reflect.set(window,'keyboardPointerCount',Number(Reflect.get(window,'keyboardPointerCount'))+1));});
  await openGame(page);await keyActivate(page,'#options');await expect(page.locator('#slow-setting')).toBeFocused();
  await page.keyboard.press('Space');await page.keyboard.press('Tab');await page.keyboard.press('Space');await page.keyboard.press('Tab');await page.keyboard.press('Space');
  await expect(page.locator('#mute-setting')).toBeChecked();await page.keyboard.press('Tab');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  await expect(page.locator('#volume-value')).toHaveText('1%');
  for(let i=0;i<12;i++)await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('#dialog')))).toBe(true);
  const metrics=await textReadability(page,'#dialog h2,#dialog p,#dialog label,#dialog button,#dialog output');expect(metrics.filter(item=>item.fontSize<12||item.contrast<4.5)).toEqual([]);
  const settings=info.outputPath('keyboard-settings.png');await page.screenshot({path:settings});await info.attach('keyboard-settings',{path:settings,contentType:'image/png'});
  await page.keyboard.press('Escape');await expect(page.locator('#options')).toBeFocused();
  await keyActivate(page,'#new-game');await expect(page.locator('#seed')).toBeFocused();await page.keyboard.type('keyboard-contract');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.locator('#strike')).toBeFocused();
  await page.keyboard.down('Space');await page.clock.runFor(525);await page.keyboard.up('Space');await page.clock.runFor(500);
  await page.keyboard.press('3');await page.keyboard.press('q');await page.keyboard.down('Space');await page.clock.runFor(600);await page.keyboard.up('Space');await page.clock.runFor(500);
  const forged=await readRun(page);expect(forged.stats.strikes).toBe(2);expect(forged.pieces[0]?.progress).toBe(3);expect(forged.pieces[2]?.progress).toBe(2);
  await keyActivate(page,'#deliver-button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.clock.runFor(500);
  await page.keyboard.press('1');await keyActivate(page,'#recycle-button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.clock.runFor(500);
  await keyActivate(page,'#settle-button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.locator('#phase-title')).toBeFocused();
  const day1=await readRun(page);expect(day1).toMatchObject({coins:35,scrap:6,seals:2});
  await page.keyboard.press('Escape');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.locator('#slow-setting')).toBeChecked();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await keyActivate(page,'#phase-advance');await expect(page.locator('#strike')).toBeFocused();
  for(let round=2;round<=3;round++) {
    await keyActivate(page,'#settle-button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    if(round===2)await keyActivate(page,'#phase-advance');
  }
  const failed=await readRun(page);expect(failed).toMatchObject({phase:'defeat',round:3,seals:0});
  await keyActivate(page,'#phase-new');await expect(page.locator('#seed')).toHaveValue('');await page.keyboard.type('keyboard-restart');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  expect((await readRun(page)).revision).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,'keyboardPointerCount'))).toBe(0);
  await info.attach('keyboard-only-flow',{body:Buffer.from(JSON.stringify({pointerEvents:0,forged,day1,failed,readability:metrics},null,2)),contentType:'application/json'});
});

test('read-only practice returns focus to a usable menu control',async({page,context})=>{
  await openGame(page);await keyActivate(page,'#new-game');await page.keyboard.type('owner');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  const other=await context.newPage();await other.goto('/');await expect(other.locator('#menu')).toBeVisible();await expect(other.locator('#new-game')).toBeDisabled();
  await keyActivate(other,'#practice');await keyActivate(other,'#lesson-exit');
  await expect(other.locator('#continue')).toBeFocused();await other.close();
});

test('feedback restores a ready strike but never steals focus after an explicit keyboard move',async({page})=>{
  await openGame(page);await startGame(page);await expect(page.locator('#strike')).toBeFocused();
  await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');await page.clock.runFor(500);await expect(page.locator('#strike')).toBeFocused();
  // Forward Tab may leave the document from the last temporarily disabled control.
  // Shift+Tab chooses the preceding enabled toolbar control without browser-chrome wrap assumptions.
  await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#mute')).toBeFocused();await page.clock.runFor(500);await expect(page.locator('#mute')).toBeFocused();expect((await readRun(page)).revision).toBe(2);
});

test('the sound toggle remains readable in both enabled and muted states',async({page},info)=>{
  await openGame(page);await startGame(page);const enabled=await textReadability(page,'#mute');await page.locator('#mute').click();
  const muted=await textReadability(page,'#mute');expect([...enabled,...muted].filter(item=>item.fontSize<12||item.contrast<4.5)).toEqual([]);
  await info.attach('audio-toggle-readability',{body:Buffer.from(JSON.stringify({idle:enabled,muted},null,2)),contentType:'application/json'});
});
