import { createAdaptedSession } from './persistent-session.js';
import type { PersistentSession } from './persistent-session.js';
import { bindBrowserSession } from '../platform/browser-session.js';
import { createWriterLease } from '../platform/writer-lease.js';
import { createAdaptedSaveRepository, decodeStoredSave } from '../platform/storage.js';
import type { SaveCodec, StorageLike } from '../platform/storage.js';
import { createRun, applyCommand, validateRun } from '../core-v2/index.js';
import type { RunState, CreateRunInput, ErrorCode, DomainEvent } from '../core-v2/index.js';

export const V2_SAVE_KEY='sword-led.save.v2';
export const V2_BACKUP_KEY='sword-led.save.backup.v2';
export const V2_CODEC:SaveCodec<RunState>=Object.freeze({key:V2_SAVE_KEY,backupKey:V2_BACKUP_KEY,schemaVersion:2,rulesVersion:'forge-v2',validate:validateRun});
export type V2Session=PersistentSession<RunState,CreateRunInput,ErrorCode,DomainEvent>;
export const decodeV2Save=(raw:string|null)=>decodeStoredSave(raw,V2_CODEC);
export const createV2SaveRepository=(storage:()=>StorageLike,now?:()=>string)=>createAdaptedSaveRepository(storage,V2_CODEC,now);
export function createV2BrowserSession(target:Window=window):V2Session {
  return bindBrowserSession(target,V2_SAVE_KEY,host=>createAdaptedSession<RunState,CreateRunInput,ErrorCode,DomainEvent>(
    createV2SaveRepository(()=>target.localStorage),createWriterLease(host),{createRun,applyCommand}));
}
