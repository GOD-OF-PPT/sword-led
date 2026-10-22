import {test,expect} from '../e2e/fixtures.js';
import type {Page} from '@playwright/test';
import {keyToV5,v5Envelopes} from '../e2e/v5-helpers.js';
import {acceptedByV5,hitPointV5} from '../e2e/v5-interaction-helpers.js';
import {t03Driver,t03Export,t03Record,t03Slots,t03Step,t03Workshop} from './resilience-probe.js';

interface InputEventRow {
 type:string;at:number;trusted:boolean;target:string;focused:boolean;code:string|null;
 pointerId:number|null;button:number|null;detail:number|null;ctrl:boolean;alt:boolean;meta:boolean;
}
interface InputTailProbe {
 events:InputEventRow[];
 frames:{requestedAt:number;deliveredAt:number;stamp:number}[];
 storage:{at:number;key:string|null;newValue:string|null;trusted:boolean;focused:boolean}[];
 slow:boolean;
}
declare global {interface Window {t03InputTail:InputTailProbe}}

/** Event observation and an optional native RAF delivery gate. No domain result is replaced. */
async function installInputTailProbe(page:Page,slow=false){
 await page.addInitScript(slow=>{
  const probe:InputTailProbe={events:[],frames:[],storage:[],slow};window.t03InputTail=probe;
  for(const type of ['pointerdown','pointerup','pointercancel','click','dblclick','keydown','keyup','blur','focus'])window.addEventListener(type,event=>{
   const key=event instanceof KeyboardEvent?event:null,mouse=event instanceof MouseEvent?event:null,pointer=event instanceof PointerEvent?event:null;
   probe.events.push({type,at:performance.now(),trusted:event.isTrusted,target:event.target instanceof Element?event.target.id||event.target.tagName:'window',focused:document.hasFocus(),code:key?.code??null,pointerId:pointer?.pointerId??null,button:mouse?.button??null,detail:mouse?.detail??null,ctrl:key?.ctrlKey??mouse?.ctrlKey??false,alt:key?.altKey??mouse?.altKey??false,meta:key?.metaKey??mouse?.metaKey??false});
  },true);
  window.addEventListener('storage',event=>probe.storage.push({at:performance.now(),key:event.key,newValue:event.newValue,trusted:event.isTrusted,focused:document.hasFocus()}));
  if(!slow)return;
  const native=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window),pending=new Map<number,number>();let serial=0;
  window.requestAnimationFrame=callback=>{
   const id=++serial,requestedAt=performance.now();
   const step=(stamp:number)=>{if(!pending.has(id))return;const deliveredAt=performance.now();if(deliveredAt-requestedAt>=250){pending.delete(id);probe.frames.push({requestedAt,deliveredAt,stamp});callback.call(window,stamp);}else pending.set(id,native(step));};
   pending.set(id,native(step));return id;
  };
  window.cancelAnimationFrame=id=>{const handle=pending.get(id);if(handle!==undefined)cancel(handle);pending.delete(id);};
 },slow);
}
const snapshot=(page:Page)=>page.evaluate(()=>window.t03InputTail);

test.use({trace:'off',video:'off'});

test('v5 input tail: native aim and Control Alt Meta clicks never change a legal forge state',async({page},info)=>{
 await installInputTailProbe(page);const h=await t03Driver(page,info);await h.restoreLegitimate(t03Workshop());const before=await h.read(),raw=await t03Slots(page),box=await page.locator('#v4-hit').boundingBox();if(!box)throw Error('Missing actual forge hit surface');
 await page.mouse.move(box.x+box.width*.35,box.y+box.height*.55);await expect(page.locator('#v4-scene')).toHaveClass(/aiming/);const first=await page.locator('#v4-scene').evaluate(node=>(node as HTMLElement).style.getPropertyValue('--aim-x'));
 await page.mouse.move(box.x+box.width*.8,box.y+box.height*.6);const second=await page.locator('#v4-scene').evaluate(node=>(node as HTMLElement).style.getPropertyValue('--aim-x'));expect(second).not.toBe(first);expect((await h.read()).state).toEqual(before.state);expect(await t03Slots(page)).toEqual(raw);
 const point=await hitPointV5(page),modifiers=['Control','Alt','Meta'] as const,observations=[];
 for(const modifier of modifiers){
  const prior=await snapshot(page);await page.keyboard.down(modifier);
  try{await page.mouse.click(point.x,point.y,{button:'left'});}finally{await page.keyboard.up(modifier);}
  // macOS Control-click may show the browser's context menu. Dismiss that browser UI before
  // checking the independent next modifier; engines delivering Escape may show the real pause sheet.
  await page.keyboard.press('Escape');if(await page.locator('#v4-dialog').isVisible())await page.getByRole('button',{name:'继续锻造',exact:true}).click();
  const after=await snapshot(page),events=after.events.slice(prior.events.length);expect(events.some(row=>row.type==='pointerdown'&&row.trusted&&(modifier==='Control'?row.ctrl:modifier==='Alt'?row.alt:row.meta))).toBe(true);
  expect((await h.record('ignored-modifier-'+modifier)).state).toEqual(before.state);expect(await t03Slots(page)).toEqual(raw);observations.push({modifier,events});
 }
 const accepted=await h.command({type:'strike',pieceId:'d1-1'});expect(accepted).toEqual(t03Step(before.state,{type:'strike',pieceId:'d1-1'}).state);await t03Record(info,'aim-modifier-input',{scope:'Explicit legal restored first workshop. Native pointer aim and modified pointer input cause zero game commands; the following ordinary real left click accepts exactly one formal strike.',before:before.state,aim:{first,second},observations,accepted});await h.finish();
});

test('v5 input tail: native callbacks gated at250ms keep doubleclick and busy Space from queuing a later strike',async({page},info)=>{
 await installInputTailProbe(page,true);const h=await t03Driver(page,info);await h.restoreLegitimate(t03Workshop());const before=(await h.read()).state,point=await hitPointV5(page);const expected=t03Step(before,{type:'strike',pieceId:'d1-1'}).state;
 await acceptedByV5(h,{type:'strike',pieceId:'d1-1'},async()=>{
  await page.mouse.dblclick(point.x,point.y,{delay:5});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','true');
  await page.locator('#v4-strike').focus();await page.keyboard.down('Space');await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');await page.keyboard.up('Space');
 });
 const after=await h.record('busy-keyup-not-queued'),raw=await t03Slots(page);expect(after.state).toEqual(expected);await page.waitForTimeout(600);expect((await h.read()).state).toEqual(expected);expect(await t03Slots(page)).toEqual(raw);
 const measured=await snapshot(page);expect(measured.slow).toBe(true);expect(measured.events.filter(row=>row.type==='pointerdown'&&row.target==='v4-hit'&&row.trusted)).toHaveLength(2);expect(measured.events.some(row=>row.type==='dblclick'&&row.trusted)).toBe(true);expect(measured.events.some(row=>row.type==='keyup'&&row.code==='Space'&&row.trusted)).toBe(true);expect(measured.frames.length).toBeGreaterThanOrEqual(2);for(const frame of measured.frames)expect(frame.deliveredAt-frame.requestedAt).toBeGreaterThanOrEqual(250);
 await acceptedByV5(h,{type:'strike',pieceId:'d1-1'},async()=>{await page.locator('#v4-strike').focus();await page.keyboard.press('Space');await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');});
 await t03Record(info,'native-slow-input',{scope:'Actual native RAF is polled until each application callback has waited at least250ms. Real animations and formal command outcomes remain intact. This is a slow-delivery/input identity check, not physicalHz, two-paint geometry, CPU budget or GPU certification.',before,expected,after:after.state,measured,final:(await h.read()).state});await h.finish();
});

test('v5 input tail: pointer cancellation cannot swallow the next detail-zero accessibility activation',async({page},info)=>{
 await installInputTailProbe(page);const h=await t03Driver(page,info);await h.restoreLegitimate(t03Workshop());const before=(await h.read()).state,point=await hitPointV5(page);
 await acceptedByV5(h,{type:'strike',pieceId:'d1-1'},async()=>{await page.mouse.move(point.x,point.y);await page.mouse.down();});const accepted=(await h.read()).state;
 const down=(await snapshot(page)).events.filter(row=>row.type==='pointerdown'&&row.target==='v4-hit'&&row.trusted).at(-1);if(down?.pointerId===null||down?.pointerId===undefined)throw Error('Missing native pointer identity');
 // The native down accepted its result already. Only the cancellation/assistive activation wiring
 // is deliberately synthesized here; real owned-window blur/hidden belongs to native.spec.ts.
 await page.evaluate(pointerId=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId,pointerType:'mouse',button:0,buttons:0,isPrimary:true,bubbles:true})),down.pointerId);
 await page.mouse.move(2,2);await page.mouse.up();await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');expect((await h.read()).state).toEqual(accepted);const prior=await snapshot(page),expected=t03Step(accepted,{type:'strike',pieceId:'d1-1'}).state;expect(prior.events.some(row=>row.type==='pointercancel'&&row.pointerId===down.pointerId&&!row.trusted)).toBe(true);expect(prior.events.some(row=>row.type==='pointerup'&&row.pointerId===down.pointerId&&row.trusted)).toBe(true);
 try{
  await acceptedByV5(h,{type:'strike',pieceId:'d1-1'},async()=>{
   await page.locator('#v4-hit').evaluate((node:HTMLButtonElement)=>node.click());const delivered=(await snapshot(page)).events.slice(prior.events.length).filter(row=>row.type==='click'&&row.target==='v4-hit');expect(delivered).toHaveLength(1);expect(delivered[0]).toMatchObject({detail:0,trusted:false});
  });await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
 }finally{
  // Persist the real first red, including delivered detail0 and unchanged/wrong actual state.
  await t03Record(info,'pointer-cancel-accessibility',{scope:'Native trusted pointerdown followed by deliberate DOM PointerEvent(pointercancel), actual native release outside the surface, and HTMLButtonElement.click detail0. Explicit cancellation/assistive wiring, not a native OS-minimization result or a physical assistive-device claim.',before,accepted,expected,actual:(await h.read()).state,probe:await snapshot(page)});
 }
 expect((await h.record('detail-zero-independent-next-intent')).state).toEqual(expected);await h.finish();
});

test('v5 input tail: a background source change cancels held Space while the active page keeps focus',async({page,context},info)=>{
 await installInputTailProbe(page);const h=await t03Driver(page,info);await h.restoreLegitimate(t03Workshop());const before=(await h.read()).state,original=await t03Slots(page),external=t03Workshop(2),externalRaw=v5Envelopes(external).run;
 // Create the same-origin actor before holding a key. Its later evaluate never activates this page.
 const other=await context.newPage();
 try{
  await other.goto('/assets/b/manifest.json');await page.bringToFront();await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(true);await keyToV5(page,page.locator('#v4-strike'));await page.keyboard.down('Space');await expect(page.locator('#v4-hammer')).toHaveClass(/preparing/);
  const held=await snapshot(page),blurs=held.events.filter(row=>row.type==='blur'&&row.target==='window').length;expect(await page.evaluate(()=>document.hasFocus())).toBe(true);
  await other.evaluate(raw=>localStorage.setItem('sword-led.save.v5',raw),externalRaw);
  await expect.poll(async()=>(await snapshot(page)).storage.some(event=>event.key==='sword-led.save.v5'&&event.newValue===externalRaw&&event.trusted)).toBe(true);await expect(page.locator('#v4-save-summary')).toContainText('磁盘进度已更新');await expect(page.locator('#v4-hammer')).not.toHaveClass(/preparing/);
  const changed=await snapshot(page);expect(await page.evaluate(()=>document.hasFocus())).toBe(true);expect(changed.events.filter(row=>row.type==='blur'&&row.target==='window')).toHaveLength(blurs);const storage=changed.storage.filter(event=>event.key==='sword-led.save.v5'&&event.newValue===externalRaw);expect(storage.every(event=>event.trusted&&event.focused)).toBe(true);
  const ups=changed.events.filter(row=>row.type==='keyup'&&row.code==='Space').length;
  // Release before opening export/save dialogs: those UI actions must not mask a missing storage cancellation.
  await page.keyboard.up('Space');const released=await snapshot(page),keyups=released.events.filter(row=>row.type==='keyup'&&row.code==='Space');expect(keyups).toHaveLength(ups+1);expect(keyups.at(-1)?.trusted).toBe(true);expect(await page.evaluate(()=>document.hasFocus())).toBe(true);expect(released.events.filter(row=>row.type==='blur'&&row.target==='window')).toHaveLength(blurs);
  const expectedRaw={...original,'sword-led.save.v5':externalRaw};expect(await t03Slots(page)).toEqual(expectedRaw);const retained=await t03Export(page);expect(retained).toEqual(before);expect(await t03Slots(page)).toEqual(expectedRaw);
  await t03Record(info,'focused-external-source-held-key',{scope:'Explicit legal restored A and legal external source. B was created first and writes the public-codec source from the background; it does not accept a game command or take focus. Trusted storage event, no intervening window blur, real old Space keyup and exact disk/raw preservation precede actual export of retained A memory. Control blur caused by disabling the conflicted forge is recorded separately.',before,external,externalRaw,held,changed,released,retained,original,expectedRaw});await h.finish({freshUIJourneys:0,externalSourceMutation:true,staleSpaceCommands:0});
 }finally{await other.close();}
});
