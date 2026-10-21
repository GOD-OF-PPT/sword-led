import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {createRun, applyCommand, validateRun} from '../../src/core-v5/index.js';
import type {Action, RunState} from '../../src/core-v5/index.js';
import type {RunState as V4RunState} from '../../src/core-v4/index.js';
import {createV5Session, createV5SaveRepository, decodeV5Save, V5_SAVE_KEY, V5_BACKUP_KEY} from '../../src/application/v5-persistence.js';
import type {V5Session} from '../../src/application/v5-persistence.js';
import {createCollectionRepository, createLegacyCollectionSource, collectionFromRun, collectionEligibility, mergeCollections, decodeCollection, COLLECTION_KEY, COLLECTION_BACKUP_KEY} from '../../src/application/v5-collection.js';
import {collectionFromRun as legacyAwards, COLLECTION_KEY as LEGACY_KEY, COLLECTION_BACKUP_KEY as LEGACY_BACKUP_KEY} from '../../src/application/v4-collection.js';
import type {CollectionState as LegacyCollection} from '../../src/application/v4-collection.js';
import {createWriterLease} from '../../src/platform/writer-lease.js';
import {MemoryStorage, TestLocks, FIXED_TIME} from './persistence-fixtures.js';

// All source runs and prefixes below are real, archived Accepted-command journeys.
// Invalid-envelope examples are explicitly negative input; no wallet/phase fixtures are assigned.
const v5Victory = (JSON.parse(readFileSync('docs/evidence/T11-4-2-3l1/journeys/victory.json', 'utf8')) as {state: RunState}).state;
const v4Witness = (name: string) => JSON.parse(readFileSync(`docs/evidence/T11-4-2-3i1/witness-fixed/${name}.json`, 'utf8')) as V4RunState;
const v4Victory = v4Witness('complete');
const v4Failed = v4Witness('chapter-defeat');
function awards(state: RunState | V4RunState) {
 const result = collectionFromRun(state);
 if (!result.ok) throw Error(result.detail);
 return result.state;
}
function oldAwards(state: V4RunState): LegacyCollection {
 const result = legacyAwards(state);
 if (!result.ok) throw Error(result.detail);
 return result.state;
}
const legacyRaw = (state = oldAwards(v4Victory)) => JSON.stringify({schemaVersion: 1, rulesVersion: 'forge-v4-collection-v1', savedAt: FIXED_TIME, state});
function chapterPrefix() {
 const created = createRun({runId: v5Victory.runId, seed: v5Victory.seed, mode: v5Victory.mode, eligibility: v5Victory.initialEligibility});
 if (!created.ok) throw Error(created.error);
 let state = created.state;
 for (const action of v5Victory.journal) {
  if (state.day === 4 && action.type === 'settle') return state;
  const result = applyCommand(state, {runId: state.runId, expectedRevision: state.revision, action});
  if (!result.ok) throw Error(result.error);
  state = result.state;
 }
 throw Error('Missing genuine first-chapter settle prefix');
}
class Store extends MemoryStorage {
 readonly deniedReads = new Set<string>();
 readonly deniedWrites = new Set<string>();
 override getItem(key: string) { if (this.deniedReads.has(key)) throw Error('Read denied'); return super.getItem(key); }
 override setItem(key: string, value: string) { if (this.deniedWrites.has(key)) throw Error('Quota denied'); super.setItem(key, value); }
}
function open(store = new Store(), locks: TestLocks | null = new TestLocks()) {
 return createV5Session(createV5SaveRepository(() => store, () => FIXED_TIME), createWriterLease(locks ?? undefined), createCollectionRepository(() => store, () => FIXED_TIME), createLegacyCollectionSource(() => store));
}
const decide = (session: V5Session, confirmed = false) => ({generation: session.getSnapshot().generation, confirmed});
function send(session: V5Session, action: Action) {
 const snapshot = session.getSnapshot();
 if (!snapshot.state) throw Error('No active run');
 return session.dispatch({runId: snapshot.state.runId, expectedRevision: snapshot.state.revision, action}, snapshot.generation);
}
function stored(store: Store, state: RunState) {
 expect(validateRun(state).ok).toBe(true);
 const repository = createV5SaveRepository(() => store, () => FIXED_TIME);
 repository.load();
 expect(repository.write(state).ok).toBe(true);
}
function preview(session: V5Session, source: 'main' | 'backup' = 'main') {
 const result = session.previewLegacyImport(source);
 if (!result.ok) throw Error(`Preview failed: ${result.error}`);
 return result.preview;
}
function confirm(session: V5Session, previewId: number) {
 return session.importLegacyCollection({...decide(session, true), previewId});
}

describe('v5 independent saves and source-tagged collection', () => {
 it('derives both real receipt sources and merges one best work per commission without relabeling old scores', () => {
  const fresh = awards(v5Victory), old = awards(v4Victory);
  expect(fresh.works).toHaveLength(12);
  expect(fresh.works.every(work => work.rulesVersion === 'forge-v5')).toBe(true);
  expect(old.works.every(work => work.rulesVersion === 'forge-v4')).toBe(true);
  const merged = mergeCollections(fresh, old);
  expect(merged).toEqual(mergeCollections(old, fresh));
  expect(mergeCollections(merged, old)).toEqual(merged);
  expect(merged.works).toHaveLength(12);
  for (const work of merged.works) {
   const candidates = [fresh, old].map(collection => collection.works.find(candidate => candidate.commissionId === work.commissionId)!);
   const score = (candidate: typeof work) => candidate.blades.reduce((total, blade) => total + blade.value, 0);
   expect(score(work)).toBe(Math.max(...candidates.map(score)));
   expect(candidates).toContainEqual(work);
  }
  const raw = JSON.stringify({schemaVersion: 2, rulesVersion: 'forge-collection-v2', savedAt: FIXED_TIME, state: merged});
  expect(decodeCollection(raw)).toMatchObject({status: 'valid', state: merged});
  expect(Object.keys(merged).sort()).toEqual(['challenge', 'chapters', 'mastery', 'traits', 'works']);
 });

 it('saves a genuine hammer result under schema5, reloads exact randomness, and leaves all old slots unchanged', async () => {
  const store = new Store();
  for (const suffix of ['save.v1', 'save.backup.v1', 'save.v2', 'save.backup.v2', 'save.v3', 'save.backup.v3', 'save.v4', 'save.backup.v4']) store.data.set(`sword-led.${suffix}`, `original:${suffix}`);
  store.data.set(LEGACY_KEY, legacyRaw());
  store.data.set(LEGACY_BACKUP_KEY, legacyRaw(oldAwards(v4Failed)));
  const protectedSlots = new Map(store.data), session = open(store);
  await session.activate();
  expect(session.startNewGame({runId: 'v5-durable', seed: 'v5-durable'}, decide(session)).ok).toBe(true);
  expect(send(session, {type: 'continue'}).ok).toBe(true);
  expect(send(session, {type: 'strike', pieceId: 'd1-1'}).ok).toBe(true);
  const exact = session.getSnapshot().state!;
  expect(JSON.parse(store.getItem(V5_SAVE_KEY)!).schemaVersion).toBe(5);
  expect(decodeV5Save(store.getItem(V5_SAVE_KEY))).toMatchObject({status: 'valid', state: exact});
  expect(decodeV5Save(store.getItem(V5_BACKUP_KEY)).status).toBe('valid');
  expect(session.getCollectionSnapshot().data.challenge).toBe(false);
  await session.dispose();
  const resumed = open(store); await resumed.activate();
  expect(resumed.getSnapshot().state).toEqual(exact);
  const expected = applyCommand(exact, {runId: exact.runId, expectedRevision: exact.revision, action: {type: 'strike', pieceId: 'd1-1'}});
  expect(expected.ok).toBe(true);
  expect(send(resumed, {type: 'strike', pieceId: 'd1-1'}).state).toEqual(expected.state);
  for (const [key, raw] of protectedSlots) expect(store.getItem(key)).toBe(raw);
  await resumed.dispose();
 });

 it('previews old unlocks without writes, requires explicit confirmation, freezes the current run, and imports idempotently without a wallet', async () => {
  const store = new Store(); store.data.set(LEGACY_KEY, legacyRaw());
  const session = open(store); await session.activate();
  expect(session.startNewGame({runId: 'before-import', seed: 'before-import'}, decide(session)).ok).toBe(true);
  const state = session.getSnapshot().state!, writes = store.writes.length;
  const shown = preview(session);
  expect(store.writes).toHaveLength(writes);
  expect(shown.collection.works.every(work => work.rulesVersion === 'forge-v4')).toBe(true);
  expect(shown.merged.challenge).toBe(true);
  expect(session.getCollectionSnapshot().data.challenge).toBe(false);
  expect(session.importLegacyCollection({...decide(session), previewId: shown.id})).toMatchObject({ok: false, error: 'confirmation_required'});
  expect(confirm(session, shown.id).ok).toBe(true);
  expect(session.getSnapshot().state).toBe(state);
  expect(state.initialEligibility).toEqual({recipes: ['light'], challenge: false});
  expect(state.coins).toBe(0);
  const imported = session.getCollectionSnapshot().data, raw = store.getItem(COLLECTION_KEY);
  expect(imported).toEqual(shown.merged);
  expect(confirm(session, shown.id)).toMatchObject({ok: false, error: 'legacy_changed'});
  expect(confirm(session, preview(session).id).ok).toBe(true);
  expect(session.getCollectionSnapshot().data).toEqual(imported);
  expect(store.getItem(COLLECTION_KEY)).toBe(raw);
  expect(session.startNewGame({runId: 'after-import', seed: 'after-import'}, decide(session, true)).ok).toBe(true);
  expect(session.getSnapshot().state!.initialEligibility).toEqual(collectionEligibility(imported));
  expect(session.getSnapshot().state!.coins).toBe(0);
  expect(session.getSnapshot().state!.traits).toEqual([]);
  expect(session.getSnapshot().state!.upgradeCount).toBe(0);
  const cleanRun = createRun({runId: 'after-import', seed: 'after-import', eligibility: collectionEligibility(imported)});
  expect(cleanRun.ok).toBe(true);
  if (cleanRun.ok) expect(session.getSnapshot().state).toEqual(cleanRun.state);
  await session.dispose();
 });

 it('binds the private preview to exact source bytes and run context, never substitutes a backup or forged ticket', async () => {
  const store = new Store(); store.data.set(LEGACY_KEY, legacyRaw(oldAwards(v4Failed))); store.data.set(LEGACY_BACKUP_KEY, legacyRaw());
  const session = open(store); await session.activate();
  session.startNewGame({runId: 'bound', seed: 'bound'}, decide(session));
  const shown = preview(session), writes = store.writes.length;
  store.data.set(LEGACY_KEY, legacyRaw());
  expect(confirm(session, shown.id)).toMatchObject({ok: false, error: 'legacy_changed'});
  expect(store.writes).toHaveLength(writes);
  expect(session.getCollectionSnapshot().data.challenge).toBe(false);
  expect(confirm(session, -1)).toMatchObject({ok: false, error: 'legacy_changed'});
  const context = preview(session);
  expect(send(session, {type: 'continue'}).ok).toBe(true);
  const afterCommand = store.writes.length;
  expect(confirm(session, context.id)).toMatchObject({ok: false, error: 'legacy_changed'});
  expect(store.writes).toHaveLength(afterCommand);
  const cancelled = preview(session); session.cancelLegacyImport();
  expect(confirm(session, cancelled.id)).toMatchObject({ok: false, error: 'legacy_changed'});
  const invalidated = preview(session); session.notifyLegacyCollectionChange();
  expect(confirm(session, invalidated.id)).toMatchObject({ok: false, error: 'legacy_changed'});
  store.data.set(LEGACY_KEY, '{"schemaVersion":99}'); // Malformed/future negative envelope only.
  expect(session.previewLegacyImport()).toMatchObject({ok: false, error: 'legacy_unavailable'});
  expect(session.getCollectionSnapshot().data.challenge).toBe(false);
  expect(confirm(session, preview(session, 'backup').id).ok).toBe(true);
  expect(session.getCollectionSnapshot().data.challenge).toBe(true);
  expect(store.getItem(LEGACY_KEY)).toBe('{"schemaVersion":99}');
  await session.dispose();
 });

 it('retries only an explicitly confirmed snapshot after collection write failure, even if the old source later gains more progress', async () => {
  const store = new Store(), shownOld = awards(v4Failed);
  store.data.set(LEGACY_KEY, legacyRaw(oldAwards(v4Failed)));
  const session = open(store); await session.activate();
  session.startNewGame({runId: 'import-failure', seed: 'import-failure'}, decide(session));
  const exact = session.getSnapshot().state!, shown = preview(session);
  store.deniedWrites.add(COLLECTION_KEY);
  expect(confirm(session, shown.id)).toMatchObject({ok: false, error: 'collection_unavailable'});
  expect(session.getCollectionSnapshot()).toMatchObject({data: shownOld, pending: true, lastSave: {ok: false, error: 'storage_write_failed'}});
  expect(JSON.parse(session.exportCollection()).collection).toEqual(shownOld);
  expect(session.startNewGame({runId: 'must-not-drop', seed: 'must-not-drop'}, decide(session, true))).toMatchObject({ok: false, error: 'collection_pending'});
  store.data.set(LEGACY_KEY, legacyRaw()); session.notifyLegacyCollectionChange();
  store.deniedWrites.delete(COLLECTION_KEY);
  expect(session.retryCollection(session.getSnapshot().generation).ok).toBe(true);
  expect(session.getCollectionSnapshot().data).toEqual(shownOld);
  expect(session.getCollectionSnapshot().data.challenge).toBe(false);
  expect(session.getSnapshot().state).toBe(exact);
  expect(decodeCollection(store.getItem(COLLECTION_KEY))).toMatchObject({status: 'valid', state: shownOld});
  await session.dispose();
 });

 it('does not award an unsaved chapter, preserves its exact exported run, and credits it only after run retry', async () => {
  const store = new Store(); stored(store, chapterPrefix()); store.data.set(LEGACY_KEY, legacyRaw());
  const session = open(store); await session.activate();
  const before = session.getCollectionSnapshot().data, writes = store.writes.length;
  store.deniedWrites.add(V5_SAVE_KEY);
  expect(send(session, {type: 'settle'})).toMatchObject({ok: true, persistence: {ok: false}});
  const exact = session.getSnapshot().state!;
  expect(session.getSnapshot().dirty).toBe(true);
  expect(session.getCollectionSnapshot().data).toEqual(before);
  expect(store.writes.slice(writes)).not.toContain(COLLECTION_KEY);
  expect(JSON.parse(session.exportRun()!)).toEqual(exact);
  expect(session.startNewGame({runId: 'unsaved-chapter', seed: 'x'}, decide(session, true))).toMatchObject({ok: false, error: 'collection_pending'});
  expect(confirm(session, preview(session).id)).toMatchObject({ok: false});
  store.deniedWrites.delete(V5_SAVE_KEY);
  expect(session.retrySave(session.getSnapshot().generation).ok).toBe(true);
  expect(session.getSnapshot().state).toBe(exact);
  expect(session.getCollectionSnapshot().data.chapters).toEqual([1]);
  expect(session.getCollectionSnapshot().pending).toBe(false);
  await session.dispose();
 });

 it('keeps the run saved when only the new collection fails, exports both, then retries without replaying commands', async () => {
  const store = new Store(); stored(store, chapterPrefix());
  const session = open(store); await session.activate();
  store.deniedWrites.add(COLLECTION_KEY);
  expect(send(session, {type: 'settle'})).toMatchObject({ok: true, persistence: {ok: true}});
  const exact = session.getSnapshot().state!, raw = store.getItem(V5_SAVE_KEY), writes = store.writes.length;
  expect(session.getSnapshot().dirty).toBe(false);
  expect(session.getCollectionSnapshot()).toMatchObject({pending: true, lastSave: {ok: false, error: 'storage_write_failed'}});
  expect(JSON.parse(session.exportRun()!)).toEqual(exact);
  expect(JSON.parse(session.exportCollection()).collection.chapters).toEqual([1]);
  expect(store.writes).toHaveLength(writes);
  expect(session.startNewGame({runId: 'blocked-new-run', seed: 'x'}, decide(session, true))).toMatchObject({ok: false, error: 'collection_pending'});
  store.deniedWrites.delete(COLLECTION_KEY);
  expect(session.retryCollection(session.getSnapshot().generation).ok).toBe(true);
  expect(session.getSnapshot().state).toBe(exact);
  expect(store.getItem(V5_SAVE_KEY)).toBe(raw);
  expect(session.getCollectionSnapshot().pending).toBe(false);
  const after = store.writes.length;
  expect(session.retryCollection(session.getSnapshot().generation).ok).toBe(true);
  expect(store.writes).toHaveLength(after);
  await session.dispose();
 });

 it('preserves an unknown new collection and requires explicit backup recovery instead of overwriting its raw bytes', async () => {
  const store = new Store(), old = awards(v4Failed);
  const backup = JSON.stringify({schemaVersion: 2, rulesVersion: 'forge-collection-v2', savedAt: FIXED_TIME, state: old});
  const future = backup.replace('"schemaVersion":2', '"schemaVersion":99'); // Explicit future-envelope negative input.
  store.data.set(COLLECTION_KEY, future); store.data.set(COLLECTION_BACKUP_KEY, backup);
  const session = open(store); await session.activate();
  expect(store.getItem(COLLECTION_KEY)).toBe(future);
  expect(session.getCollectionSnapshot().problem).toBe('unsupported_schema');
  expect(JSON.parse(session.exportCollection()).stored.main.raw).toBe(future);
  expect(session.recoverCollectionBackup(decide(session))).toMatchObject({ok: false, error: 'confirmation_required'});
  expect(session.recoverCollectionBackup(decide(session, true)).ok).toBe(true);
  expect(session.getCollectionSnapshot().data).toEqual(old);
  expect(decodeCollection(store.getItem(COLLECTION_KEY))).toMatchObject({status: 'valid', state: old});
  await session.dispose();
 });

 it('uses the shared writer lease, rejects stale input, and never saves or imports in readonly or memory mode', async () => {
  const store = new Store(), locks = new TestLocks(); store.data.set(LEGACY_KEY, legacyRaw());
  const first = open(store, locks), second = open(store, locks);
  await first.activate(); first.startNewGame({runId: 'shared-v5', seed: 'shared-v5'}, decide(first));
  expect((await second.activate()).mode).toBe('readonly');
  const shown = preview(second), writes = store.writes.length;
  expect(confirm(second, shown.id)).toMatchObject({ok: false, error: 'readonly'});
  expect(store.writes).toHaveLength(writes);
  const stale = first.getSnapshot().generation;
  await first.suspend(); await second.activate();
  expect(first.dispatch({}, stale)).toMatchObject({ok: false});
  expect(locks.requests.every(request => request.name === 'sword-led.writer')).toBe(true);
  await first.dispose(); await second.dispose();
  const memory = open(store, null); expect((await memory.activate()).mode).toBe('unsupported');
  expect(memory.useMemory({runId: 'v5-memory', seed: 'v5-memory'}, decide(memory, true)).ok).toBe(true);
  const before = store.writes.length;
  expect(send(memory, {type: 'continue'}).ok).toBe(true);
  expect(send(memory, {type: 'strike', pieceId: 'd1-1'}).ok).toBe(true);
  expect(confirm(memory, preview(memory).id)).toMatchObject({ok: false, error: 'readonly'});
  expect(store.writes).toHaveLength(before);
  await memory.dispose();
 });
});
