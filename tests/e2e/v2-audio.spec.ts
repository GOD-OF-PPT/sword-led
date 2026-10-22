import {test,expect} from './fixtures';
import {installAudioProbe,audioProbe} from './audio-probe';
import {readV2,openV2,startV2,strikeV2,confirmV2} from './v2-helpers';

test('v2 actual accepted strike creates native waveform and mute/pause/menu/reload stop or avoid replay',async({page},info)=>{
  await installAudioProbe(page);await openV2(page,false);expect((await audioProbe(page)).constructors).toBe(0);await startV2(page);await page.locator('#v2-strike').focus();await page.keyboard.down('Space');await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['running']);await page.waitForTimeout(350);await page.keyboard.up('Space');await expect.poll(async()=>(await audioProbe(page)).peak).toBeGreaterThan(.001);const sound=await audioProbe(page);expect(sound.starts).toBe(3);expect(sound.frequencies).toEqual([719,1193,1777]);const accepted=await readV2(page);
  await page.locator('#v2-pause').click();await expect.poll(async()=>(await audioProbe(page)).active).toBe(0);await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);await page.locator('#v2-resume').click();await strikeV2(page,1,'standard',false);await page.locator('#v2-settings summary').click();await page.locator('#v2-muted').check();await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);expect((await audioProbe(page)).active).toBe(0);expect((await audioProbe(page)).maxActive).toBeLessThanOrEqual(12);const beforeReload=await readV2(page);await page.locator('#v2-menu-button').click();await page.reload();await page.locator('#v2-continue').click();expect((await audioProbe(page)).starts).toBe(0);expect(await readV2(page)).toEqual(beforeReload);
  await info.attach('v2-native-audio',{body:Buffer.from(JSON.stringify({sound,accepted,beforeReload,afterReload:await audioProbe(page)},null,2)),contentType:'application/json'});
});

test('v2 delayed native audio resume cannot sound the old accepted strike after a pause or new contract',async({page},info)=>{
  await installAudioProbe(page);await openV2(page);await startV2(page);
  await page.locator('#v2-mode-standard').click();await page.locator('#v2-node-0').click();await expect(page.locator('#v2-strike')).toBeFocused();
  await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['running']);
  const prepared=await audioProbe(page);expect(prepared.contexts).toBe(1);expect(prepared.starts).toBe(0);expect(prepared.active).toBe(0);
  await page.evaluate(()=>window.audioTestProbe.armDeferResume());
  const armed=await audioProbe(page);expect(armed.deferArmState).toBe('armed');expect(armed.states).toEqual(['suspended']);expect(armed.starts).toBe(0);
  await page.keyboard.down('Space');
  const held=await audioProbe(page);expect(held.deferArmState).toBe('held');expect(held.hasHeldResume).toBe(true);expect(held.states).toEqual(['suspended']);expect(held.starts).toBe(0);
  await page.clock.runFor(350);await page.keyboard.up('Space');expect((await audioProbe(page)).starts).toBe(0);
  const old=await readV2(page);expect(old.pieces[0]?.strikes).toBe(1);
  await page.locator('#v2-pause').click();
  await page.evaluate(()=>{const release=window.audioTestProbe.releaseResume;if(!release)throw new Error('Missing held target resume');return release();});
  await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['suspended']);
  const released=await audioProbe(page);expect(released.deferArmState).toBe('released');expect(released.hasHeldResume).toBe(false);expect(released.contexts).toBe(1);expect(released.starts).toBe(0);expect(released.active).toBe(0);
  await page.locator('#v2-menu-button').click();await page.locator('#v2-new').click();await confirmV2(page);
  await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-decline').click();await page.locator('#v2-strike').focus();await page.keyboard.down('Space');
  await expect.poll(async()=>(await audioProbe(page)).states).toEqual(['running']);expect((await audioProbe(page)).starts).toBe(0);
  await page.clock.runFor(350);await page.keyboard.up('Space');const fresh=await readV2(page);
  expect(fresh.runId).not.toBe(old.runId);expect(fresh.pieces[0]?.strikes).toBe(1);await expect.poll(async()=>(await audioProbe(page)).starts).toBe(3);
  const probe=await audioProbe(page);expect(probe.contexts).toBe(1);expect(probe.states).toEqual(['running']);expect(probe.deferArmState).toBe('released');
  await info.attach('v2-deferred-audio',{body:Buffer.from(JSON.stringify({prepared,armed,held,old,released,fresh,probe},null,2)),contentType:'application/json'});
});

test('v2 native resume denial stays readable and never revokes an accepted sword',async({page,browserName})=>{
  await installAudioProbe(page,{rejectResume:true});await openV2(page);await startV2(page);await strikeV2(page);const accepted=await readV2(page);expect(accepted.pieces[0]?.strikes).toBe(1);await page.locator('#v2-settings summary').click();await expect(page.locator('#v2-audio-state')).toContainText('被浏览器阻止');const probe=await audioProbe(page);expect(probe.starts).toBe(0);expect(probe.active).toBe(0);expect(probe.contexts).toBe(1);expect(probe.states).toHaveLength(1);if(browserName==='webkit')expect(['suspended','interrupted']).toContain(probe.states[0]);else expect(probe.states).toEqual(['suspended']);expect(await readV2(page)).toEqual(accepted);
});
