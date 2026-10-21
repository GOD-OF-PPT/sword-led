import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {validateRun} from '../../src/core-v4/index.js';
import {awardsForTrustedRun} from '../../src/application/v4-collection.js';
import type {RunState} from '../../src/core-v4/index.js';

test('existing legal endings show complete factual art, visible actions and real collection pages at both PC sizes',async({browser},info)=>{
  const output=`${process.env.V4_EVIDENCE_ROOT??'tmp/T11-4-2-3i5/visual'}/${info.project.name}/ending-visual`;
  await mkdir(output,{recursive:true});
  for(const name of ['complete','return','defeat']as const){
    const raw:unknown=JSON.parse(readFileSync(`docs/evidence/T11-4-2-3i1/witness-fixed/${name}.json`,'utf8')),valid=validateRun(raw);if(!valid.ok)throw Error(valid.detail);const state:RunState=valid.state;
    const context=await browser.newContext({baseURL:info.project.use.baseURL??'http://127.0.0.1:4198',viewport:{width:1280,height:720}}),page=await context.newPage(),errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    try{
      await page.addInitScript(({state,awards})=>{
        if(sessionStorage.getItem('ending-visual-seeded'))return;
        const envelope=(schemaVersion:number,rulesVersion:string,value:unknown)=>JSON.stringify({schemaVersion,rulesVersion,savedAt:'2026-10-20T00:00:00.000Z',state:value});
        localStorage.setItem('sword-led.save.v4',envelope(4,'forge-v4',state));localStorage.setItem('sword-led.collection.v1',envelope(1,'forge-v4-collection-v1',awards));sessionStorage.setItem('ending-visual-seeded','yes');
      },{state,awards:awardsForTrustedRun(state)});
      await page.goto('/v4.html');await page.locator('#v4-continue').click();
      await expect(page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending',state.phase);
      const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));
      for(const width of [1280,1920]){
        await page.setViewportSize({width,height:width===1280?720:1080});await page.evaluate(()=>document.fonts.ready);
        const image=page.locator('#v4-stage-image'),file=name==='complete'?'ending-twelve-lights-v1.webp':name==='return'?'ending-homeward-v1.webp':'ending-embers-v1.webp';await expect(image).toHaveAttribute('src','/assets/d/v07-chapter3/'+file);await expect.poll(()=>image.evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0)).toBe(true);await expect(image).toHaveAttribute('src','/assets/d/v07-chapter3/'+file);await expect(image).toHaveCSS('object-fit','contain');
        const geometry=await page.locator('#v4-stage-actions button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{label:node.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,screenWidth:innerWidth,screenHeight:innerHeight};}));
        expect(geometry.length).toBeGreaterThanOrEqual(3);for(const r of geometry){expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.left).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(r.screenWidth);expect(r.top).toBeGreaterThanOrEqual(0);expect(r.bottom).toBeLessThanOrEqual(r.screenHeight);}
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:`${output}/${name}-${width}.png`});await writeFile(`${output}/${name}-${width}-geometry.json`,JSON.stringify(geometry,null,2)+'\n');
      }
      await page.locator('.v4-ending-listen').click();await expect(page.locator('.v4-ending-memories > h3')).toBeInViewport({ratio:0.95});
      const person=page.locator('.v4-ending-person[data-customer="courier"]');await person.locator('summary').click();await expect(person).toHaveAttribute('open','');
      if(name==='complete'){
        await page.locator('#v4-book').click();await expect(page.locator('#v4-dialog-body [data-record]')).toHaveCount(12);
        await page.locator('#v4-dialog-body [data-record="12"] button').click();await expect(page.locator('#v4-dialog')).toHaveAttribute('data-kind','collection-work');
        expect(await page.locator('#v4-dialog-body').evaluate(n=>n.scrollTop)).toBe(0);await expect(page.locator('.v4-work-page > h3').first()).toBeInViewport();
        await expect(page.locator('.v4-work-page')).toContainText('等级 12');await expect(page.locator('.v4-work-page')).toContainText('安全连锻 1次');await expect(page.locator('.v4-work-page canvas[data-blade]')).toHaveCount(1);
        await page.screenshot({path:`${output}/real-final-work.png`});await page.getByRole('button',{name:'回到炉谱',exact:true}).click();await page.getByRole('button',{name:'收好炉谱',exact:true}).click();await expect.poll(()=>page.evaluate(()=>{const active=document.activeElement;return active instanceof HTMLElement&&active.checkVisibility()&&!active.closest('[hidden]')&&active.id!=='v4-strike';})).toBe(true);
      }
      expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'))).toBe(bytes);expect(errors).toEqual([]);
      await writeFile(`${output}/${name}-state.json`,JSON.stringify(state,null,2)+'\n');
    }finally{await context.close();}
  }
});
