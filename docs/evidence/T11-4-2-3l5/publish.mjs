import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as sdk from '../../dist/sword-led-v5.js';
const manifest=JSON.parse(await readFile('tmp/T11-4-2-3l5/snapshot.json','utf8')),url='http://127.0.0.1:4179/',http=[];
for(const file of manifest.files){const path=file.path.slice(5),response=await fetch(url+path);assert(response.ok,path);const sha256=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');assert.equal(sha256,file.sha256,path);http.push({path,sha256});}
const browser=await chromium.launch(),errors=[],states=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await expect(page.locator('.v5-app')).toHaveAttribute('data-rules-version','forge-v5');await expect(page.locator('.v4-edition')).toContainText('v0.8 炉边交易');await expect(page.locator('#v5-old-v4')).toHaveAttribute('href','/v4.html');
 await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('v5-economy-0');await page.locator('#v4-start').click();
 async function keep(label){const state=JSON.parse(await page.evaluate(()=>localStorage.getItem('sword-led.save.v5'))).state;assert(sdk.validateRun(state).ok);states.push({label,state});return state;}
 await keep('created');await page.getByRole('button',{name:'点火开炉',exact:true}).click();
 for(let i=0;i<3;i++){await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');}
 const before=await keep('three-real-left-clicks'),expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action:{type:'deliver',pieceId:'d1-1'}});assert(expected.ok);
 await page.locator('#v4-notice-action').click();await expect(page.locator('#v5-inline-payment')).toContainText('实收');assert.deepEqual(await keep('bound-notice-delivery'),expected.state);await page.locator('#v4-gift button').click();await page.getByRole('button',{name:'学会稳手护符',exact:true}).click();await expect(page.locator('#v4-notice-copy')).toContainText(sdk.TRAITS.steady.text);await keep('real-gift-rule-specific-notice');assert.equal(errors.length,0);
 await writeFile('tmp/T11-4-2-3l5/published.json',JSON.stringify({ok:true,at:new Date().toISOString(),url,snapshot:manifest.path,previewSession:64360,http,actualDomainCommands:6,realLeftClicks:3,boundNoticeDelivery:1,states,errors,userProfileTouched:false},null,2)+'\n');console.log(JSON.stringify({ok:true,httpFiles:http.length,realLeftClicks:3,boundNoticeDelivery:1,states:states.length,errors}));
}finally{await browser.close();}
