import type * as Core from '../../src/core/index.js';
import type { PersistentSession, SessionSnapshot } from '../../src/application/persistent-session.js';

declare global {
  interface Window {
    storageTest: {
      session: PersistentSession;
      core: typeof Core;
      SAVE_KEY: string;
      BACKUP_KEY: string;
      ready: Promise<SessionSnapshot>;
      lastPageShowPersisted: boolean;
    };
  }
}
export {};
