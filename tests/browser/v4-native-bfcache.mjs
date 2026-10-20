import {launchNativeChrome} from '../support/native-chrome.mjs';
import {isDeepStrictEqual} from 'node:util';

export async function verifyNativeV4Bfcache(baseURL,input) {
 const native=await launchNativeChrome(),{request,evaluate,wait,attach}=native;
 const boot=`(async()=>{await window.storageTest.session.dispose();const path='/dist/sword-led-v4.js',sdk=await import(path);const session=sdk.createV4BrowserSession(window);window.v4Test={sdk,session};await session.activate();return session.getSnapshot();})()`;
 const dispatch=list=>`(()=>{const session=window.v4Test.session;for(const action of ${JSON.stringify(list)}){const snap=session.getSnapshot(),state=snap.state;const r=session.dispatch({runId:state.runId,expectedRevision:state.revision,action},snap.generation);if(!r.ok||!r.persistence?.ok)throw Error('Native v4 dispatch/save failed');}return session.getSnapshot();})()`;
 try{
  const version=await request('Browser.getVersion'),a=await attach(`${baseURL}/tests/browser/fixture.html`);
  await wait(a.sessionId,'Boolean(window.storageTest?.session.getSnapshot().active)');await evaluate(a.sessionId,boot);
  const started=await evaluate(a.sessionId,`(()=>{const s=window.v4Test.session;window.v4NativeMarker='retained-v4-heap';return s.startNewGame(${JSON.stringify({runId:input.runId,seed:input.seed})},{generation:s.getSnapshot().generation,confirmed:false});})()`);
  if(!started.ok)throw Error('Native v4 initial start failed');
  const initial=await evaluate(a.sessionId,dispatch(input.first));
  await request('Page.navigate',{url:`${baseURL}/tests/browser/away.html`},a.sessionId);await wait(a.sessionId,"location.pathname==='/tests/browser/away.html'");
  const b=await attach(`${baseURL}/tests/browser/fixture.html`);await wait(b.sessionId,'Boolean(window.storageTest?.session.getSnapshot().active)');
  const second=await evaluate(b.sessionId,boot);if(second.mode!=='writer')throw Error('Native v4 pagehide did not release shared writer');
  const changed=await evaluate(b.sessionId,dispatch(input.following));
  const changedCollection=await evaluate(b.sessionId,'window.v4Test.session.getCollectionSnapshot()');
  const history=await request('Page.getNavigationHistory',{},a.sessionId),entry=history.entries.find(e=>e.url===`${baseURL}/tests/browser/fixture.html`);if(!entry)throw Error('Missing native v4 history entry');
  await request('Page.navigateToHistoryEntry',{entryId:entry.id},a.sessionId);
  await wait(a.sessionId,"location.pathname==='/tests/browser/fixture.html'&&Boolean(window.v4Test?.session.getSnapshot().active)");
  const restored=await evaluate(a.sessionId,'({persisted:window.storageTest.lastPageShowPersisted,marker:window.v4NativeMarker,snapshot:window.v4Test.session.getSnapshot(),collection:window.v4Test.session.getCollectionSnapshot()})');
  if(!restored.persisted||restored.marker!=='retained-v4-heap'||restored.snapshot.mode!=='readonly')throw Error('Native v4 cache did not restore its actual heap as readonly');
  const equality={rawJSONState:JSON.stringify(restored.snapshot.state)===JSON.stringify(changed.state),rawJSONCollection:JSON.stringify(restored.collection.data)===JSON.stringify(changedCollection.data),state:isDeepStrictEqual(restored.snapshot.state,changed.state),collection:isDeepStrictEqual(restored.collection.data,changedCollection.data)};
  if(!equality.state||!equality.collection)throw Error(`Native v4 cache retained stale run/collection: ${JSON.stringify(equality)}`);
  await evaluate(b.sessionId,'window.v4Test.session.suspend()');
  const resumed=await evaluate(a.sessionId,`(async()=>{const s=window.v4Test.session;await s.activate();return{mode:s.getSnapshot().mode,state:s.getSnapshot().state,stale:s.dispatch({},${initial.generation}).error,collection:s.getCollectionSnapshot()};})()`);
  if(resumed.mode!=='writer'||resumed.stale!=='stale_session')throw Error('Native v4 lease/stale input protection failed');
  return {browser:version.product,nativePersisted:restored.persisted,heapRetained:true,restoredMode:restored.snapshot.mode,resumedMode:resumed.mode,staleRejected:resumed.stale,states:[initial.state,changed.state,restored.snapshot.state,resumed.state],collection:resumed.collection,restoredCollection:restored.collection,changedCollection,equality};
 }finally{await native.close();}
}
