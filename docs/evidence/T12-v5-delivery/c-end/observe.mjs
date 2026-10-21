import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const out='tmp/T12/c-end-first-visit',url='http://127.0.0.1:4179/';
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],frames=[];
page.on('pageerror',e=>errors.push(String(e)));
async function capture(label){await page.screenshot({path:`${out}/${label}.png`});frames.push({label,body:await page.locator('body').innerText(),state:await page.evaluate(()=>{const raw=localStorage.getItem('sword-led.save.v5');return raw?JSON.parse(raw).state:null;}),visible:await page.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{id:n.id,text:n.innerText,disabled:n.disabled,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};}))});await writeFile(`${out}/frames.json`,JSON.stringify(frames,null,2));}
try{
 await page.goto(url);await expect(page.locator('#v4-start')).toBeEnabled();await page.waitForLoadState('networkidle');await capture('01-title');
 await page.locator('#v4-start').click();await expect(page.locator('#v4-stage')).toHaveAttribute('data-scene','opening');await capture('02-opening');
 await page.locator('#v4-stage-actions').getByRole('button',{name:'点火开炉',exact:true}).click();await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await capture('03-first-forge');
 await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await capture('04-first-hit');
 await writeFile(`${out}/result.json`,JSON.stringify({ok:true,url,scope:'One own fresh isolated Chromium; title, opening, first forge and one real left click only; not a full playthrough. No user profile, source, build or old save touched.',domainCommands:2,frames:frames.length,errors},null,2));console.log(JSON.stringify({ok:true,out,errors}));
}finally{await context.close();await browser.close();}
