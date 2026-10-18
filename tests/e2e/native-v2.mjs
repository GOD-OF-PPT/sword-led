import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {launchNativeChrome} from '../support/native-chrome.mjs';

const KEY={code:'Space',key:' ',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32};
const SAVE='sword-led.save.v2';
const raw=`localStorage.getItem('${SAVE}')`;
const state=`JSON.parse(${raw}).state`;
async function boot(n,baseURL){
  const page=await n.attach(`${baseURL}/v2.html`);await n.request('Page.bringToFront',{},page.sessionId);
  await n.wait(page.sessionId,`Boolean(document.querySelector('#v2-new')&&!document.querySelector('#v2-new').disabled)`);
  await n.evaluate(page.sessionId,`(() => {
    window.nativeV2Probe={marker:'retained-v2-consumer',persisted:false,trusted:false,keyups:0,events:[],errors:[]};
    window.addEventListener('pageshow',e=>{nativeV2Probe.persisted=e.persisted;nativeV2Probe.trusted=e.isTrusted;});
    window.addEventListener('blur',()=>nativeV2Probe.events.push({type:'blur'}));
    document.addEventListener('visibilitychange',()=>nativeV2Probe.events.push({type:'visibility',hidden:document.hidden}));
    window.addEventListener('keyup',()=>nativeV2Probe.keyups++);
    window.addEventListener('error',e=>nativeV2Probe.errors.push(e.message));
    window.addEventListener('unhandledrejection',e=>nativeV2Probe.errors.push(String(e.reason)));
    const old=console.error.bind(console);console.error=(...args)=>{nativeV2Probe.errors.push(args.map(String).join(' '));old(...args);};
    document.querySelector('#v2-settings summary').click();document.querySelector('#v2-muted').click();document.querySelector('#v2-settings summary').click();
    document.querySelector('#v2-new').click();document.querySelector('#v2-starters button:first-child').click();document.querySelector('#v2-decline').click();
  })()`);
  await n.wait(page.sessionId,`!document.querySelector('#v2-strike').disabled&&${state}.revision===2`);return page;
}
async function strike(n,sid,node=0){
  await n.evaluate(sid,`document.querySelector('#v2-node-${node}').click()`);
  await n.wait(sid,`document.hasFocus()&&document.activeElement===document.querySelector('#v2-strike')`);
  await n.request('Input.dispatchKeyEvent',{type:'keyDown',...KEY},sid);await delay(350);await n.request('Input.dispatchKeyEvent',{type:'keyUp',...KEY},sid);
}
export async function verifyNativeV2Minimize(baseURL,screenshotPath){
  const n=await launchNativeChrome();
  try{
    const version=await n.request('Browser.getVersion'),a=await boot(n,baseURL),win=await n.request('Browser.getWindowForTarget',{targetId:a.targetId});
    await n.request('Browser.setWindowBounds',{windowId:win.windowId,bounds:{width:1280,height:900}});
    const before=await n.evaluate(a.sessionId,`({raw:${raw},state:${state}})`);
    await n.evaluate(a.sessionId,`document.querySelector('#v2-strike').focus()`);await n.request('Input.dispatchKeyEvent',{type:'keyDown',...KEY},a.sessionId);
    await n.wait(a.sessionId,`document.querySelector('#v2-hammer-anchor').classList.contains('preparing')`);
    await n.request('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'minimized'}});
    await n.wait(a.sessionId,`document.hidden&&!document.querySelector('#v2-hammer-anchor').classList.contains('preparing')`);
    const hidden=await n.evaluate(a.sessionId,`({hidden:document.hidden,events:nativeV2Probe.events})`);
    await n.request('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});await n.request('Page.bringToFront',{},a.sessionId);
    await n.wait(a.sessionId,'!document.hidden&&document.hasFocus()');await n.request('Input.dispatchKeyEvent',{type:'keyUp',...KEY},a.sessionId);
    const cancelled=await n.evaluate(a.sessionId,`({raw:${raw},keyups:nativeV2Probe.keyups,paused:!document.querySelector('#v2-paused').hidden})`);
    if(cancelled.raw!==before.raw||!cancelled.paused||!hidden.hidden||!hidden.events.some(e=>e.type==='blur')||cancelled.keyups<1)throw Error('Native v2 cancellation failed');
    await n.evaluate(a.sessionId,`document.querySelector('#v2-resume').click()`);await strike(n,a.sessionId);
    await n.wait(a.sessionId,`${state}.revision===3`);const final=await n.evaluate(a.sessionId,`({state:${state},errors:nativeV2Probe.errors,viewport:{width:innerWidth,height:innerHeight}})`);
    const shot=await n.request('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},a.sessionId);await writeFile(screenshotPath,Buffer.from(shot.data,'base64'));
    return{browser:version.product,method:'raw native Chrome pipe and actual v2 controls; real window minimization, no Playwright lifecycle events',nativeMinimizedHidden:hidden.hidden,nativeBlurObserved:hidden.events.some(e=>e.type==='blur'),oldKeyupUnchanged:cancelled.raw===before.raw,staleKeyups:cancelled.keyups,before:before.state,finalState:final.state,viewport:final.viewport,errors:final.errors};
  }finally{await n.close();}
}
export async function verifyNativeV2Cache(baseURL){
  const away=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'public, max-age=60'});res.end('<!doctype html><title>Away</title><p>Native navigation</p>');});away.listen(0,'127.0.0.1');await once(away,'listening');const address=away.address();if(!address||typeof address==='string')throw Error('No away origin');let n;
  try{
    n=await launchNativeChrome();const version=await n.request('Browser.getVersion'),a=await boot(n,baseURL);await strike(n,a.sessionId);
    await n.wait(a.sessionId,`${state}.revision===3`);const before=await n.evaluate(a.sessionId,state);
    await n.evaluate(a.sessionId,`document.querySelector('#v2-strike').focus()`);await n.request('Input.dispatchKeyEvent',{type:'keyDown',...KEY},a.sessionId);
    await n.wait(a.sessionId,`document.querySelector('#v2-hammer-anchor').classList.contains('preparing')`);
    await n.request('Page.navigate',{url:`http://127.0.0.1:${address.port}/away`},a.sessionId);await n.wait(a.sessionId,`location.pathname==='/away'`);
    const b=await n.attach(`${baseURL}/v2.html`);await n.request('Page.bringToFront',{},b.sessionId);await n.wait(b.sessionId,`Boolean(document.querySelector('#v2-new')&&!document.querySelector('#v2-new').disabled)`);
    await n.evaluate(b.sessionId,`(() => {document.querySelector('#v2-continue').click();document.querySelector('#v2-piece-2').click();document.querySelector('#v2-deliver').click();document.querySelector('#v2-dialog-actions button:last-child').click();})()`);
    await n.wait(b.sessionId,`${state}.revision===4`);const changed=await n.evaluate(b.sessionId,`({raw:${raw},state:${state}})`);
    const history=await n.request('Page.getNavigationHistory',{},a.sessionId),entry=history.entries.find(e=>e.url===`${baseURL}/v2.html`);if(!entry)throw Error('No v2 navigation history');
    await n.request('Page.navigateToHistoryEntry',{entryId:entry.id},a.sessionId);await n.request('Page.bringToFront',{},a.sessionId);
    await n.wait(a.sessionId,`location.origin===${JSON.stringify(baseURL)}&&document.querySelector('#v2-save-state')?.textContent.includes('只读')`);
    await n.request('Input.dispatchKeyEvent',{type:'keyUp',...KEY},a.sessionId);
    const restored=await n.evaluate(a.sessionId,`({probe:nativeV2Probe,raw:${raw},state:${state},notice:document.querySelector('#v2-save-state').textContent,wallet:document.querySelector('#v2-wallet').textContent})`);
    if(!restored.probe.persisted||!restored.probe.trusted||restored.probe.marker!=='retained-v2-consumer'||restored.raw!==changed.raw||restored.probe.keyups<2)throw Error('Native v2 heap or old keyup proof failed');
    if(!restored.wallet.includes('金币 22'))throw Error('Restored v2 consumer did not display latest wallet');
    await n.request('Target.closeTarget',{targetId:b.targetId});
    await n.evaluate(a.sessionId,`(() => {if(!document.querySelector('#v2-paused').hidden)document.querySelector('#v2-resume').click();document.querySelector('#v2-reread').click();document.querySelector('#v2-dialog-actions button:last-child').click();})()`);
    await n.wait(a.sessionId,`!document.querySelector('#v2-new').disabled&&!document.querySelector('#v2-strike').disabled&&!document.querySelector('#v2-dialog').open`);
    await strike(n,a.sessionId,1);await n.wait(a.sessionId,`${state}.revision===5`);const final=await n.evaluate(a.sessionId,`({state:${state},errors:nativeV2Probe.errors})`);
    return{browser:version.product,method:'raw native Chrome pipe; actual v2 DOM/lease/save handoff, trusted persisted pageshow and retained heap',nativePersisted:restored.probe.persisted,pageShowTrusted:restored.probe.trusted,heapRetained:true,oldKeyupUnchanged:restored.raw===changed.raw,restoredNotice:restored.notice,before,changed:changed.state,restored:restored.state,finalState:final.state,errors:final.errors};
  }finally{await n?.close();away.closeAllConnections();await new Promise(resolve=>away.close(resolve));}
}
