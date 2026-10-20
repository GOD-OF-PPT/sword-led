import { applyCommand, createRun } from '../core/index.js';
import type { CreateRunInput, DomainEvent, ErrorCode, RunState } from '../core/index.js';
import { freezeDeep } from '../core/immutable.js';
import type { SaveReport, SaveRepository, SaveWrite } from '../platform/storage.js';
import type { WriterLease } from '../platform/writer-lease.js';

export type SessionMode = 'inactive' | 'writer' | 'readonly' | 'unsupported' | 'error' | 'memory' | 'disposed';
export type SessionError = 'not_active' | 'readonly' | 'locks_unsupported' | 'disposed' | 'no_run'
  | 'confirmation_required' | 'save_unavailable' | 'save_conflict' | 'backup_unavailable'
  | 'main_available' | 'stale_session';
export interface SessionSnapshot<S = RunState> {
  readonly generation: number;
  readonly mode: SessionMode;
  readonly active: boolean;
  readonly state: S | null;
  readonly dirty: boolean;
  readonly conflict: boolean;
  readonly load: SaveReport<S> | null;
  readonly lastSave: SaveWrite | null;
}
export interface Decision { readonly generation: number; readonly confirmed: boolean }
export type SessionResult<S = RunState, E extends string = ErrorCode> =
  | { readonly ok: true; readonly snapshot: SessionSnapshot<S> }
  | { readonly ok: false; readonly error: SessionError | E; readonly snapshot: SessionSnapshot<S> };
export type SessionCommandResult<S = RunState, E extends string = ErrorCode, V = DomainEvent> =
  | { readonly ok: true; readonly state: S; readonly events: readonly V[]; readonly persistence: SaveWrite | null; readonly snapshot: SessionSnapshot<S> }
  | { readonly ok: false; readonly state: S | null; readonly error: SessionError | E; readonly events: readonly []; readonly snapshot: SessionSnapshot<S> };
export interface PersistentSession<S = RunState, I = CreateRunInput, E extends string = ErrorCode, V = DomainEvent> {
  getSnapshot(): SessionSnapshot<S>;
  subscribe(listener: (snapshot: SessionSnapshot<S>) => void): () => void;
  activate(): Promise<SessionSnapshot<S>>;
  startNewGame(input: I, decision: Decision): SessionResult<S,E>;
  resume(decision: Decision): SessionResult<S,E>;
  recoverBackup(decision: Decision): SessionResult<S,E>;
  useMemory(input: I | null, decision: Decision): SessionResult<S,E>;
  dispatch(command: unknown, generation: number): SessionCommandResult<S,E,V>;
  retrySave(generation: number): SessionResult<S,E>;
  notifyExternalChange(): void;
  suspend(): Promise<void>;
  dispose(): Promise<void>;
}

export function createPersistentSession(repository: SaveRepository, lease: WriterLease): PersistentSession {
  return createAdaptedSession<RunState,CreateRunInput,ErrorCode,DomainEvent>(repository, lease, { createRun, applyCommand });
}
export interface RuleAdapter<S,I,E extends string,V> {
  isTerminal?(state:S): boolean;
  createRun(input:I): {readonly ok:true;readonly state:S}|{readonly ok:false;readonly error:E};
  applyCommand(state:S,command:unknown): {readonly ok:true;readonly state:S;readonly events:readonly V[]}|{readonly ok:false;readonly state:S;readonly error:E;readonly events:readonly []};
}
export function createAdaptedSession<S extends {readonly phase:string},I,E extends string,V>(repository: SaveRepository<S>, lease: WriterLease, rules: RuleAdapter<S,I,E,V>): PersistentSession<S,I,E,V> {
  const isTerminal = rules.isTerminal ?? ((value:S) => value.phase === 'victory' || value.phase === 'defeat');
  let generation = 0;
  let activationEpoch = 0;
  let mode: SessionMode = 'inactive';
  let active = false;
  let state: S | null = null;
  let dirty = false;
  let conflict = false;
  let load: SaveReport<S> | null = null;
  let lastSave: SaveWrite | null = null;
  let workingBase: string | null | undefined;
  const listeners = new Set<(snapshot: SessionSnapshot<S>) => void>();
  const getSnapshot = (): SessionSnapshot<S> => freezeDeep({ generation, mode, active, state, dirty, conflict, load, lastSave });
  const publish = () => {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      try { listener(snapshot); } catch { /* A view listener cannot revoke an accepted command or its save. */ }
    }
  };
  const fail = (error: SessionError | E): SessionResult<S,E> => ({ ok: false, error, snapshot: getSnapshot() });
  const success = (): SessionResult<S,E> => ({ ok: true, snapshot: getSnapshot() });
  const invalidate = () => { generation++; activationEpoch++; };
  const conflictAfterRead = () => {
    conflict = true;
    dirty = state !== null;
    invalidate();
    publish();
  };
  const needsReplacement = (report: SaveReport<S>) =>
    (report.main.status === 'valid' && !isTerminal(report.main.state))
    || report.main.status === 'invalid' || (report.main.status === 'empty' && report.backup.status === 'valid');
  const permission = (expected: number, allowConflict = false): SessionError | null => {
    if (mode === 'disposed') return 'disposed';
    if (expected !== generation) return 'stale_session';
    if (!active) return 'not_active';
    if (mode === 'memory') return null;
    if (mode === 'unsupported') return 'locks_unsupported';
    if (mode !== 'writer' || !lease.owns()) return 'readonly';
    return conflict && !allowConflict ? 'save_conflict' : null;
  };
  const saveCurrent = (): SaveWrite | null => {
    if (state === null || mode === 'memory') { dirty = state !== null; lastSave = null; return null; }
    lastSave = lease.owns() ? repository.write(state, { raw: workingBase })
      : { ok: false, error: 'storage_conflict', detail: 'Writer lease was lost.' };
    dirty = !lastSave.ok;
    if (lastSave.ok) workingBase = repository.token();
    if (!lastSave.ok && lastSave.error === 'storage_conflict') conflict = true;
    return lastSave;
  };
  const session: PersistentSession<S,I,E,V> = {
    getSnapshot,
    subscribe: listener => {
      listeners.add(listener);
      try { listener(getSnapshot()); } catch { /* Keep storage independent of view failures. */ }
      return () => { listeners.delete(listener); };
    },
    activate: async () => {
      if (mode === 'disposed') return getSnapshot();
      const token = ++activationEpoch;
      generation++;
      if (mode === 'memory') { active = true; publish(); return getSnapshot(); }
      active = false;
      const previous = state;
      const wasDirty = dirty;
      const baseline = workingBase;
      const result = await lease.acquire();
      if (token !== activationEpoch) return getSnapshot();
      active = result !== 'cancelled' && result !== 'disposed';
      mode = result === 'writer' ? 'writer' : result === 'readonly' ? 'readonly'
        : result === 'unsupported' ? 'unsupported' : 'error';
      load = repository.load();
      if (previous && (wasDirty || load.main.status !== 'valid')) {
        state = previous;
        dirty = true;
        conflict = baseline !== repository.token();
      } else {
        state = load.main.status === 'valid' ? load.main.state : null;
        workingBase = repository.token();
        dirty = false;
        conflict = false;
      }
      lastSave = null;
      publish();
      return getSnapshot();
    },
    startNewGame: (input, decision) => {
      const denied = permission(decision.generation, true);
      if (denied) return fail(denied);
      const created = rules.createRun(input);
      if (!created.ok) return fail(created.error);
      if (mode === 'memory') {
        if (state && decision.confirmed !== true) return fail('confirmation_required');
      } else {
        const observed = repository.inspect();
        if (observed.main.status === 'unavailable') return fail('save_unavailable');
        const localOngoing = state !== null && !isTerminal(state);
        if ((needsReplacement(observed) || localOngoing || dirty) && decision.confirmed !== true) return fail('confirmation_required');
        load = repository.load();
        if (load.main.status === 'unavailable') { conflictAfterRead(); return fail('save_unavailable'); }
        if (needsReplacement(load) && decision.confirmed !== true) { conflictAfterRead(); return fail('confirmation_required'); }
      }
      invalidate();
      state = created.state;
      workingBase = mode === 'memory' ? undefined : repository.token();
      dirty = true;
      conflict = false;
      saveCurrent();
      publish();
      return success();
    },
    resume: decision => {
      const denied = permission(decision.generation, true);
      if (denied) return fail(denied);
      if (mode === 'memory') return fail('save_unavailable');
      if (dirty && decision.confirmed !== true) return fail('confirmation_required');
      const observed = repository.inspect();
      if (observed.main.status !== 'valid') return fail('save_unavailable');
      load = repository.load();
      if (load.main.status !== 'valid') { conflictAfterRead(); return fail('save_unavailable'); }
      state = load.main.state;
      workingBase = repository.token();
      dirty = false;
      conflict = false;
      lastSave = null;
      invalidate();
      publish();
      return success();
    },
    recoverBackup: decision => {
      const denied = permission(decision.generation, true);
      if (denied) return fail(denied);
      if (mode === 'memory') return fail('save_unavailable');
      if (decision.confirmed !== true) return fail('confirmation_required');
      const observed = repository.inspect();
      if (observed.main.status === 'valid') return fail('main_available');
      if (observed.main.status === 'unavailable' || observed.backup.status !== 'valid') return fail('backup_unavailable');
      load = repository.load();
      if (load.main.status === 'valid') { conflictAfterRead(); return fail('main_available'); }
      if (load.main.status === 'unavailable' || load.backup.status !== 'valid') { conflictAfterRead(); return fail('backup_unavailable'); }
      state = load.backup.state;
      workingBase = repository.token();
      conflict = false;
      dirty = true;
      invalidate();
      saveCurrent();
      publish();
      return success();
    },
    useMemory: (input, decision) => {
      if (mode === 'disposed') return fail('disposed');
      if (decision.generation !== generation) return fail('stale_session');
      if (input !== null && state && decision.confirmed !== true) return fail('confirmation_required');
      const created = input === null ? null : rules.createRun(input);
      if (created && !created.ok) return fail(created.error);
      if (!created && !state) return fail('no_run');
      invalidate();
      void lease.release();
      if (created?.ok) state = created.state;
      workingBase = undefined;
      mode = 'memory'; active = true; dirty = true; conflict = false; lastSave = null;
      publish();
      return success();
    },
    dispatch: (command, expected) => {
      const denied = permission(expected);
      if (denied || state === null) return { ok: false, state, error: denied ?? 'no_run', events: [], snapshot: getSnapshot() };
      const result = rules.applyCommand(state, command);
      if (!result.ok) return { ...result, snapshot: getSnapshot() };
      state = result.state;
      dirty = true;
      const persistence = saveCurrent();
      publish();
      return { ...result, persistence, snapshot: getSnapshot() };
    },
    retrySave: expected => {
      const denied = permission(expected);
      if (denied) return fail(denied);
      if (mode === 'memory') return fail('save_unavailable');
      if (!state) return fail('no_run');
      if (dirty) { saveCurrent(); publish(); }
      return dirty ? fail(conflict ? 'save_conflict' : 'save_unavailable') : success();
    },
    notifyExternalChange: () => {
      if (mode === 'disposed' || mode === 'memory') return;
      if (!repository.isCurrent({ raw: workingBase })) {
        conflict = true;
        generation++;
      }
      // Keep the last observed baseline attached to retained memory. Only explicit activation/resume adopts a new slot.
      publish();
    },
    suspend: () => {
      invalidate(); active = false;
      if (mode !== 'disposed' && mode !== 'memory') mode = 'inactive';
      const released = lease.release();
      publish();
      return released;
    },
    dispose: () => {
      invalidate(); active = false; mode = 'disposed';
      const released = lease.dispose();
      publish(); listeners.clear();
      return released;
    },
  };
  return session;
}
