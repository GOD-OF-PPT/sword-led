import {test,expect} from './fixtures';
import {validateRun} from '../../src/core-v2/index.js';
import type {Page,TestInfo} from '@playwright/test';

async function saved(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'));if(!raw)throw Error('No actual save');const v=validateRun(JSON.parse(raw).state);if(!v.ok)throw Error(v.detail);return v.state;}
async function shot(page:Page,info:TestInfo,name:string){const path=info.outputPath(name+'.png');await page.screenshot({path});await info.attach(name,{path,contentType:'image/png'});}
async function confirm(page:Page){await page.locator('#v2-dialog-actions button:last-child').click();}

test('revised default entry, live workshop stages, actual sword and legacy exit stay clear at both desktop sizes',async({page},info)=>{
  test.setTimeout(90000);await page.clock.install({time:new Date('2026-10-19T12:00:00Z')});
  await page.goto('/');await expect(page.locator('#v2-home')).toContainText('主界面二版');await expect(page.locator('#v2-menu')).toBeVisible();await shot(page,info,'revision-default-menu');
  await expect(page.getByRole('link',{name:'继续旧版契约'})).toHaveAttribute('href','/legacy.html');
  await page.locator('#v2-seed').fill('revision-real-flow');await page.locator('#v2-new').click();await page.locator('#v2-starters button:first-child').click();await page.locator('#v2-requests button:first-child').click();
  await page.clock.pauseAt(new Date('2026-10-19T12:01:00Z'));
  for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
    await page.setViewportSize(size);await expect(page.locator('#v2-next-step')).toContainText('选剑身落点');
    for(const selector of['#v2-flow','#v2-node-0','#v2-node-9','#v2-strike','#v2-water','#v2-oil','#v2-deliver','#v2-scrap','#v2-settle','#v2-outcomes','#v2-price-preview'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
    expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1);
    const host=await page.locator('.forge-board').boundingBox();expect(host?.height).toBeGreaterThan(300);
    await shot(page,info,`revision-fresh-${size.width}`);
  }
  await page.setViewportSize({width:1280,height:720});
  // The mirror is presentation only: ArrowLeft moves physically left while keeping model tip/tang identity.
  const first=await page.locator('#v2-node-0').boundingBox();await page.keyboard.press('ArrowLeft');await expect(page.locator('#v2-node-1')).toHaveAttribute('aria-pressed','true');const next=await page.locator('#v2-node-1').boundingBox();expect(next!.x).toBeLessThan(first!.x);
  for(const node of[0,1,2]){await page.locator(`#v2-node-${node}`).click();await page.keyboard.down('Space');await page.clock.runFor(350);await page.keyboard.up('Space');}
  expect((await saved(page)).pieces[0]?.patterns).toContain('edge');await expect(page.locator('#v2-next-step')).toContainText('淬火');await shot(page,info,'revision-forged-1280');
  await page.locator('#v2-oil').click();await confirm(page);await expect(page.locator('#v2-flow [aria-current]')).toContainText('交货');await expect(page.locator('#v2-trial')).toBeEnabled();await shot(page,info,'revision-quenched-1280');
  const beforeTrial=await saved(page);await page.locator('#v2-trial').click();await expect(page.locator('#v2-dialog')).toBeVisible();await expect(page.locator('#v2-dialog-actions button')).toBeInViewport({ratio:.95});await shot(page,info,'revision-trial');await page.keyboard.press('Escape');expect(await saved(page)).toEqual(beforeTrial);
  await page.locator('#v2-deliver').click();await confirm(page);await expect(page.locator('#v2-next-step')).toContainText('另一件来料');
  const afterDelivery=await saved(page);await page.reload();await page.locator('#v2-continue').click();expect(await saved(page)).toEqual(afterDelivery);
  for(const n of[1,2]){await page.locator(`#v2-piece-${n}`).click();await page.locator('#v2-deliver').click();await confirm(page);}
  await expect(page.locator('#v2-next-step')).toContainText('收工');await page.locator('#v2-settle').click();await confirm(page);await expect(page.locator('.piece-receipts .sword-record')).toHaveCount(3);await shot(page,info,'revision-round-receipt');await info.attach('revision-real-state',{body:Buffer.from(JSON.stringify(await saved(page),null,2)),contentType:'application/json'});
  await page.goto('/legacy.html');await expect(page.locator('#menu')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v2'))).not.toBeNull();await shot(page,info,'revision-legacy-exit');
});
