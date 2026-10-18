import { createPersistentSession } from '../../src/application/persistent-session.js';
import type { Decision, PersistentSession } from '../../src/application/persistent-session.js';
import { BACKUP_KEY, SAVE_KEY, createSaveRepository } from '../../src/platform/storage.js';
import type { StorageLike } from '../../src/platform/storage.js';
import { createWriterLease } from '../../src/platform/writer-lease.js';
import type { LockHost } from '../../src/platform/writer-lease.js';
import type { Action } from '../../src/core/index.js';

export class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  readonly writes: string[] = [];
  failMain = false;
  failBackup = false;
  failRead = false;
  getItem(key: string): string | null {
    if (this.failRead) throw new Error('Read denied');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if ((key === SAVE_KEY && this.failMain) || (key === BACKUP_KEY && this.failBackup)) throw new Error('Quota denied');
    this.writes.push(key);
    this.data.set(key, value);
  }
}

export class TestLocks implements LockHost {
  held = false;
  readonly requests: { name: string; mode: string; ifAvailable: boolean }[] = [];
  async request(name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: object | null) => Promise<void>): Promise<void> {
    this.requests.push({ name, ...options });
    await Promise.resolve();
    if (this.held) { await callback(null); return; }
    this.held = true;
    try { await callback({ name }); } finally { this.held = false; }
  }
}

export const FIXED_TIME = '2026-10-18T02:00:00.000Z';
export function repository(storage: MemoryStorage) { return createSaveRepository(() => storage, () => FIXED_TIME); }
export function session(storage = new MemoryStorage(), locks: LockHost | undefined = new TestLocks()): PersistentSession {
  return createPersistentSession(repository(storage), createWriterLease(locks));
}
export function decision(current: PersistentSession, confirmed = false): Decision {
  return { generation: current.getSnapshot().generation, confirmed };
}
export function command(current: PersistentSession, action: Action) {
  const snapshot = current.getSnapshot();
  if (!snapshot.state) throw new Error('No active scenario');
  return current.dispatch({ runId: snapshot.state.runId, expectedRevision: snapshot.state.revision, action }, snapshot.generation);
}
