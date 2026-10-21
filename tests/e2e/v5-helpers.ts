import {expect} from '@playwright/test';
import type {Locator,Page,TestInfo} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {Action,RunState} from '../../src/core-v5/index.js';
import type {CollectionState} from '../../src/application/v5-collection.js';

/** Runtime oracle is the frozen shipping SDK; source imports above provide types only. */
export const v5Sdk:typeof import('../../src/v5-sdk.js')=await import(pathToFileURL(resolve('dist/sword-led-v5.js')).href);
export const V5_GUIDE_PATH='docs/evidence/T11-4-2-3l1/journeys/victory.json';
const witness=JSON.parse(readFileSync(V5_GUIDE_PATH,'utf8')) as {state:RunState};
const checkedGuide=v5Sdk.validateRun(witness.state);
if(!checkedGuide.ok)throw Error('Published v5 guide no longer replays: '+checkedGuide.detail);
export const v5VictoryGuide:readonly Action[]=checkedGuide.state.journal;

interface V5Metrics {dpr:number;viewport:{width:number;height:number};focus:{id:string;tag:string}|null;canvas:{width:number;height:number;cssWidth:number;cssHeight:number;backingRatioX:number|null;backingRatioY:number|null;visible:boolean}|null}
export interface V5Observation {label:string;state:RunState;collection:CollectionState|null;raw:{save:string;collection:string|null};metrics:V5Metrics}
interface InputObservation {type:string;detail:number;pointerType:string;trusted:boolean}
interface ResourceObservation {url:string;resourceType:string;status?:number;error?:string;expectedNavigationCancellation:boolean}

/** Navigate the browser's real tab order. Evaluation observes focus/order and never changes it. */
export async function keyToV5(page:Page,target:Locator){
 await expect(target).toBeVisible();await expect(target).toBeEnabled();
 const visited:string[]=[];
 for(let i=0;i<180;i++){
  if(await target.evaluate(node=>node===document.activeElement))return;
  const backwards=await target.evaluate(node=>Boolean(document.activeElement&&(document.activeElement.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_PRECEDING)));
  visited.push(await page.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName||'none'));
  await page.keyboard.press(backwards?'Shift+Tab':'Tab');
 }
 throw Error(`Control not reachable by native Tab order: ${target}; visited ${visited.join(' > ')}`);
}
export async function keyActivateV5(page:Page,target:Locator){await keyToV5(page,target);await page.keyboard.press('Enter');}

export class KeyboardV5 {
 readonly observations:V5Observation[]=[];
 readonly accepted:{action:Action;runId:string;mode:RunState['mode'];day:number;revision:number;coinsBefore:number;coinsAfter:number;events:unknown}[]=[];
 readonly pointerEvents:InputObservation[]=[];
 readonly frames:{label:string;metrics:V5Metrics}[]=[];
 readonly resources:ResourceObservation[]=[];
 keyboardClicks=0;
 readonly pageErrors:string[]=[];
 readonly expectedDpr:number;
 readonly expectedOrigin:string;
 private navigating=false;
 constructor(readonly page:Page,readonly info:TestInfo,readonly inputMode:'keyboard'|'mouse'='keyboard'){this.expectedDpr=Number(info.project.use.deviceScaleFactor??1);this.expectedOrigin=new URL(String(info.project.use.baseURL??'http://127.0.0.1:4245')).origin;}
 async install(){
  await mkdir(this.info.outputPath(),{recursive:true});
  this.page.on('pageerror',error=>this.pageErrors.push(String(error)));
  this.page.on('response',response=>{if(new URL(response.url()).origin===this.expectedOrigin&&response.status()>=400)this.resources.push({url:response.url(),resourceType:response.request().resourceType(),status:response.status(),expectedNavigationCancellation:false});});
  this.page.on('requestfailed',request=>{if(new URL(request.url()).origin!==this.expectedOrigin)return;const error=request.failure()?.errorText??'unknown request failure';this.resources.push({url:request.url(),resourceType:request.resourceType(),error,expectedNavigationCancellation:this.navigating&&/ERR_ABORTED|NS_BINDING_ABORTED|AbortError|cancelled|canceled/i.test(error)});});
  await this.page.exposeBinding('__v5KeyboardObserve',(_source,event:InputObservation)=>{
   if(event.type==='click'&&event.detail===0&&event.pointerType==='')this.keyboardClicks++;
   else this.pointerEvents.push(event);
  });
  await this.page.addInitScript(()=>{
   const observe=(event:Event)=>{
    const mouse=event instanceof MouseEvent?event:null,pointer=event instanceof PointerEvent?event:null;
    const report=(window as unknown as {__v5KeyboardObserve:(value:unknown)=>Promise<void>}).__v5KeyboardObserve;
    void report({type:event.type,detail:mouse?.detail??0,pointerType:pointer?.pointerType??'',trusted:event.isTrusted});
   };
   for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','dblclick','contextmenu'])window.addEventListener(type,observe,true);
  });
 }
 async assertDpr(){expect(await this.page.evaluate(()=>window.devicePixelRatio)).toBe(this.expectedDpr);}
 async metrics():Promise<V5Metrics>{return this.page.evaluate(()=>{const node=document.querySelector<HTMLCanvasElement>('#v4-blade'),box=node?.getBoundingClientRect();return{dpr:window.devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},focus:document.activeElement?{id:document.activeElement.id,tag:document.activeElement.tagName}:null,canvas:node&&box?{width:node.width,height:node.height,cssWidth:box.width,cssHeight:box.height,backingRatioX:box.width>0?node.width/box.width:null,backingRatioY:box.height>0?node.height/box.height:null,visible:box.width>0&&box.height>0}:null};});}
 async reload(){this.navigating=true;try{await this.page.reload();}finally{this.navigating=false;}await this.assertDpr();}
 async read():Promise<V5Observation>{
  const raw=await this.page.evaluate(()=>({save:localStorage.getItem('sword-led.save.v5'),collection:localStorage.getItem('sword-led.collection.v2')}));
  if(!raw.save)throw Error('No actual v5 save');
  const save=v5Sdk.decodeV5Save(raw.save);if(save.status!=='valid')throw Error('Actual v5 save rejected: '+JSON.stringify(save));
  const checked=v5Sdk.validateRun(save.state);if(!checked.ok)throw Error(checked.detail);
  let collection:CollectionState|null=null;
  if(raw.collection){const decoded=v5Sdk.decodeCollection(raw.collection);if(decoded.status!=='valid')throw Error('Actual collection rejected: '+JSON.stringify(decoded));collection=decoded.state;}
  return{label:'',state:checked.state,collection,raw:{save:raw.save,collection:raw.collection},metrics:await this.metrics()};
 }
 async record(label:string){const observation=await this.read();observation.label=label;this.observations.push(observation);await writeFile(this.info.outputPath('v5-states.json'),JSON.stringify(this.observations,null,2));return observation;}
 async same(label:string,run:()=>Promise<void>){const before=await this.read();await run();expect((await this.read()).state,label).toEqual(before.state);}
 async activate(target:Locator){if(this.inputMode==='mouse')await target.click();else await keyActivateV5(this.page,target);}
 async confirm(){await this.activate(this.page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}));}
 async select(pieceId:string){const button=this.page.locator(`#v4-inventory button[data-piece="${pieceId}"]`);await expect(button).toBeVisible();if(await button.getAttribute('aria-pressed')!=='true')await this.activate(button);}
 async leaveIntro(){
  if(await this.page.locator('#v4-stage').isVisible()&&await this.page.locator('#v4-stage').getAttribute('data-scene')==='intro'){
   const before=(await this.read()).state,back=this.page.locator('#v4-stage-actions').getByRole('button',{name:'回到铁砧',exact:true});
   if(await back.isVisible())await this.activate(back);expect((await this.read()).state).toEqual(before);
  }
 }
 async start(seed='v5-economy-0'){
  await this.page.goto('/');await expect(this.page.locator('.v5-app')).toHaveAttribute('data-rules-version','forge-v5');await this.assertDpr();
  await expect(this.page.locator('#v4-start')).toBeEnabled();if(!await this.page.locator('.v4-journey-options').evaluate(node=>(node as HTMLDetailsElement).open))await this.activate(this.page.locator('.v4-journey-options summary'));
  if(this.inputMode==='mouse')await this.page.locator('#v4-seed').fill(seed);else{await keyToV5(this.page,this.page.locator('#v4-seed'));await this.page.keyboard.type(seed,{delay:1});}await expect(this.page.locator('#v4-seed')).toHaveValue(seed);
  await this.activate(this.page.locator('#v4-start'));const first=await this.record('fresh-real-keyboard-title');
  const expected=v5Sdk.createRun({runId:first.state.runId,seed,mode:'story',eligibility:{recipes:['light'],challenge:false}});if(!expected.ok)throw Error(expected.error);expect(first.state).toEqual(expected.state);return first.state;
 }
 async restoreLegitimate(source:RunState,collection?:CollectionState){
  const fixture=v5Envelopes(source,collection);
  // Leave the app and its writer lease before replacing an explicitly labelled recovery fixture.
  this.navigating=true;try{await this.page.goto('/assets/b/manifest.json');}finally{this.navigating=false;}
  await this.page.evaluate(raw=>{for(const key of ['sword-led.save.v5','sword-led.save.backup.v5','sword-led.collection.v2','sword-led.collection.backup.v2'])localStorage.removeItem(key);localStorage.setItem('sword-led.save.v5',raw.run);localStorage.setItem('sword-led.collection.v2',raw.collection);},fixture);
  this.navigating=true;try{await this.page.goto('/');}finally{this.navigating=false;}
  await this.assertDpr();await expect(this.page.locator('#v4-continue')).toBeEnabled();await this.activate(this.page.locator('#v4-continue'));
  const restored=await this.record('explicit-legitimate-restored-boundary');expect(restored.state).toEqual(source);await this.leaveIntro();return fixture;
 }
 async command(action:Action){
  await this.leaveIntro();const before=(await this.read()).state,result=v5Sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});
  if(!result.ok)throw Error(`Fixed keyboard command rejected: ${JSON.stringify(action)} / ${result.error}`);
  if('pieceId'in action&&action.type!=='chooseEvent'&&action.type!=='buy'&&action.pieceId!==before.reserveId)await this.select(action.pieceId);
  switch(action.type){
   case'continue':await this.activate(this.page.locator('#v4-stage-actions').getByRole('button',{name:'点火开炉',exact:true}));break;
   case'strike':await expect(this.page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');if(this.inputMode==='mouse')await this.page.locator('#v4-hit').click();else{await keyToV5(this.page,this.page.locator('#v4-strike'));await this.page.keyboard.press('Space');}await expect(this.page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');break;
   case'deliver':{const item=v5Sdk.getRunView(before).blades.find(item=>item.blade.id===action.pieceId)!;await expect(this.page.locator('#v4-deliver')).toContainText(item.quote.amount.toLocaleString('zh-CN'));await this.activate(this.page.locator('#v4-deliver'));break;}
   case'reserve':await this.activate(this.page.locator(before.reserveId===action.pieceId?'#v4-reserve-slot button':'#v4-reserve'));if(before.reserveId&&before.reserveId!==action.pieceId||before.day===12&&before.reserveId!==action.pieceId)await this.confirm();break;
   case'scrap':await this.activate(this.page.locator('#v4-scrap'));await this.confirm();break;
   case'settle':await this.activate(this.page.locator('#v4-settle'));await this.confirm();break;
   case'advance':await this.activate(this.page.locator('#v4-stage-actions').getByRole('button',{name:'沿灯路，去下一天',exact:true}));break;
   case'chooseModification':await this.activate(this.page.locator('#v4-stage-copy').getByRole('button',{name:'装上'+v5Sdk.MODIFICATIONS[action.modification].name,exact:true}));break;
   case'claimGift':await this.activate(this.page.locator('#v4-gift button'));if(action.traitId){await this.activate(this.page.getByRole('button',{name:'学会'+v5Sdk.TRAITS[action.traitId].name,exact:true}));if(action.replaceId){await this.activate(this.page.getByRole('button',{name:'换下'+v5Sdk.TRAITS[action.replaceId].name,exact:true}));await this.confirm();}}else await this.confirm();break;
   case'upgrade':case'repair':await this.activate(this.page.locator('#v4-shop'));await this.activate(this.page.locator(`[data-stall-good="${action.type}"]`));await this.activate(this.page.locator('.v5-stall-purchase'));await this.confirm();break;
   case'buy':await this.activate(this.page.locator('#v4-shop'));await this.activate(this.page.locator(`[data-stall-trait="${action.traitId}"]`));await this.activate(this.page.locator(`[data-stall-piece="${action.pieceId}"]`));await this.activate(this.page.locator('.v5-stall-purchase'));if(action.replaceId)await this.activate(this.page.getByRole('button',{name:'换下'+v5Sdk.TRAITS[action.replaceId].name,exact:true}));await this.confirm();break;
   case'chooseEvent':await this.activate(this.page.locator('#v4-event-open'));if(action.choice==='decline')await this.activate(this.page.getByRole('button',{name:'拒绝，保留眼前资源',exact:true}));else{await this.activate(action.pieceId?this.page.locator(`[data-event-piece="${action.pieceId}"] button`):this.page.locator('#v4-dialog-body').getByRole('button',{name:/^接受/}));await this.confirm();}break;
   case'setRecipe':await this.activate(this.page.locator(`#v4-recipes button[data-recipe="${action.recipe}"]`));break;
  }
  await expect.poll(async()=>(await this.read()).state.revision).toBe(result.state.revision);
  const actual=await this.record(`accepted-${this.accepted.length+1}-${action.type}`);expect(actual.state).toEqual(result.state);
  if(action.type==='deliver'){
   const quote=v5Sdk.deliveryQuote(before,before.blades.find(blade=>blade.id===action.pieceId)!);
   if(quote.matched){const amount=quote.amount.toLocaleString('zh-CN'),fee=quote.baseFeeDelta.toLocaleString('zh-CN'),bonus=quote.qualityBonus.toLocaleString('zh-CN');
    if(result.events.some(event=>event.type==='MainCompleted'))await expect(this.page.locator('#v5-inline-payment')).toHaveText(`实收 ${amount} 铜钱 · 酬劳${fee}＋品质${bonus}`);
    else await expect(this.page.locator('#v4-notice-copy')).toContainText(`这柄实收${amount}铜钱（酬劳${fee}＋品质${bonus}）`);
   }
  }
  this.accepted.push({action,runId:before.runId,mode:before.mode,day:before.day,revision:actual.state.revision,coinsBefore:before.coins,coinsAfter:actual.state.coins,events:result.events});
  await writeFile(this.info.outputPath('v5-commands.json'),JSON.stringify(this.accepted,null,2));return actual.state;
 }
 async shop(day:number){
  await this.same(`day${day} keyboard shop preview`,async()=>{
   await this.activate(this.page.locator('#v4-shop'));await expect(this.page.locator('.v5-market-stall')).toBeVisible();
   await this.activate(this.page.locator('[data-stall-good="upgrade"]'));await this.capture(`day-${day}-keyboard-merchant`);
   await this.activate(this.page.locator('#v4-dialog-actions').getByRole('button',{name:'回铁砧',exact:true}));
  });
 }
 async capture(label:string){
  await mkdir(this.info.outputPath(),{recursive:true});const before=(await this.read()).state;
  for(const viewport of[{width:1280,height:720},{width:1920,height:1080}]){await this.page.setViewportSize(viewport);await this.assertDpr();await this.page.screenshot({path:this.info.outputPath(`${label}-${viewport.width}.png`)});const metrics=await this.metrics();expect(await this.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);if(metrics.canvas?.visible){const ratio=Math.min(2,this.expectedDpr);expect(Math.abs((metrics.canvas.backingRatioX??0)-ratio)).toBeLessThan(.03);expect(Math.abs((metrics.canvas.backingRatioY??0)-ratio)).toBeLessThan(.03);}this.frames.push({label,metrics});await writeFile(this.info.outputPath('v5-keyboard-frames.json'),JSON.stringify(this.frames,null,2));}
  await this.page.setViewportSize(this.info.project.use.viewport??{width:1280,height:720});await this.assertDpr();expect((await this.read()).state).toEqual(before);
 }
 async finish(extra:Record<string,unknown>={}){await this.page.waitForLoadState('networkidle');expect(this.pageErrors).toEqual([]);if(this.inputMode==='keyboard'){expect(this.pointerEvents).toEqual([]);expect(this.keyboardClicks).toBeGreaterThan(0);}else expect(this.pointerEvents.length).toBeGreaterThan(0);expect(this.resources.filter(item=>!item.expectedNavigationCancellation)).toEqual([]);await this.assertDpr();const metrics=await this.metrics();await writeFile(this.info.outputPath('v5-keyboard-result.json'),JSON.stringify({ok:true,inputMode:this.inputMode,project:this.info.project.name,actualDpr:metrics.dpr,accepted:this.accepted.length,observations:this.observations.length,pointerEvents:this.pointerEvents,keyboardActivatedClicks:this.keyboardClicks,errors:this.pageErrors,unexpectedResourceErrors:this.resources.filter(item=>!item.expectedNavigationCancellation),navigationCancellations:this.resources.filter(item=>item.expectedNavigationCancellation),scope:'Actual browser UI commands with frozen formal SDK/raw equality. Tests separately label fresh full journeys and legitimate restored boundaries; driver reload/viewport/fixture setup are explicit.',...extra},null,2));}
}

/** Replay/codec-validated fixture for declared recovery boundaries, never a claimed fresh UI journey. */
export function v5Envelopes(source:RunState,collection?:CollectionState){
 const checked=v5Sdk.validateRun(source);if(!checked.ok)throw Error(checked.detail);
 const awards=v5Sdk.collectionFromRun(source);if(!awards.ok)throw Error(awards.detail);
 const book=collection??awards.state,valid=v5Sdk.validateCollection(book);if(!valid.ok)throw Error(valid.detail);
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 const now=()=> '2026-10-21T00:00:00.000Z';
 const run=v5Sdk.createV5SaveRepository(()=>storage,now),profile=v5Sdk.createCollectionRepository(()=>storage,now);run.load();profile.load();
 if(!run.write(checked.state).ok||!profile.write(book).ok)throw Error('Legitimate fixture codec failed');
 return{run:values.get('sword-led.save.v5')!,collection:values.get('sword-led.collection.v2')!};
}
