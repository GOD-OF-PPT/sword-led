import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// BFCache skips Playwright Page lifecycle events; use Chrome's raw pipe protocol for this one regression seam.
export async function verifyNativeBfcache(baseURL) {
  const profile = await mkdtemp(join(tmpdir(), 'sword-led-native-cache-'));
  const child = spawn(chromium.executablePath(), [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-extensions', '--no-proxy-server', '--use-mock-keychain', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const input = child.stdio[3]; const output = child.stdio[4];
  const pending = new Map(); let sequence = 0; let buffer = Buffer.alloc(0); let stderr = '';
  let finished = false;
  const exited = new Promise(resolve => {
    const done = () => { finished = true; resolve(); };
    child.once('exit', done); child.once('error', done);
  });
  const abort = error => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };
  child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-4096); });
  child.on('error', abort); child.once('exit', () => abort(new Error(`Chrome exited: ${stderr}`)));
  input.on('error', abort); output.on('error', abort);
  output.on('data', bytes => {
    buffer = Buffer.concat([buffer, bytes]);
    for (let end; (end = buffer.indexOf(0)) !== -1;) {
      const text = buffer.subarray(0, end).toString(); buffer = buffer.subarray(end + 1);
      if (!text) continue;
      const message = JSON.parse(text); const item = pending.get(message.id);
      if (!item) continue;
      pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    }
  });
  const request = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}; ${stderr}`)); }, 8000);
    timer.unref(); pending.set(id, { resolve, reject, timer });
    input.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
  const evaluate = async (sessionId, expression) => {
    const result = await request('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async (sessionId, expression) => {
    let lastError;
    for (const end = Date.now() + 10000; Date.now() < end;) {
      try { if (await evaluate(sessionId, expression)) return; } catch (error) { lastError = error; }
      await delay(40);
    }
    throw new Error(`Native condition did not settle: ${expression}; ${lastError ?? ''}`);
  };
  const attach = async url => {
    const { targetId } = await request('Target.createTarget', { url });
    const { sessionId } = await request('Target.attachToTarget', { targetId, flatten: true });
    return { targetId, sessionId };
  };
  try {
    const version = await request('Browser.getVersion');
    const a = await attach(`${baseURL}/tests/browser/fixture.html`);
    await wait(a.sessionId, 'Boolean(window.storageTest?.session.getSnapshot().active)');
    const initial = await evaluate(a.sessionId, `(() => {
      const session = window.storageTest.session;
      const started = session.startNewGame({runId:'native-cache-run',seed:'native-cache-seed'},
        {generation:session.getSnapshot().generation,confirmed:false});
      window.nativeCacheMarker = 'retained-native-cache-heap';
      return {started:started.ok, snapshot:session.getSnapshot()};
    })()`);
    if (!initial.started || initial.snapshot.mode !== 'writer') throw new Error('Native initial writer failed');
    await request('Page.navigate', { url: `${baseURL}/tests/browser/away.html` }, a.sessionId);
    await wait(a.sessionId, `location.pathname === '/tests/browser/away.html'`);
    const b = await attach(`${baseURL}/tests/browser/fixture.html`);
    await wait(b.sessionId, 'Boolean(window.storageTest?.session.getSnapshot().active)');
    const changed = await evaluate(b.sessionId, `(() => {
      const session=window.storageTest.session; const s=session.getSnapshot(); const state=s.state;
      if(s.mode!=='writer'||!state) throw new Error('Pagehide did not release writer');
      return session.dispatch({runId:state.runId,expectedRevision:state.revision,
        action:{type:'deliver',pieceId:'1:3'}},s.generation);
    })()`);
    if (!changed.ok || !changed.persistence?.ok) throw new Error('Native second-window save failed');
    const history = await request('Page.getNavigationHistory', {}, a.sessionId);
    const entry = history.entries.find(item => item.url === `${baseURL}/tests/browser/fixture.html`);
    if (!entry) throw new Error('Missing native history entry');
    await request('Page.navigateToHistoryEntry', { entryId: entry.id }, a.sessionId);
    await wait(a.sessionId, `location.pathname === '/tests/browser/fixture.html' && Boolean(window.storageTest?.session.getSnapshot().active)`);
    const restored = await evaluate(a.sessionId, `(() => ({
      native:window.storageTest.lastPageShowPersisted, marker:window.nativeCacheMarker,
      snapshot:window.storageTest.session.getSnapshot()
    }))()`);
    if (!restored.native || restored.marker !== 'retained-native-cache-heap') {
      throw new Error(`Native Chrome did not restore the heap: ${JSON.stringify({native:restored.native,marker:restored.marker})}`);
    }
    if (restored.snapshot.mode !== 'readonly' || JSON.stringify(restored.snapshot.state) !== JSON.stringify(changed.state)) {
      throw new Error('Native restored memory did not adopt the latest protected save');
    }
    await evaluate(b.sessionId, 'window.storageTest.session.suspend()');
    const resumed = await evaluate(a.sessionId, `(async () => {
      const session=window.storageTest.session; await session.activate();
      const stale=session.dispatch({},${initial.snapshot.generation});
      return {mode:session.getSnapshot().mode,state:session.getSnapshot().state,stale:stale.error};
    })()`);
    if (resumed.mode !== 'writer' || resumed.stale !== 'stale_session' || JSON.stringify(resumed.state) !== JSON.stringify(changed.state)) {
      throw new Error('Native handoff accepted an old generation or old progress');
    }
    return { browser: version.product, nativePersisted: restored.native, heapRetained: true,
      restoredMode: restored.snapshot.mode, latestRevision: restored.snapshot.state.revision,
      staleRejected: resumed.stale, resumedMode: resumed.mode };
  } finally {
    abort(new Error('Native probe closed'));
    if (!finished) child.kill('SIGTERM');
    await Promise.race([exited, delay(2000)]);
    if (!finished) { child.kill('SIGKILL'); await exited; }
    await rm(profile, { recursive: true, force: true });
  }
}
