import { test, expect } from './fixtures';
import { openGame, startGame, readRun } from './helpers';
import { installAudioProbe, audioProbe } from './audio-probe';

test('native audio begins only after a gesture, produces a waveform and becomes silent when muted or volume is zero', async ({ page }, info) => {
  await installAudioProbe(page);await openGame(page,false);expect((await audioProbe(page)).constructors).toBe(0);
  await page.locator('#options').click();expect((await audioProbe(page)).constructors).toBe(0);
  await page.locator('#sound-test').click();await expect.poll(async()=> (await audioProbe(page)).peak).toBeGreaterThan(.001);
  const sounding=await audioProbe(page);expect(sounding.starts).toBe(3);expect(sounding.frequencies).toEqual([719,1193,1777]);
  await page.locator('#mute-setting').check();await expect.poll(async()=> (await audioProbe(page)).active).toBe(0);
  await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['suspended']);await expect(page.locator('#sound-test')).toBeDisabled();
  await page.locator('#mute-setting').uncheck();await page.locator('#sound-test').click();await expect.poll(async()=> (await audioProbe(page)).starts).toBe(6);
  await page.locator('#volume-setting').press('Home');await expect(page.locator('#volume-value')).toHaveText('0%');await expect(page.locator('#sound-test')).toBeDisabled();
  await expect.poll(async()=> (await audioProbe(page)).active).toBe(0);const silent=await audioProbe(page);
  await info.attach('native-audio-waveform',{body:Buffer.from(JSON.stringify({sounding,silent},null,2)),contentType:'application/json'});
});

test('accepted strike audio has bounded sources, stops on pause/menu and is never replayed by a reload', async ({ page }, info) => {
  await installAudioProbe(page);await openGame(page);await startGame(page);
  await page.locator('#strike').focus();await page.keyboard.down('Space');await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['running']);
  await page.clock.runFor(350);await page.keyboard.up('Space');expect((await readRun(page)).revision).toBe(1);expect((await audioProbe(page)).starts).toBe(3);
  await page.locator('#pause').click();await expect.poll(async()=> (await audioProbe(page)).active).toBe(0);await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['suspended']);
  await page.getByRole('button',{name:'操作设置',exact:true}).click();await page.locator('#sound-test').click();
  await expect.poll(async()=> (await audioProbe(page)).starts).toBe(6);
  for (let i=0;i<12;i++) await page.locator('#sound-test').press('Enter');
  const peakLoad=await audioProbe(page);expect(peakLoad.maxActive).toBeLessThanOrEqual(12);expect(peakLoad.starts).toBe(42);
  await page.getByRole('button',{name:'返回暂停',exact:true}).click();await expect.poll(async()=> (await audioProbe(page)).active).toBe(0);
  await page.getByRole('button',{name:'返回菜单',exact:true}).click();await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['suspended']);
  const accepted=await readRun(page);await page.reload();await expect(page.locator('#menu')).toBeVisible();expect((await audioProbe(page)).constructors).toBe(0);
  await page.locator('#continue').click();expect((await audioProbe(page)).starts).toBe(0);expect(await readRun(page)).toEqual(accepted);
  await info.attach('audio-lifecycle-and-cap',{body:Buffer.from(JSON.stringify(peakLoad,null,2)),contentType:'application/json'});
});

test('a rejected AudioContext degrades to readable silent play without revoking an accepted action', async ({ page }) => {
  await installAudioProbe(page,{deny:true});await openGame(page);await startGame(page);
  await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');await page.clock.runFor(500);
  expect((await readRun(page)).revision).toBe(1);await expect(page.locator('#mute')).toHaveText('无声');
  await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();await page.locator('#sound-test').click();
  await expect(page.locator('#sound-status')).toContainText('不可用');expect((await audioProbe(page)).contexts).toBe(0);
});

test('a delayed native resume cannot sound an old strike after pause or arm a later contract', async ({ page }, info) => {
  await installAudioProbe(page,{defer:true});await openGame(page);await startGame(page);
  await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');
  expect((await readRun(page)).revision).toBe(1);expect((await audioProbe(page)).starts).toBe(0);await page.locator('#pause').click();
  await page.evaluate(()=>window.audioTestProbe.releaseResume?.());await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['suspended']);
  const stale=await audioProbe(page);expect(stale.starts).toBe(0);expect(stale.active).toBe(0);
  const old=await readRun(page);await page.getByRole('button',{name:'返回菜单',exact:true}).click();await page.locator('#new-game').click();await page.locator('#seed').fill('fresh-after-audio');
  await page.getByRole('button',{name:'覆盖并开始新契约',exact:true}).click();await page.getByRole('button',{name:'开始锻造',exact:true}).click();
  expect((await readRun(page)).runId).not.toBe(old.runId);await page.locator('#strike').focus();await page.keyboard.down('Space');
  await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['running']);await page.clock.runFor(350);await page.keyboard.up('Space');
  expect((await readRun(page)).revision).toBe(1);expect((await audioProbe(page)).starts).toBe(3);
  await info.attach('late-resume-rejected',{body:Buffer.from(JSON.stringify({injection:'native context suspended at creation; first resume completion held by test only',stale,fresh:await audioProbe(page)},null,2)),contentType:'application/json'});
});

test('closing settings cancels an unresolved preview instead of playing it later', async ({ page }) => {
  await installAudioProbe(page,{defer:true});await openGame(page,false);await page.locator('#options').click();await page.locator('#sound-test').click();
  await page.getByRole('button',{name:'完成',exact:true}).click();await page.evaluate(()=>window.audioTestProbe.releaseResume?.());
  await expect.poll(async()=> (await audioProbe(page)).states).toEqual(['suspended']);expect((await audioProbe(page)).starts).toBe(0);
});

test('a resume rejection leaves the real context suspended and the game playable',async({page},info)=>{
  await installAudioProbe(page,{rejectResume:true});await openGame(page);await startGame(page);
  await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');await page.clock.runFor(500);
  expect((await readRun(page)).revision).toBe(1);await expect(page.locator('#mute')).toHaveText('无声');
  await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();await page.locator('#sound-test').click();
  await expect(page.locator('#sound-status')).toContainText('暂未启用');const probe=await audioProbe(page);expect(probe.states).toEqual(['suspended']);expect(probe.starts).toBe(0);
  await info.attach('audio-resume-denied',{body:Buffer.from(JSON.stringify({injection:'native AudioContext with test-only rejected resume promise',probe},null,2)),contentType:'application/json'});
});
