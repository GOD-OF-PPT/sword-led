import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { launchNativeChrome } from '../support/native-chrome.mjs';

export async function verifyNativeUiCache(baseURL) {
  const server = createServer((_request,response) => { response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'});response.end('<!doctype html><title>Temporary navigation</title><p>Native browser navigation fixture</p>'); });
  server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();
  if(!address||typeof address==='string')throw new Error('No temporary navigation origin');
  let native;
  try {
    native=await launchNativeChrome();const {request,evaluate,wait,attach}=native;
    const version=await request('Browser.getVersion'),a=await attach(`${baseURL}/`);
    const window=await request('Browser.getWindowForTarget',{targetId:a.targetId});await request('Browser.setWindowBounds',{windowId:window.windowId,bounds:{width:1280,height:900}});
    await request('Page.bringToFront',{},a.sessionId);
    await wait(a.sessionId,`Boolean(document.querySelector('#menu')&&!document.querySelector('#menu').hidden&&!document.querySelector('#new-game').disabled)`);
    await evaluate(a.sessionId,`(() => {
      window.nativeUiCacheProbe={marker:'retained-game-ui-heap',persisted:false,trusted:false,keyups:0,errors:[]};
      window.addEventListener('pageshow',event=>{window.nativeUiCacheProbe.persisted=event.persisted;window.nativeUiCacheProbe.trusted=event.isTrusted;});
      window.addEventListener('keyup',()=>window.nativeUiCacheProbe.keyups++);
      window.addEventListener('error',event=>window.nativeUiCacheProbe.errors.push(event.message));
      window.addEventListener('unhandledrejection',event=>window.nativeUiCacheProbe.errors.push(String(event.reason)));
      const originalError=console.error.bind(console);console.error=(...args)=>{window.nativeUiCacheProbe.errors.push(args.map(String).join(' '));originalError(...args);};
      document.querySelector('#options').click();document.querySelector('#mute-setting').click();document.querySelector('#dialog-actions button').click();
      document.querySelector('#new-game').click();document.querySelector('#seed').value='native-ui-cache';document.querySelector('#new-run-form').requestSubmit();
      [...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='开始锻造').click();
    })()`);
    const key={code:'Space',key:' ',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32};
    await wait(a.sessionId,`!document.querySelector('#strike').disabled&&!document.querySelector('#dialog').open`);
    await evaluate(a.sessionId,`document.querySelector('#strike').focus()`);await request('Input.dispatchKeyEvent',{type:'keyDown',...key},a.sessionId);await delay(350);await request('Input.dispatchKeyEvent',{type:'keyUp',...key},a.sessionId);
    await wait(a.sessionId,`JSON.parse(localStorage.getItem('sword-led.save.v1')).state.revision===1&&!document.querySelector('#strike').disabled`);
    const before=await evaluate(a.sessionId,`JSON.parse(localStorage.getItem('sword-led.save.v1')).state`);
    await evaluate(a.sessionId,`document.querySelector('#strike').focus()`);await request('Input.dispatchKeyEvent',{type:'keyDown',...key},a.sessionId);
    await request('Page.navigate',{url:`http://127.0.0.1:${address.port}/away`},a.sessionId);await wait(a.sessionId,`location.pathname==='/away'`);
    const b=await attach(`${baseURL}/`);await request('Page.bringToFront',{},b.sessionId);
    await wait(b.sessionId,`Boolean(document.querySelector('#menu')&&!document.querySelector('#menu').hidden&&!document.querySelector('#new-game').disabled)`);
    await evaluate(b.sessionId,`(() => {document.querySelector('#continue').click();document.querySelector('#piece-3').click();document.querySelector('#deliver-button').click();[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='确认交货').click();})()`);
    await wait(b.sessionId,`JSON.parse(localStorage.getItem('sword-led.save.v1')).state.revision===2`);
    const changed=await evaluate(b.sessionId,`({raw:localStorage.getItem('sword-led.save.v1'),state:JSON.parse(localStorage.getItem('sword-led.save.v1')).state})`);
    const history=await request('Page.getNavigationHistory',{},a.sessionId),entry=history.entries.find(item=>item.url===`${baseURL}/`);if(!entry)throw new Error('No UI history entry');
    await request('Page.navigateToHistoryEntry',{entryId:entry.id},a.sessionId);await request('Page.bringToFront',{},a.sessionId);
    await wait(a.sessionId,`location.origin===${JSON.stringify(baseURL)}&&document.querySelector('#app')?.dataset.revision==='2'`);
    await request('Input.dispatchKeyEvent',{type:'keyUp',...key},a.sessionId);
    const restored=await evaluate(a.sessionId,`({probe:window.nativeUiCacheProbe,raw:localStorage.getItem('sword-led.save.v1'),state:JSON.parse(localStorage.getItem('sword-led.save.v1')).state,storage:document.querySelector('#storage-text').textContent})`);
    if(!restored.probe?.persisted||!restored.probe.trusted||restored.probe.marker!=='retained-game-ui-heap')throw new Error(`UI native BFCache did not retain heap: ${JSON.stringify(restored.probe)}`);
    if(restored.raw!==changed.raw||!restored.storage.includes('只可查看')||restored.probe.keyups<2)throw new Error('Restored UI used stale memory or accepted old keyup');
    await request('Target.closeTarget',{targetId:b.targetId});
    await evaluate(a.sessionId,`(() => {const resume=[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='继续锻造');if(document.querySelector('#dialog').open&&resume)resume.click();document.querySelector('#refresh-slot').click();})()`);
    await wait(a.sessionId,`document.querySelector('#dialog').open&&document.querySelector('#dialog-title').textContent==='稍歇片刻'`);
    await evaluate(a.sessionId,`(() => {[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='继续锻造').click();document.querySelector('#piece-1').click();document.querySelector('#strike').focus();})()`);
    await wait(a.sessionId,`!document.querySelector('#strike').disabled&&!document.querySelector('#dialog').open`);
    const inputReadiness=await evaluate(a.sessionId,`({activeBefore:document.activeElement.id,strikeEnabled:!document.querySelector('#strike').disabled})`);
    await request('Page.bringToFront',{},a.sessionId);await evaluate(a.sessionId,`document.querySelector('#strike').focus()`);
    await wait(a.sessionId,`document.hasFocus()&&document.activeElement===document.querySelector('#strike')`);
    inputReadiness.activeAfter=await evaluate(a.sessionId,`document.activeElement.id`);
    await request('Input.dispatchKeyEvent',{type:'keyDown',...key},a.sessionId);await delay(350);await request('Input.dispatchKeyEvent',{type:'keyUp',...key},a.sessionId);
    await wait(a.sessionId,`JSON.parse(localStorage.getItem('sword-led.save.v1')).state.revision===3`);
    const final=await evaluate(a.sessionId,`({state:JSON.parse(localStorage.getItem('sword-led.save.v1')).state,errors:window.nativeUiCacheProbe.errors})`),finalState=final.state;
    if(finalState.stats.strikes!==2||finalState.rng.strike.draws!==2||finalState.stats.deliveredPieces!==1||final.errors.length)throw new Error('UI BFCache handoff repeated or lost an action');
    return {browser:version.product,method:'raw native Chrome pipe, production DOM controls, muted preference; no Playwright Page lifecycle emulation',nativePersisted:restored.probe.persisted,pageShowTrusted:restored.probe.trusted,heapRetained:true,oldKeyupUnchanged:true,restoredStorage:restored.storage,inputReadiness,before,changed:changed.state,restored:restored.state,finalState,errors:final.errors};
  } finally {await native?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
