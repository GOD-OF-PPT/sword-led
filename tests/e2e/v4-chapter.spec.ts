import {expect,test} from '@playwright/test';
import {readV4,startV4,commandV4,chapterActions,exitDelivery,saveV4,shotV4,activateV4} from './v4-helpers.js';
import type {Page} from '@playwright/test';
import {validateCollection} from '../../src/application/v4-collection.js';

const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('response',r=>{if(r.status()>=400)list.push(`${r.status()} ${r.url()}`);});});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});
async function bounds(page:Page,ids:string[]){const size=page.viewportSize()!;expect(await page.evaluate(()=>document.body.scrollWidth)).toBe(size.width);for(const id of ids){const loc=page.locator('#'+id);const b=await loc.boundingBox();expect(b,id).not.toBeNull();expect(b!.x,id).toBeGreaterThanOrEqual(0);expect(b!.y,id).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width,id).toBeLessThanOrEqual(size.width);expect(b!.y+b!.height,id).toBeLessThanOrEqual(size.height);if(await loc.evaluate(e=>e.tagName==='BUTTON')){expect(b!.height,id).toBeGreaterThanOrEqual(44);expect(b!.width,id).toBeGreaterThanOrEqual(44);const top=await loc.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit);});expect(top,id+' occlusion').toBe(true);}}}


async function propProportions(page:Page){
 const ratios=await page.locator('#v4-stage canvas[data-prop]').evaluateAll(async nodes=>{
  const image=new Image();image.src='/assets/d/v07/modifications-v1.webp';await image.decode();const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;const ctx=source.getContext('2d')!;ctx.drawImage(image,0,0);
  const ratio=(data:Uint8ClampedArray,w:number,h:number)=>{let minX=w,minY=h,maxX=0,maxY=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]!>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return(maxX-minX+1)/(maxY-minY+1);};
  return nodes.map(n=>{const c=n as HTMLCanvasElement,index=['windbox','warmRack','wideMouth'].indexOf(c.dataset.prop!),w=image.naturalWidth/3,h=image.naturalHeight,expected=ratio(ctx.getImageData(index*w,0,w,h).data,w,h),actual=ratio(c.getContext('2d')!.getImageData(0,0,c.width,c.height).data,c.width,c.height);return{id:c.dataset.prop,expected,actual,error:Math.abs(actual/expected-1)};});
 });for(const r of ratios)expect(r.error,JSON.stringify(r)).toBeLessThan(.07);
}

test('real first chapter connects four commissions, shop, event, bridge, modification, saved collection and a fresh journey',async({page},info)=>{
 await startV4(page);let final=await readV4(page);
 for(const action of chapterActions){final=await commandV4(page,action);
  if(action.type==='advance'||action.type==='continue'){await exitDelivery(page);await bounds(page,['v4-goal-name','v4-coins','v4-value','v4-risk','v4-strike','v4-deliver','v4-settle','v4-reserve']);await saveV4(page,`day-${final.day}-start`);}
  if(action.type==='strike'&&final.day===3&&final.blades.find(b=>b.id===action.pieceId)?.bursts){await expect(page.locator('#v4-traits [data-trait=ember]')).toHaveAttribute('data-triggered','true');}
  if(action.type==='buy'){await expect(page.locator('#v4-traits [data-trait=ember] .v3-trait-art')).toBeVisible();await shotV4(page,'first-chapter-traits');}
  if(action.type==='settle'&&final.day===3){await expect(page.locator('#v4-stage-copy')).toContainText('护送捐剑 · 已接受');await shotV4(page,'event-receipt');}
  if(action.type==='deliver'&&final.day===4&&final.blades.find(b=>b.id===action.pieceId)?.commissionId===4){await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07/bridge-lit-v1.webp');await shotV4(page,'bridge-delivery');}
  if(action.type==='settle'&&final.day===4){await expect(page.locator('#v4-stage-title')).toHaveText('渡口重新亮了');await propProportions(page);for(const size of [{width:1280,height:720},{width:1920,height:1080}]){await page.setViewportSize(size);await shotV4(page,`chapter-choice-${size.width}`);await bounds(page,['v4-stage-title','v4-stage-actions']);}}
 }
 expect(final.day).toBe(4);expect(final.phase).toBe('summary');expect(final.history.every(h=>h.met)).toBe(true);expect(final.modifications).toEqual(['windbox']);await propProportions(page);await expect(page.locator('#v4-stage-title')).toHaveText('第一程，走完了');await expect(page.locator('#v4-stage-copy')).toContainText('当前可玩内容到第一章');await expect(page.getByRole('button',{name:'沿灯路，去下一天',exact:true})).toHaveCount(0);await saveV4(page,'chapter-complete');
 const raw=await page.evaluate(()=>localStorage.getItem('sword-led.collection.v1'));expect(raw).not.toBeNull();const collected=validateCollection(JSON.parse(raw!).state);expect(collected.ok).toBe(true);if(!collected.ok)throw Error(collected.detail);expect(collected.state.chapters).toEqual([1]);expect(collected.state.works).toHaveLength(4);
 const bytes=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));await page.reload();await expect(page.locator('#v4-continue')).toBeEnabled();await page.locator('#v4-continue').click();expect(await readV4(page)).toEqual(final);await expect(page.locator('#v4-stage-title')).toHaveText('第一程，走完了');expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'))).toBe(bytes);
 await page.getByRole('button',{name:'翻开炉谱',exact:true}).click();await expect(page.locator('#v4-dialog-body [data-record] canvas')).toHaveCount(4);await expect(page.locator('#v4-dialog-body')).toContainText('护刃：可自由使用');await shotV4(page,'collection-real');await page.getByRole('button',{name:'收好炉谱'}).click();
 await page.getByRole('button',{name:'带着炉谱，再启一程'}).click();await page.locator('#v4-start').click();await page.getByRole('button',{name:'再想想',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'))).toBe(bytes);await page.locator('#v4-start').click();await page.getByRole('button',{name:'确认',exact:true}).click();const fresh=await readV4(page);expect(fresh.initialEligibility.recipes).toEqual(['light','guard']);expect(fresh.coins).toBe(0);expect(fresh.runId).not.toBe(final.runId);await saveV4(page,'fresh-earned-eligibility');await info.attach('actual-chapter',{body:JSON.stringify({final,collected:collected.state,fresh},null,2),contentType:'application/json'});
});

test('keyboard-only first chapter and distinct real failure retain honest outcomes',async({page})=>{
 await page.addInitScript(()=>window.addEventListener('pointerdown',()=>{document.documentElement.dataset.v4Pointers=String(Number(document.documentElement.dataset.v4Pointers??0)+1);}));await startV4(page,'lantern-witness-0',true);
 for(const action of chapterActions)await commandV4(page,action,true);
 expect(Number(await page.locator('html').getAttribute('data-v4-pointers'))).toBe(0);await saveV4(page,'keyboard-chapter');
 await activateV4(page,page.getByRole('button',{name:'带着炉谱，再启一程'}),true);await activateV4(page,page.locator('#v4-start'),true);await activateV4(page,page.getByRole('button',{name:'确认',exact:true}),true);await commandV4(page,{type:'continue'},true);
 for(let day=1;day<=3;day++){await commandV4(page,{type:'settle'},true);if(day<3)await commandV4(page,{type:'advance'},true);}const s=await saveV4(page,'keyboard-defeat');expect(s.phase).toBe('defeat');expect(s.seals).toBe(0);await expect(page.locator('#v4-stage-title')).toHaveText('炉火暂熄');expect(Number(await page.locator('html').getAttribute('data-v4-pointers'))).toBe(0);await shotV4(page,'real-defeat');
});

test('unfulfilled bridge is dark; missed chapter retains growth, and recipe and reserve choices have real consequences',async({page})=>{
 await startV4(page);for(const action of chapterActions){if(action.type==='advance'&&(await readV4(page)).day===3)break;await commandV4(page,action);}await commandV4(page,{type:'advance'});let s=await readV4(page);expect(s.blades.find(b=>b.id==='d4-1')!.recipe).toBe('guard');
 await commandV4(page,{type:'setRecipe',pieceId:'d4-1',recipe:'light'});await commandV4(page,{type:'strike',pieceId:'d4-1'});await expect(page.locator('#v4-recipes button')).toHaveCount(0);await commandV4(page,{type:'reserve',pieceId:'d4-1'});await commandV4(page,{type:'scrap',pieceId:'d4-2'});await commandV4(page,{type:'settle'});await expect(page.locator('#v4-stage-image')).toHaveAttribute('src','/assets/d/v07/bridge-dark-v1.webp');await expect(page.locator('#v4-stage-title')).toContainText('仍有缺口');await shotV4(page,'bridge-unfulfilled');await commandV4(page,{type:'chooseModification',modification:'warmRack'});s=await saveV4(page,'bridge-missed-growth');expect(s.history.at(-1)!.met).toBe(false);expect(s.reserveId).toBe('d4-1');expect(s.modifications).toEqual(['warmRack']);await expect(page.locator('#v4-stage-copy')).toContainText('渡口的遗憾');
});
