import {test,expect} from '@playwright/test';
import {startV4,commandV4,readV4,saveV4} from './v4-helpers.js';
test('holding Enter on a sale cannot sell the next sword without a fresh press',async({page})=>{
 await startV4(page);await commandV4(page,{type:'continue'});await page.locator('#v4-deliver').focus();await page.keyboard.down('Enter');const one=await readV4(page);expect(one.coins).toBe(40);expect(one.blades.filter(b=>b.status==='sold')).toHaveLength(1);await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');expect(await readV4(page)).toEqual(one);await page.keyboard.press('Enter');const two=await saveV4(page,'fresh-enter-sale');expect(two.coins).toBe(80);expect(two.blades.filter(b=>b.status==='sold')).toHaveLength(2);
});
