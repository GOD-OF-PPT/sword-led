import {webkit,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as sdk from '../../dist/sword-led-v5.js';
const base='tmp/goal4-T02',selection=JSON.parse(await readFile(base+'/visual-selection.json','utf8')),file=selection.screenshots.find(x=>x.id==='W1280').relativePath.replace(/[^/]+$/,'v5-states.json'),bytes=await readFile(file),observations=JSON.parse(bytes.toString('utf8')),source=observations.find(x=>x.label==='restored-twin-1-missed-summary');assert(source);assert(sdk.validateRun(source.state).ok);assert.equal(sdk.decodeV5Save(source.raw.save).status,'valid');
const browser=await webkit.launch();try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:2}),page=await context.newPage();await page.goto('http://127.0.0.1:4179/assets/b/manifest.json');await page.evaluate(raw=>{localStorage.setItem('sword-led.save.v5',raw.save);localStorage.setItem('sword-led.collection.v2',raw.collection);},source.raw);await page.goto('http://127.0.0.1:4179/');await page.locator('#v4-continue').click();await expect(page.locator('#v4-stage-title')).toHaveText('第二程，走完了');await expect(page.locator('.v4-equipped-modification')).toHaveCount(2);
 const pane=page.locator('#v4-stage-copy'),qualification=pane.getByText('炉谱已记下第二章。下次启程可自由使用重锋。',{exact:true});await expect(qualification).toBeVisible();
 const measure=()=>pane.evaluate(node=>({clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,scrollTop:node.scrollTop,overflow:getComputedStyle(node).overflowY,dpr:devicePixelRatio}));const before=await measure();assert(before.scrollHeight>before.clientHeight);assert.equal(before.overflow,'auto');const box=await pane.boundingBox();assert(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 const wheelFrames=[];
 for(let i=0;i<16;i++){
  const target=await qualification.evaluate(node=>{const r=node.getBoundingClientRect(),p=node.closest('#v4-stage-copy').getBoundingClientRect();return {top:r.top,bottom:r.bottom,paneTop:p.top,paneBottom:p.bottom,seen:r.top>=p.top&&r.bottom<=p.bottom};});const current=await measure();wheelFrames.push({target,current});if(target.seen)break;
  const delta=target.top<target.paneTop?-120:120;await page.mouse.wheel(0,delta);await expect.poll(async()=>(await measure()).scrollTop).not.toBe(current.scrollTop);
 }
 await writeFile(base+'/scroll-review-03-wheel-frames.json',JSON.stringify(wheelFrames,null,2)+'\n');
 await page.screenshot({path:base+'/webkit-1280-actual-wheel-growth-03.png'});
 await expect(qualification).toBeInViewport({ratio:1});await expect(page.locator('.v4-equipped-modification').last()).toBeInViewport({ratio:.5});const after=await measure();assert(after.scrollTop>before.scrollTop);await page.screenshot({path:base+'/webkit-1280-actual-wheel-growth-03.png'});const actual=await page.evaluate(()=>({run:JSON.parse(localStorage.getItem('sword-led.save.v5')).state,book:JSON.parse(localStorage.getItem('sword-led.collection.v2')).state}));assert.deepEqual(actual.run,source.state);assert.deepEqual(actual.book,source.collection);
 await writeFile(base+'/scroll-review-03.json',JSON.stringify({ok:true,scope:'New self-owned WebKit DPR2 context restored from an actual matrix observation, mouse wheel in1280x720 chapter summary. No new complete journey, no user profile access, no economic command.',source:{path:file,sha256:createHash('sha256').update(bytes).digest('hex'),label:source.label},before,after,growthCards:2,qualificationVisibleAfterRealWheel:true,economicStateUnchanged:true,screenshot:base+'/webkit-1280-actual-wheel-growth-03.png'},null,2)+'\n');console.log(JSON.stringify({ok:true,before,after,qualificationVisibleAfterRealWheel:true,economicStateUnchanged:true}));
}finally{await browser.close();}
