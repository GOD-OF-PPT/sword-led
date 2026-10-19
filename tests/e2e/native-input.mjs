import { launchNativeChrome } from '../support/native-chrome.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';

export async function verifyNativeInput(baseURL, screenshotPath) {
  const native = await launchNativeChrome();
  const { request, evaluate, wait, attach } = native;
  try {
    const version = await request('Browser.getVersion');
    const page = await attach(`${baseURL}/legacy.html`);
    const targetWindow = await request('Browser.getWindowForTarget', { targetId: page.targetId });
    await request('Browser.setWindowBounds', { windowId: targetWindow.windowId, bounds: { width: 1280, height: 900 } });
    await request('Page.bringToFront', {}, page.sessionId);
    await wait(page.sessionId, `Boolean(document.querySelector('#menu') && !document.querySelector('#menu').hidden && !document.querySelector('#new-game').disabled)`);
    await evaluate(page.sessionId, `(() => {
      window.nativeInputProbe = {events:[],errors:[],keyups:0};
      window.addEventListener('blur',()=>window.nativeInputProbe.events.push({type:'blur'}));
      document.addEventListener('visibilitychange',()=>window.nativeInputProbe.events.push({type:'visibility',hidden:document.hidden}));
      window.addEventListener('keyup',()=>window.nativeInputProbe.keyups++);
      window.addEventListener('error',event=>window.nativeInputProbe.errors.push(event.message));
      const old=console.error.bind(console);console.error=(...args)=>{window.nativeInputProbe.errors.push(args.map(String).join(' '));old(...args);};
      document.querySelector('#new-game').click();document.querySelector('#seed').value='native-window-input';
      document.querySelector('#new-run-form').requestSubmit();
      [...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='开始锻造').click();
    })()`);
    await wait(page.sessionId, `!document.querySelector('#dialog').open && document.querySelector('#app').dataset.phase==='workshop'`);
    const before = await evaluate(page.sessionId, `localStorage.getItem('sword-led.save.v1')`);
    await evaluate(page.sessionId, `document.querySelector('#strike').focus()`);
    const key = { code: 'Space', key: ' ', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 };
    await request('Input.dispatchKeyEvent', { type: 'keyDown', ...key }, page.sessionId);
    await wait(page.sessionId, `document.querySelector('#strike').classList.contains('preparing')`);
    await request('Browser.setWindowBounds', { windowId: targetWindow.windowId, bounds: { windowState: 'minimized' } });
    await wait(page.sessionId, `document.hidden && !document.querySelector('#strike').classList.contains('preparing')`);
    const hidden = await evaluate(page.sessionId, `({hidden:document.hidden,focused:document.hasFocus(),events:window.nativeInputProbe.events})`);
    await request('Browser.setWindowBounds', { windowId: targetWindow.windowId, bounds: { windowState: 'normal' } });
    await request('Page.bringToFront', {}, page.sessionId);
    await wait(page.sessionId, '!document.hidden && document.hasFocus()');
    await request('Input.dispatchKeyEvent', { type: 'keyUp', ...key }, page.sessionId);
    const afterCancel = await evaluate(page.sessionId, `({raw:localStorage.getItem('sword-led.save.v1'),keyups:window.nativeInputProbe.keyups,paused:document.querySelector('#dialog').open})`);
    if (afterCancel.raw !== before || afterCancel.keyups < 1 || !hidden.events.some(event => event.type === 'blur') || !hidden.hidden) {
      throw new Error('Native minimization or stale keyup changed the run');
    }
    await evaluate(page.sessionId, `(() => {
      const resume=[...document.querySelectorAll('#dialog button')].find(button=>button.textContent==='继续锻造');
      if(document.querySelector('#dialog').open && resume)resume.click();
      document.querySelector('#strike').focus();
    })()`);
    await request('Input.dispatchKeyEvent', { type: 'keyDown', ...key }, page.sessionId);await delay(350);
    await request('Input.dispatchKeyEvent', { type: 'keyUp', ...key }, page.sessionId);
    await wait(page.sessionId, `JSON.parse(localStorage.getItem('sword-led.save.v1')).state.revision===1`);await delay(500);
    const final = await evaluate(page.sessionId, `({state:JSON.parse(localStorage.getItem('sword-led.save.v1')).state,errors:window.nativeInputProbe.errors,viewport:{width:innerWidth,height:innerHeight}})`);
    if (final.state.stats.strikes !== 1 || final.state.rng.strike.draws !== 1 || final.errors.length) throw new Error(`Native input failed: ${JSON.stringify(final.errors)}`);
    const shot = await request('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, page.sessionId);
    await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
    return { browser: version.product, nativeMinimizedHidden: hidden.hidden, nativeBlurObserved: hidden.events.some(event => event.type === 'blur'),
      staleKeyupObserved: afterCancel.keyups, cancelledRawSaveUnchanged: afterCancel.raw === before,
      finalRevision: final.state.revision, finalStrikes: final.state.stats.strikes, finalStrikeDraws: final.state.rng.strike.draws,
      finalTimingMark: final.state.journal[0].timingMark, viewport: final.viewport, errors: final.errors };
  } finally { await native.close(); }
}
