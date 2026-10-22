import {test,expect} from '../e2e/fixtures.js';
import {writeFile} from 'node:fs/promises';
import {installReleaseAudioProbe,releaseAudioSnapshot,setReleaseAudioFaults,resetReleaseAudioCapture} from './audio-probe.js';

test('v5 explicit preview retry replaces a held preview without replaying the old request or changing saves',async({page},info)=>{
 await installReleaseAudioProbe(page);await page.goto('/');await expect(page.locator('#v4-start')).toBeEnabled();
 const keys=['sword-led.save.v5','sword-led.save.backup.v5','sword-led.collection.v2','sword-led.collection.backup.v2'];
 const slots=()=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),keys);
 const before=await slots(),retry=page.getByRole('button',{name:'试听敲击声',exact:true});
 let phase='normal-preview';
 try{
  await page.locator('#v4-title-settings').click();await retry.click();
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).starts).toBe(3);
  await page.getByRole('button',{name:'收好',exact:true}).click();
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).states).toEqual(['suspended']);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).active).toBe(0);
  await page.locator('#v4-title-settings').click();
  await setReleaseAudioFaults(page,{defer:true});await resetReleaseAudioCapture(page);
  phase='held-preview';await retry.click();
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).deferred).toBe(true);
  const held=await releaseAudioSnapshot(page);expect(held.hasDeferredResume).toBe(true);expect(held.starts).toBe(3);expect(held.active).toBe(0);
  phase='explicit-retry';await retry.click();
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).resumeCalls).toBeGreaterThan(held.resumeCalls);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).capturedPeak).toBeGreaterThan(.001);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).starts).toBe(6);
  const current=await releaseAudioSnapshot(page);expect(current.contexts).toBe(1);expect(current.states).toEqual(['running']);
  phase='release-old';await page.evaluate(()=>{const release=window.v5ReleaseAudio.releaseResume;if(!release)throw Error('Missing held preview request');return release();});
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).operations.some(row=>row.origin==='held-release'&&row.phase==='settled')).toBe(true);
  expect((await releaseAudioSnapshot(page)).starts).toBe(6);
  await page.getByRole('button',{name:'收好',exact:true}).click();
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).states).toEqual(['suspended']);
  await expect.poll(async()=>(await releaseAudioSnapshot(page)).active).toBe(0);
  const final=await releaseAudioSnapshot(page);expect(final.starts).toBe(6);expect(final.sources.every(source=>source.disconnected)).toBe(true);expect(await slots()).toEqual(before);
  phase='complete';
 }finally{
  await writeFile(info.outputPath('explicit-preview-retry.json'),JSON.stringify({phase,before,after:await slots(),audio:await releaseAudioSnapshot(page),scope:'Real normal preview then a declared test fault invoking native resume in the gesture and holding its completion after confirmed suspension. A second actual click must issue a fresh native request; stale preview never sounds and all game/collection bytes remain unchanged. Not the original late-title case or proof of physical speakers.'},null,2)+'\n');
 }
});
