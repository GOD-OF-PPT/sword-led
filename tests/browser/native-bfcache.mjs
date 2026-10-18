import { launchNativeChrome } from '../support/native-chrome.mjs';

export async function verifyNativeBfcache(baseURL) {
  const native = await launchNativeChrome();
  const { request, evaluate, wait, attach } = native;
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
  } finally { await native.close(); }
}
