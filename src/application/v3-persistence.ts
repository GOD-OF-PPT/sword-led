import {createAdaptedSession} from './persistent-session.js';
import type {PersistentSession} from './persistent-session.js';
import {bindBrowserSession} from '../platform/browser-session.js';
import {createWriterLease} from '../platform/writer-lease.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,StorageLike} from '../platform/storage.js';
import {createRun,applyCommand,validateRun} from '../core-v3/index.js';
import type {RunState,CreateRunInput,ErrorCode,DomainEvent} from '../core-v3/index.js';
export const V3_SAVE_KEY='sword-led.save.v3',V3_BACKUP_KEY='sword-led.save.backup.v3';
export const V3_CODEC:SaveCodec<RunState>=Object.freeze({key:V3_SAVE_KEY,backupKey:V3_BACKUP_KEY,schemaVersion:3,rulesVersion:'forge-v3',validate:validateRun});
export type V3Session=PersistentSession<RunState,CreateRunInput,ErrorCode,DomainEvent>;
export const decodeV3Save=(raw:string|null)=>decodeStoredSave(raw,V3_CODEC);
export const createV3SaveRepository=(storage:()=>StorageLike,now?:()=>string)=>createAdaptedSaveRepository(storage,V3_CODEC,now);
export function createV3BrowserSession(target:Window=window):V3Session{
  return bindBrowserSession(target,V3_SAVE_KEY,host=>createAdaptedSession<RunState,CreateRunInput,ErrorCode,DomainEvent>(createV3SaveRepository(()=>target.localStorage),createWriterLease(host),{createRun,applyCommand}));
}
