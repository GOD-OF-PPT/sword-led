import { afterEach, describe, expect, it } from 'vitest';
import type { PersistentSession } from '../../src/application/persistent-session.js';
import { createPersistentSession } from '../../src/application/persistent-session.js';
import { createWriterLease, WRITER_LOCK } from '../../src/platform/writer-lease.js';
import { SAVE_KEY, BACKUP_KEY, decodeSave } from '../../src/platform/storage.js';
import { MemoryStorage, TestLocks, session, decision, command, repository } from './persistence-fixtures';
import { newRun } from './helpers';
import { firstMerchant } from './scenarios';
import { getRunView } from '../../src/core/index.js';

const opened: PersistentSession[] = [];
function open(storage?: MemoryStorage, locks?: TestLocks): PersistentSession {
  const current = session(storage, locks); opened.push(current); return current;
}
afterEach(async () => { await Promise.all(opened.splice(0).map(current => current.dispose())); });

describe('protected persistent game session', () => {
  it('autosaves a legitimate merchant purchase sequence and restores purchase limits and repaired seals', async () => {
    const storage = new MemoryStorage(); const locks = new TestLocks(); const a = open(storage, locks);
    const merchant = firstMerchant();
    await a.activate(); a.startNewGame({ runId: merchant.runId, seed: merchant.seed }, decision(a));
    for (const action of merchant.journal) expect(command(a, action).ok).toBe(true);
    expect(a.getSnapshot().state).toEqual(merchant);
    command(a, { type: 'buy', productId: 'anvil' });
    command(a, { type: 'buy', productId: 'repair' });
    const purchased = a.getSnapshot().state;
    expect(purchased?.seals).toBe(3);
    expect(purchased?.history[2]?.sealsAfter).toBe(2);
    await a.suspend();
    const b = open(storage, locks); await b.activate();
    expect(b.getSnapshot().state).toEqual(purchased);
    const restored = b.getSnapshot().state;
    if (!restored) throw new Error();
    expect(getRunView(restored).merchant.offers.find(offer => offer.productId === 'repair')?.availability)
      .toEqual({ allowed: false, reason: 'already_purchased' });
    const writes = storage.writes.length;
    expect(command(b, { type: 'buy', productId: 'anvil' })).toMatchObject({ ok: false, error: 'already_purchased' });
    expect(storage.writes).toHaveLength(writes);
  });

  it('loads/saves accepted commands, rejects duplicates without writes, and resumes without reward events', async () => {
    const storage = new MemoryStorage(); const locks = new TestLocks(); const a = open(storage, locks);
    expect((await a.activate()).mode).toBe('writer');
    expect(a.startNewGame({ runId: 'saved-game', seed: 'save-seed' }, decision(a)).ok).toBe(true);
    const before = a.getSnapshot();
    if (!before.state) throw new Error();
    const envelope = { runId: before.state.runId, expectedRevision: before.state.revision,
      action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } };
    const result = a.dispatch(envelope, before.generation);
    expect(result.ok).toBe(true);
    expect(a.getSnapshot().dirty).toBe(false);
    const writes = storage.writes.length;
    expect(a.dispatch(envelope, before.generation)).toMatchObject({ ok: false, error: 'stale_revision' });
    expect(storage.writes).toHaveLength(writes);
    const state = a.getSnapshot().state;
    await a.suspend();
    const b = open(storage, locks);
    expect((await b.activate()).state).toEqual(state);
    expect(b.resume(decision(b))).toMatchObject({ ok: true });
    expect(b.getSnapshot().state).toEqual(state);
    expect(storage.writes).toHaveLength(writes);
  });

  it('keeps an accepted failed-save state dirty and retries the exact state without rerolling', async () => {
    const storage = new MemoryStorage(); const current = open(storage); await current.activate();
    current.startNewGame({ runId: 'failed-save', seed: 'seed' }, decision(current));
    const disk = storage.getItem(SAVE_KEY); storage.failMain = true;
    const result = command(current, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.persistence).toMatchObject({ ok: false, error: 'storage_write_failed' });
    expect(current.getSnapshot().dirty).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBe(disk);
    const state = current.getSnapshot().state;
    expect(current.retrySave(current.getSnapshot().generation).ok).toBe(false);
    storage.failMain = false;
    expect(current.retrySave(current.getSnapshot().generation).ok).toBe(true);
    expect(current.getSnapshot().state).toBe(state);
    expect(current.getSnapshot().dirty).toBe(false);
    expect(decodeSave(storage.getItem(SAVE_KEY))).toMatchObject({ status: 'valid', state });
  });

  it('requires replacement confirmation and keeps cancelled games/invalid input unchanged', async () => {
    const storage = new MemoryStorage(); const current = open(storage); await current.activate();
    current.startNewGame({ runId: 'first', seed: 'original' }, decision(current));
    const before = current.getSnapshot(); const disk = storage.getItem(SAVE_KEY);
    expect(current.startNewGame({ runId: 'second', seed: 'new' }, decision(current)))
      .toMatchObject({ ok: false, error: 'confirmation_required' });
    expect(current.getSnapshot()).toEqual(before);
    expect(storage.getItem(SAVE_KEY)).toBe(disk);
    expect(current.startNewGame({ runId: '', seed: 'new' }, decision(current, true)))
      .toMatchObject({ ok: false, error: 'invalid_run_id' });
    expect(storage.getItem(SAVE_KEY)).toBe(disk);
    expect(current.startNewGame({ runId: 'second', seed: 'new' }, decision(current, true)).ok).toBe(true);
    expect(current.getSnapshot().state).toEqual(newRun('new', 'second'));
    expect(storage.getItem(BACKUP_KEY)).toBe(disk);
  });

  it('recovers only an explicitly selected valid backup, without overwriting it with corrupt data', async () => {
    const storage = new MemoryStorage(); const current = open(storage); await current.activate();
    current.startNewGame({ runId: 'recover', seed: 'seed' }, decision(current));
    command(current, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    const backup = storage.getItem(BACKUP_KEY);
    expect(current.recoverBackup(decision(current, true))).toMatchObject({ ok: false, error: 'main_available' });
    storage.data.set(SAVE_KEY, 'bad JSON');
    current.notifyExternalChange();
    expect(current.recoverBackup(decision(current))).toMatchObject({ ok: false, error: 'confirmation_required' });
    expect(storage.getItem(SAVE_KEY)).toBe('bad JSON');
    expect(current.recoverBackup(decision(current, true)).ok).toBe(true);
    expect(current.getSnapshot().state?.revision).toBe(0);
    expect(storage.getItem(BACKUP_KEY)).toBe(backup);
    expect(decodeSave(storage.getItem(SAVE_KEY)).status).toBe('valid');
  });

  it('protects one writer, rereads after handoff, and rejects pre-suspend generations', async () => {
    const storage = new MemoryStorage(); const locks = new TestLocks(); const a = open(storage, locks); const b = open(storage, locks);
    await a.activate(); a.startNewGame({ runId: 'shared', seed: 'seed' }, decision(a));
    const old = a.getSnapshot();
    expect((await b.activate()).mode).toBe('readonly');
    expect(b.startNewGame({ runId: 'steal', seed: 'seed' }, decision(b, true))).toMatchObject({ ok: false, error: 'readonly' });
    await a.suspend(); await b.activate();
    expect(command(b, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 }).ok).toBe(true);
    const latest = b.getSnapshot().state;
    const aAgain = await a.activate();
    expect(aAgain.mode).toBe('readonly');
    expect(aAgain.state).toEqual(latest);
    expect(a.dispatch({}, old.generation)).toMatchObject({ ok: false, error: 'stale_session' });
    await b.suspend();
    expect((await a.activate()).state).toEqual(latest);
    expect(locks.requests.every(request => request.name === WRITER_LOCK && request.mode === 'exclusive' && request.ifAvailable)).toBe(true);
  });

  it('preserves dirty memory across suspension, then detects a changed disk instead of overwriting it', async () => {
    const storage = new MemoryStorage(); const locks = new TestLocks(); const a = open(storage, locks);
    await a.activate(); a.startNewGame({ runId: 'dirty', seed: 'seed' }, decision(a));
    storage.failMain = true; command(a, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    const unsaved = a.getSnapshot().state; storage.failMain = false;
    await a.suspend(); await a.activate();
    expect(a.getSnapshot()).toMatchObject({ state: unsaved, dirty: true, conflict: false });
    await a.suspend(); const b = open(storage, locks); await b.activate();
    command(b, { type: 'deliver', pieceId: '1:3' });
    a.notifyExternalChange();
    expect(a.getSnapshot().conflict).toBe(true);
    await b.suspend();
    const disk = storage.getItem(SAVE_KEY); await a.activate();
    expect(a.getSnapshot()).toMatchObject({ state: unsaved, dirty: true, conflict: true });
    expect(a.retrySave(a.getSnapshot().generation)).toMatchObject({ ok: false, error: 'save_conflict' });
    expect(a.resume(decision(a))).toMatchObject({ ok: false, error: 'confirmation_required' });
    expect(storage.getItem(SAVE_KEY)).toBe(disk);
    expect(a.resume(decision(a, true)).ok).toBe(true);
    expect(a.getSnapshot().dirty).toBe(false);
    expect(a.getSnapshot().state?.pieces[2].status).toBe('delivered');
  });

  it('finishes activation when a queued storage update arrives during lock reacquisition', async () => {
    const storage = new MemoryStorage(); const locks = new TestLocks(); const a = open(storage, locks);
    await a.activate(); a.startNewGame({ runId: 'queued-update', seed: 'seed' }, decision(a));
    await a.suspend();
    const b = open(storage, locks); await b.activate();
    command(b, { type: 'deliver', pieceId: '1:3' });
    const latest = b.getSnapshot().state;
    await b.suspend();
    const pendingActivation = a.activate();
    a.notifyExternalChange();
    await pendingActivation;
    expect(a.getSnapshot()).toMatchObject({ mode: 'writer', active: true, state: latest, conflict: false });
  });

  it('rejects gameplay while authoritative activation is pending instead of discarding an accepted unsaved action', async () => {
    const storage = new MemoryStorage(); const current = open(storage);
    await current.activate(); current.startNewGame({ runId: 'activation-gate', seed: 'seed' }, decision(current));
    storage.failMain = true;
    const activating = current.activate();
    expect(command(current, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 }))
      .toMatchObject({ ok: false, error: 'not_active' });
    await activating;
    expect(current.getSnapshot().state?.revision).toBe(0);
    expect(current.getSnapshot().dirty).toBe(false);
  });

  it('offers explicit memory play when locks are unsupported and never pretends it saved', async () => {
    const storage = new MemoryStorage();
    const current = createPersistentSession(repository(storage), createWriterLease()); opened.push(current);
    expect((await current.activate()).mode).toBe('unsupported');
    expect(current.startNewGame({ runId: 'memory', seed: 'seed' }, decision(current))).toMatchObject({ ok: false, error: 'locks_unsupported' });
    expect(current.useMemory({ runId: 'memory', seed: 'seed' }, decision(current)).ok).toBe(true);
    const hit = command(current, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    expect(hit).toMatchObject({ ok: true, persistence: null });
    expect(current.getSnapshot()).toMatchObject({ mode: 'memory', dirty: true });
    expect(storage.writes).toEqual([]);
    await current.suspend(); const state = current.getSnapshot().state; await current.activate();
    expect(current.getSnapshot().state).toBe(state);
    expect(current.retrySave(current.getSnapshot().generation)).toMatchObject({ ok: false, error: 'save_unavailable' });
  });

  it('does not adopt a changed baseline and then overwrite it with old memory after a failed resume', async () => {
    class ChangingStorage extends MemoryStorage {
      armed = false;
      reads = 0;
      override getItem(key: string): string | null {
        if (key === SAVE_KEY && this.armed && ++this.reads === 2) this.data.set(SAVE_KEY, 'changed-during-read');
        return super.getItem(key);
      }
    }
    const storage = new ChangingStorage(); const current = open(storage);
    await current.activate(); current.startNewGame({ runId: 'coherence', seed: 'seed' }, decision(current));
    storage.armed = true;
    expect(current.resume(decision(current))).toMatchObject({ ok: false, error: 'save_unavailable' });
    expect(current.getSnapshot().conflict).toBe(true);
    expect(command(current, { type: 'deliver', pieceId: '1:1' })).toMatchObject({ ok: false, error: 'save_conflict' });
    expect(storage.getItem(SAVE_KEY)).toBe('changed-during-read');
  });

  it('keeps the working-copy base attached to memory after a failed recovery and later reactivation', async () => {
    class ReplacingStorage extends MemoryStorage {
      replacement: string | null = null;
      reads = 0;
      override getItem(key: string): string | null {
        if (key === SAVE_KEY && this.replacement && ++this.reads === 2) this.data.set(SAVE_KEY, this.replacement);
        return super.getItem(key);
      }
    }
    const storage = new ReplacingStorage(); const current = open(storage);
    await current.activate(); current.startNewGame({ runId: 'old-working', seed: 'old' }, decision(current));
    command(current, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    const otherStorage = new MemoryStorage(); const otherRepo = repository(otherStorage);
    otherRepo.load(); otherRepo.write(newRun('newer', 'other-owner'));
    const newer = otherStorage.getItem(SAVE_KEY);
    if (!newer) throw new Error();
    storage.data.set(SAVE_KEY, 'corrupt-before-recovery'); storage.replacement = newer;
    expect(current.recoverBackup(decision(current, true))).toMatchObject({ ok: false, error: 'main_available' });
    await current.activate();
    expect(current.getSnapshot().conflict).toBe(true);
    expect(current.retrySave(current.getSnapshot().generation)).toMatchObject({ ok: false, error: 'save_conflict' });
    expect(storage.getItem(SAVE_KEY)).toBe(newer);
    expect(current.resume(decision(current, true)).ok).toBe(true);
    expect(current.getSnapshot().state?.runId).toBe('other-owner');
  });

  it('handles rapid cancellation/disposal and isolates observer errors from accepted writes', async () => {
    const current = open();
    const activating = current.activate();
    await current.dispose(); await activating;
    expect(current.getSnapshot().mode).toBe('disposed');
    expect(current.startNewGame({ runId: 'late', seed: 'seed' }, decision(current))).toMatchObject({ ok: false, error: 'disposed' });
    const normal = open(); await normal.activate();
    normal.subscribe(() => { throw new Error('view failed'); });
    let calls = 0; normal.subscribe(() => { calls++; });
    expect(normal.startNewGame({ runId: 'observers', seed: 'seed' }, decision(normal)).ok).toBe(true);
    expect(normal.getSnapshot().dirty).toBe(false);
    expect(calls).toBe(2);
  });
});
