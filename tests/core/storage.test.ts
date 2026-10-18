import { describe, expect, it } from 'vitest';
import { createSaveRepository, decodeSave, BACKUP_KEY, SAVE_KEY } from '../../src/platform/storage.js';
import { act, newRun } from './helpers';
import { MemoryStorage, FIXED_TIME, repository } from './persistence-fixtures';

describe('versioned save repository', () => {
  it('saves canonical state and keeps a previous valid primary as an explicit backup', () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    expect(repo.load()).toEqual({ main: { status: 'empty' }, backup: { status: 'empty' } });
    const first = newRun();
    expect(repo.write(first)).toEqual({ ok: true, savedAt: FIXED_TIME, backupWarning: false });
    const raw = storage.getItem(SAVE_KEY);
    const hit = act(first, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    expect(repo.write(hit).ok).toBe(true);
    expect(storage.getItem(BACKUP_KEY)).toBe(raw);
    expect(decodeSave(storage.getItem(SAVE_KEY))).toEqual({ status: 'valid', state: hit, savedAt: FIXED_TIME });
    expect(repo.isCurrent()).toBe(true);
  });

  it('cannot write without a loaded baseline or after another writer changed the slot', () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    expect(repo.write(newRun())).toMatchObject({ ok: false, error: 'storage_read_failed' });
    repo.load();
    storage.data.set(SAVE_KEY, 'external');
    expect(repo.isCurrent()).toBe(false);
    expect(repo.write(newRun())).toMatchObject({ ok: false, error: 'storage_conflict' });
    expect(storage.getItem(SAVE_KEY)).toBe('external');
    expect(storage.writes).toEqual([]);
  });

  it('checks the explicit working-copy base even after a later read adopted another primary', () => {
    const storage = new MemoryStorage(); const repo = repository(storage); repo.load(); repo.write(newRun());
    const original = repo.token();
    const otherStorage = new MemoryStorage(); const other = repository(otherStorage); other.load(); other.write(newRun('newer', 'other'));
    storage.data.set(SAVE_KEY, otherStorage.getItem(SAVE_KEY) ?? '');
    repo.load();
    expect(repo.isCurrent({ raw: original })).toBe(false);
    expect(repo.write(newRun('old-fork'), { raw: original })).toMatchObject({ ok: false, error: 'storage_conflict' });
    expect(storage.getItem(SAVE_KEY)).toBe(otherStorage.getItem(SAVE_KEY));
  });

  it('never replaces a good backup with malformed primary data', () => {
    const storage = new MemoryStorage();
    const repo = repository(storage); repo.load(); repo.write(newRun());
    const good = storage.getItem(SAVE_KEY);
    storage.data.set(BACKUP_KEY, good ?? '');
    storage.data.set(SAVE_KEY, 'corrupt');
    expect(repo.load().main.status).toBe('invalid');
    expect(repo.write(newRun('new-seed')).ok).toBe(true);
    expect(storage.getItem(BACKUP_KEY)).toBe(good);
  });

  it('reports backup failure separately from primary success, and primary failure never appears saved', () => {
    const storage = new MemoryStorage(); const repo = repository(storage); repo.load();
    const run = newRun(); repo.write(run); const before = storage.getItem(SAVE_KEY);
    const hit = act(run, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    storage.failBackup = true;
    expect(repo.write(hit)).toEqual({ ok: true, savedAt: FIXED_TIME, backupWarning: true });
    storage.failMain = true;
    const current = storage.getItem(SAVE_KEY);
    expect(repo.write(run)).toMatchObject({ ok: false, error: 'storage_write_failed' });
    expect(storage.getItem(SAVE_KEY)).toBe(current);
    expect(current).not.toBe(before);
    expect(repo.isCurrent()).toBe(true);
  });

  it('catches denied storage getters, read failures, bad clocks and oversized saves', () => {
    const denied = createSaveRepository(() => { throw new Error('SecurityError'); });
    expect(denied.load().main.status).toBe('unavailable');
    expect(denied.write(newRun()).ok).toBe(false);
    const storage = new MemoryStorage(); storage.failRead = true;
    expect(repository(storage).load().main.status).toBe('unavailable');
    storage.failRead = false;
    const badClock = createSaveRepository(() => storage, () => 'no date'); badClock.load();
    expect(badClock.write(newRun())).toMatchObject({ ok: false, error: 'serialization_failed' });
    expect(storage.writes).toEqual([]);
    expect(decodeSave('界'.repeat(100000))).toMatchObject({ status: 'invalid', error: 'save_too_large' });
  });

  it.each([
    ['{', 'invalid_json'],
    [JSON.stringify({ schemaVersion: 2 }), 'unsupported_schema'],
    [JSON.stringify({ schemaVersion: 1, rulesVersion: 'other', savedAt: FIXED_TIME, state: {} }), 'unsupported_rules'],
    [JSON.stringify({ schemaVersion: 1, rulesVersion: 'forge-v1', savedAt: 'yesterday', state: {} }), 'invalid_timestamp'],
    [JSON.stringify({ schemaVersion: 1, rulesVersion: 'forge-v1', savedAt: FIXED_TIME, state: {} }), 'invalid_state'],
  ])('rejects bad envelope %s with %s', (raw, error) => {
    expect(decodeSave(raw)).toMatchObject({ status: 'invalid', error });
  });
});
