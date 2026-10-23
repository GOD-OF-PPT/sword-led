export * from './core-v6/index.js';
export {V6_SAVE_KEY,V6_BACKUP_KEY,V6_WRITER_LOCK,V6_CODEC,decodeV6Save,createV6SaveRepository,
 createV6WriterLease,createV6Session,createV6BrowserSession} from './application/v6-persistence.js';
export type {V6Session,V6SessionSnapshot,V6SessionResult,V6SessionCommandResult,V6ApplicationError,
 V6NewGameInput,V6Decision,V6SaveRead,V6SaveRepository} from './application/v6-persistence.js';
