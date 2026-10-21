import {test,expect} from '@playwright/test';
import {startGame} from './helpers.js';
import {saveV4} from './v4-helpers.js';
test('all four actual entries load and old saves remain byte-for-byte across new first-chapter start',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('/legacy.html');await expect(page.locator('#new-game')).toBeEnabled();await startGame(page,'old-entry-b');await expect(page.locator('#strike')).toBeEnabled();
 await page.goto('/v2.html');await expect(page.locator('#v2-new')).toBeEnabled();await page.locator('#v2-new').click();await page.locator('#v2-starters button').first().click();await page.getByRole('button',{name:'这轮只做市场',exact:true}).click();await expect(page.locator('#v2-strike')).toBeVisible();
 await page.goto('/v3.html?mode=3');await expect(page.locator('#v3-hit')).toBeEnabled();await page.locator('#v3-hit').click();await expect(page.locator('#v3-strike')).toHaveAttribute('aria-busy','false');const keys=['sword-led.save.v1','sword-led.save.v2','sword-led.save.v3'],before=await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),keys);expect(before.every(Boolean)).toBe(true);
 await page.goto('/v4.html');await expect(page.locator('#v4-start')).toBeEnabled();await expect(page.locator('#v4-continue')).toBeHidden();await page.locator('#v4-start').click();await page.getByRole('button',{name:'点火开炉',exact:true}).click();await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');expect(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),keys)).toEqual(before);await saveV4(page,'all-entry-compatibility');expect(errors).toEqual([]);
});
