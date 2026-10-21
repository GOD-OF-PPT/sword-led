import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as sdk from '../../dist/sword-led-v5.js';
const out = 'tmp/T11-4-2-3l2', url = 'http://127.0.0.1:4208/assets/d/manifest.json';
const legacyRun = JSON.parse(await readFile('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json', 'utf8'));
const browser = await chromium.launch(), errors = [];
try {
  const context = await browser.newContext(), page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  const before = await page.evaluate(async oldRun => {
    const api = await import('/sword-led-v5.js'), legacy = await import('/sword-led-v4.js'); window.api = api;
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const oldRepo = legacy.createV4SaveRepository(() => localStorage); oldRepo.load(); check(oldRepo.write(oldRun).ok, 'Write legitimate old fixture');
    const awards = legacy.collectionFromRun(oldRun); check(awards.ok, 'Old run must replay');
    localStorage.setItem(api.LEGACY_COLLECTION_KEY, JSON.stringify({schemaVersion:1,rulesVersion:'forge-v4-collection-v1',savedAt:'2026-10-21T00:00:00.000Z',state:awards.state}));
    window.oldRunRaw = localStorage.getItem(legacy.V4_SAVE_KEY);
    const session = api.createV5BrowserSession(); window.session = session; check((await session.activate()).mode === 'writer', 'Real Web Locks writer');
    const decision = () => ({generation:session.getSnapshot().generation,confirmed:false});
    check(session.startNewGame({runId:'browser-v5',seed:'v5-browser-save'},decision()).ok,'Create new v5');
    for (const action of [{type:'continue'},...Array.from({length:3},()=>({type:'strike',pieceId:'d1-1'})),{type:'deliver',pieceId:'d1-1'}]) {
      const snapshot = session.getSnapshot(), expected = api.applyCommand(snapshot.state,{runId:snapshot.state.runId,expectedRevision:snapshot.state.revision,action});
      check(expected.ok,'Expected formal action'); const actual = session.dispatch({runId:snapshot.state.runId,expectedRevision:snapshot.state.revision,action},snapshot.generation);
      check(actual.ok && actual.persistence.ok && JSON.stringify(actual.state) === JSON.stringify(expected.state),'Exactly one accepted saved result');
    }
    const state = session.getSnapshot().state, allRaw = () => JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
    const rawBefore = allRaw(), preview = session.previewLegacyImport(); check(preview.ok,'Legacy preview'); check(rawBefore === allRaw(),'Preview writes nothing');
    check(preview.preview.collection.works.every(work=>work.rulesVersion==='forge-v4'),'Legacy sources labeled v4');
    const changed = JSON.parse(localStorage.getItem(api.LEGACY_COLLECTION_KEY)); changed.savedAt='2026-10-21T00:00:01.000Z';
    localStorage.setItem(api.LEGACY_COLLECTION_KEY,JSON.stringify(changed));
    const rejected = session.importLegacyCollection({generation:session.getSnapshot().generation,confirmed:true,previewId:preview.preview.id});
    check(!rejected.ok && rejected.error==='legacy_changed','Changed exact source rejected');
    check(!session.getCollectionSnapshot().data.challenge,'No unseen unlock imported');
    const shown = session.previewLegacyImport(); check(shown.ok,'Fresh preview');
    check(session.importLegacyCollection({generation:session.getSnapshot().generation,confirmed:true,previewId:shown.preview.id}).ok,'Explicit exact snapshot import');
    check(JSON.stringify(session.getSnapshot().state)===JSON.stringify(state),'Current run/coins/eligibility frozen');
    const collection=session.getCollectionSnapshot().data; check(collection.challenge && collection.works.length===12,'Only collection imported');
    check(localStorage.getItem(legacy.V4_SAVE_KEY)===window.oldRunRaw,'Old run bytes preserved');
    window.legacyExpected=localStorage.getItem(api.LEGACY_COLLECTION_KEY);
    return {state,collection,previewZeroWrites:true,changedSourceRejected:true,oldRunUnchanged:true,oldRunRaw:window.oldRunRaw,runRaw:localStorage.getItem(api.V5_SAVE_KEY),collectionRaw:localStorage.getItem(api.COLLECTION_KEY)};
  }, legacyRun);
  const other = await context.newPage(); other.on('pageerror', e => errors.push(e.message)); await other.goto(url);
  const oldMode = await other.evaluate(async () => { const api=await import('/sword-led-v4.js'); window.oldSession=api.createV4BrowserSession(); return (await window.oldSession.activate()).mode; });
  assert.equal(oldMode,'readonly');
  const oldExpected = await page.evaluate(() => window.legacyExpected);
  await other.evaluate(() => window.oldSession.dispose()); await page.evaluate(() => window.session.dispose()); await page.reload();
  const restored = await page.evaluate(async ({oldRunRaw,oldCollectionRaw}) => {
    const api=await import('/sword-led-v5.js'),check=(condition,message)=>{if(!condition)throw Error(message);};
    const session=api.createV5BrowserSession(); window.session=session; check((await session.activate()).mode==='writer','Reacquire after explicit dispose/reload');
    const state=session.getSnapshot().state,collection=session.getCollectionSnapshot().data;
    const beforeCoins=state.coins,revision=state.revision; check(api.validateRun(state).ok,'Reload replays');
    check(localStorage.getItem('sword-led.save.v4')===oldRunRaw,'Old run unchanged on reload');
    check(localStorage.getItem(api.LEGACY_COLLECTION_KEY)===oldCollectionRaw,'Old collection not rewritten by import/reload');
    check(session.startNewGame({runId:'after-import',seed:'after-import'},{generation:session.getSnapshot().generation,confirmed:true}).ok,'New eligible run');
    const fresh=session.getSnapshot().state; check(fresh.coins===0 && fresh.traits.length===0 && fresh.upgradeCount===0,'No old economic resources migrated');
    check(fresh.initialEligibility.challenge && fresh.initialEligibility.recipes.length===3,'Durable qualifications only affect new run');
    return {state,collection,fresh,beforeCoins,revision,runRaw:localStorage.getItem(api.V5_SAVE_KEY),collectionRaw:localStorage.getItem(api.COLLECTION_KEY),oldCollectionUnchanged:true};
  },{oldRunRaw:before.oldRunRaw,oldCollectionRaw:oldExpected});
  assert.deepEqual(restored.state,before.state); assert.deepEqual(restored.collection,before.collection);
  const states=[before.state,restored.state,restored.fresh]; for(const state of states)assert(sdk.validateRun(state).ok);
  for(const collection of [before.collection,restored.collection])assert(sdk.validateCollection(collection).ok);
  assert.equal(sdk.decodeV5Save(before.runRaw).status,'valid'); assert.equal(sdk.decodeCollection(before.collectionRaw).status,'valid'); assert.equal(errors.length,0);
  await writeFile(`${out}/browser-result.json`,JSON.stringify({ok:true,scope:'isolated Chromium SDK consumer with actual localStorage/Web Locks; no game UI or compatibility matrix',url,acceptedDomainCommands:5,states,collections:[before.collection,restored.collection],oldMode,previewZeroWrites:before.previewZeroWrites,changedSourceRejected:before.changedSourceRejected,oldRunUnchanged:before.oldRunUnchanged,oldCollectionUnchanged:restored.oldCollectionUnchanged,newRunCoins:restored.fresh.coins,errors},null,2)+'\n');
  await page.evaluate(()=>window.session.dispose()); console.log(JSON.stringify({ok:true,acceptedDomainCommands:5,savedObservations:3,collections:2,oldMode,errors}));
} finally { await browser.close(); }
