import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {validateRun} from '../../src/core-v2/index.js';
import type {RunState,Technique,HammerMode} from '../../src/core-v2/index.js';
import {HAMMERS,TECHNIQUES} from '../../src/core-v2/rules.js';

export async function readV2(page:Page):Promise<RunState>{
  const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));
  if(!raw)throw Error('Missing actual v2 save');const result=validateRun(JSON.parse(raw).state);
  if(!result.ok)throw Error(result.detail);return result.state;
}
export async function openV2(page:Page,clock=true){
  if(clock)await page.clock.install({time:new Date('2026-10-19T09:00:00Z')});
  await page.goto('/v2.html');await expect(page.locator('#v2-menu')).toBeVisible();
  if(clock)await page.clock.pauseAt(new Date('2026-10-19T09:01:00Z'));
}
export async function startV2(page:Page,seed='release-v2',starter:Technique='bridgeClip'){
  await expect(page.locator('#v2-new')).toBeEnabled();await page.locator('#v2-seed').fill(seed);await page.locator('#v2-new').click();
  await page.locator('#v2-starters').getByRole('button',{name:new RegExp(TECHNIQUES[starter].label)}).click();
  await page.locator('#v2-requests button:first-child').click();await expect(page.locator('#v2-strike')).toBeEnabled();
}
export async function strikeV2(page:Page,node=0,mode:HammerMode='standard',clock=true){
  await page.locator(`#v2-mode-${mode}`).click();await page.locator(`#v2-node-${node}`).click();
  await expect(page.locator('#v2-strike')).toBeFocused();await page.keyboard.down('Space');
  if(clock)await page.clock.runFor(HAMMERS[mode].periodMs/4);else await page.waitForTimeout(HAMMERS[mode].periodMs/4);
  await page.keyboard.up('Space');
}
export async function confirmV2(page:Page){await expect(page.locator('#v2-dialog')).toBeVisible();await page.locator('#v2-dialog-actions button:last-child').click();}
