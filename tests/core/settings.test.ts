import { describe, expect, it } from 'vitest';
import { createPreferences, decodePreferences, DEFAULT_PREFERENCES, SETTINGS_KEY } from '../../src/platform/settings.js';
import { MemoryStorage } from './persistence-fixtures';
import { BACKUP_KEY, SAVE_KEY } from '../../src/platform/storage.js';

describe('independent preferences', () => {
  it('reads defaults without creating or changing any storage entry', () => {
    const storage = new MemoryStorage();storage.data.set(SAVE_KEY, 'retained-contract');storage.data.set(BACKUP_KEY, 'retained-backup');
    const preferences = createPreferences(() => storage);
    expect(preferences.getSnapshot()).toMatchObject({ value: DEFAULT_PREFERENCES, persisted: false, dirty: false, problem: null });
    expect(storage.writes).toEqual([]);expect(storage.data.get(SAVE_KEY)).toBe('retained-contract');
  });
  it('round-trips all settings and never writes the contract or backup', () => {
    const storage = new MemoryStorage(), preferences = createPreferences(() => storage);
    expect(preferences.update({ muted: true, volume: 0, slow: true, reducedMotion: true })).toBe(true);
    expect(storage.writes).toEqual([SETTINGS_KEY]);
    expect(createPreferences(() => storage).getSnapshot()).toEqual(preferences.getSnapshot());
    expect(Object.isFrozen(preferences.getSnapshot().value)).toBe(true);
  });
  it('rejects wrong schema, fields, ranges and oversized data without replacing the original', () => {
    const values: unknown[] = [null, [], 1, { ...DEFAULT_PREFERENCES }, { schemaVersion: 2, ...DEFAULT_PREFERENCES },
      ...[-1,101,1.5,null,'55'].map(volume => ({ schemaVersion: 1, ...DEFAULT_PREFERENCES, volume })),
      { schemaVersion: 1, ...DEFAULT_PREFERENCES, muted: 1 }, { schemaVersion: 1, ...DEFAULT_PREFERENCES, slow: null },
      { schemaVersion: 1, ...DEFAULT_PREFERENCES, reducedMotion: 'yes' }, { schemaVersion: 1, ...DEFAULT_PREFERENCES, other: 1 }];
    for (const value of values) expect(decodePreferences(JSON.stringify(value))).toBeNull();
    for (const raw of ['{', 'x'.repeat(4097), '文'.repeat(2000)]) {
      const storage = new MemoryStorage();storage.data.set(SETTINGS_KEY, raw);
      expect(createPreferences(() => storage).getSnapshot()).toMatchObject({ value: DEFAULT_PREFERENCES, problem: 'invalid' });
      expect(storage.getItem(SETTINGS_KEY)).toBe(raw);expect(storage.writes).toEqual([]);
    }
  });
  it('uses the same pending value after a failed write and a later retry', () => {
    const storage = new MemoryStorage();let fail = true;
    const preferences = createPreferences(() => ({ getItem: key => storage.getItem(key), setItem: (key, value) => { if (fail) throw new Error('Quota');storage.setItem(key, value); } }));
    expect(preferences.update({ volume: 31, slow: true })).toBe(false);
    expect(preferences.getSnapshot()).toMatchObject({ value: { volume: 31, slow: true }, dirty: true, persisted: false, problem: 'write_failed' });
    storage.data.set(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, ...DEFAULT_PREFERENCES, volume: 80 }));preferences.reload();
    expect(preferences.getSnapshot().value.volume).toBe(31);fail = false;expect(preferences.retry()).toBe(true);
    expect(decodePreferences(storage.getItem(SETTINGS_KEY))?.volume).toBe(31);expect(storage.writes).toEqual([SETTINGS_KEY]);
  });
  it('recovers denied storage without blocking preference use or touching a game', () => {
    const storage = new MemoryStorage();let denied = true;
    const preferences = createPreferences(() => { if (denied) throw new Error('Policy');return storage; });
    expect(preferences.getSnapshot().problem).toBe('read_failed');preferences.update({ reducedMotion: true });
    expect(preferences.getSnapshot().value.reducedMotion).toBe(true);denied = false;expect(preferences.retry()).toBe(true);
    expect(storage.writes).toEqual([SETTINGS_KEY]);
  });
  it('adopts a clean external change and stops notifying after unsubscribe', () => {
    const storage = new MemoryStorage(), preferences = createPreferences(() => storage), values: number[] = [];
    const unsubscribe = preferences.subscribe(value => values.push(value.value.volume));
    storage.data.set(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, ...DEFAULT_PREFERENCES, volume: 77 }));preferences.reload();
    expect(values).toEqual([55,77]);unsubscribe();preferences.update({ volume: 22 });expect(values).toEqual([55,77]);
  });
  it('does not lose a known mute choice after a transient reread failure', () => {
    const storage = new MemoryStorage(), preferences = createPreferences(() => storage);preferences.update({ muted: true, volume: 12 });
    const writes = [...storage.writes];storage.failRead = true;preferences.reload();
    expect(preferences.getSnapshot()).toMatchObject({ value: { muted: true, volume: 12 }, problem: 'read_failed', persisted: false });
    expect(storage.writes).toEqual(writes);storage.failRead = false;preferences.reload();expect(preferences.getSnapshot()).toMatchObject({ value: { muted: true, volume: 12 }, problem: null, persisted: true });
  });
});
