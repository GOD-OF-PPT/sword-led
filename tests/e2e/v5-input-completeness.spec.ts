// Current v5 UI boundaries. Each test labels restored fixtures and fresh openings explicitly.
import {test,expect} from '@playwright/test';
import {KeyboardV5,keyToV5,v5Sdk} from './v5-helpers.js';
import {acceptedByV5,hitPointV5} from './v5-interaction-helpers.js';

test('v5 input boundary: right button is ignored and native left drag releases only its original strike',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();await h.start();await h.command({type:'continue'});
 const before=await h.read(),point=await hitPointV5(page);
 await h.same('right mouse down/up is not a forge command',async()=>{
  await page.mouse.click(point.x,point.y,{button:'right'});
  // Dismiss the browser's native context menu before the independent left-drag observation.
  // Engines that deliver Escape to the page may open its pause sheet; resume it by its real button.
  await page.keyboard.press('Escape');
  if(await page.locator('#v4-dialog').isVisible())await h.activate(page.getByRole('button',{name:'继续锻造',exact:true}));
 });
 const ignored=await h.record('native-right-button-zero-commands');expect(ignored.raw).toEqual(before.raw);expect(ignored.state.revision).toBe(before.state.revision);
 await acceptedByV5(h,{type:'strike',pieceId:'d1-1'},async()=>{
  await page.mouse.move(point.x,point.y);await page.mouse.down({button:'left'});
  await page.mouse.move(point.x+110,point.y-65,{steps:12});
  await page.mouse.move(point.x-55,point.y+25,{steps:8});
  await page.mouse.up({button:'left'});
 });
 await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
 const released=await h.record('native-left-drag-release-no-second-strike');expect(released.state.revision).toBe(before.state.revision+1);expect(released.state.journal.slice(before.state.journal.length)).toEqual([{type:'strike',pieceId:'d1-1'}]);
 expect(released.state.blades.find(blade=>blade.id==='d1-2')).toEqual(before.state.blades.find(blade=>blade.id==='d1-2'));
 await h.capture('right-ignored-left-drag-one-strike');await h.finish({scope:'Fresh opening input boundary only: actual right click and held-left drag; no complete journey claim',ignoredRightCommands:0,leftDragCommands:1});
});

test('v5 input boundary: pending Space cannot follow a different sword or a newly confirmed run',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();await h.start();await h.command({type:'continue'});
 const original=await h.read();
 await h.same('Space prepared on sword one is cancelled by native selection of sword two',async()=>{
  await keyToV5(page,page.locator('#v4-strike'));await page.keyboard.down('Space');
  await h.select('d1-2');await expect(page.locator('#v4-inventory button[data-piece="d1-2"]')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.up('Space');
 });
 const switched=await h.record('pending-space-switch-sword-zero-commands');expect(switched.raw).toEqual(original.raw);expect(switched.state.blades.find(blade=>blade.id==='d1-2')?.hits).toBe(0);

 // Keep the physical Space key held while the user navigates out and explicitly replaces the run.
 // There is no page reload, injected save, session port call or resource assignment in this transition.
 await keyToV5(page,page.locator('#v4-strike'));await page.keyboard.down('Space');
 await h.activate(page.locator('#v4-menu'));await expect(page.locator('#v4-dialog-title')).toHaveText('炉火为你留着');
 await h.activate(page.getByRole('button',{name:'回标题',exact:true}));await expect(page.locator('#v4-title')).toBeVisible();
 await h.activate(page.locator('#v4-start'));await expect(page.locator('#v4-dialog')).toBeVisible();await h.confirm();
 const fresh=await h.record('real-confirmed-new-run-before-old-space-release');expect(fresh.state.runId).not.toBe(original.state.runId);expect(fresh.state.phase).toBe('opening');expect(fresh.state.revision).toBe(0);expect(fresh.state.coins).toBe(0);expect(fresh.state.journal).toEqual([]);
 const created=v5Sdk.createRun({runId:fresh.state.runId,seed:fresh.state.seed,mode:'story',eligibility:fresh.state.initialEligibility});if(!created.ok)throw Error(created.error);expect(fresh.state).toEqual(created.state);
 await page.keyboard.up('Space');const afterRelease=await h.record('old-space-release-does-not-touch-new-run');expect(afterRelease.state).toEqual(fresh.state);expect(afterRelease.raw).toEqual(fresh.raw);
 await expect(page.locator('#v4-stage')).toHaveAttribute('data-scene','opening');await h.capture('new-opening-after-stale-space-release');
 await h.command({type:'continue'});await h.command({type:'strike',pieceId:'d1-1'});const working=await h.record('new-run-explicit-fresh-input-works');expect(working.state.runId).toBe(fresh.state.runId);expect(working.state.revision).toBe(2);expect(working.state.journal).toEqual([{type:'continue'},{type:'strike',pieceId:'d1-1'}]);
 await h.finish({scope:'Two real fresh openings for pending-key identity checks, not two complete journeys; old Space release is zero economic commands',newRunCreations:2,pendingSwordSwitchCommands:0,oldRunReleaseIntoNewRunCommands:0,newRunExplicitCommands:2});
});
