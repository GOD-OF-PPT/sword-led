import { createPersistentSession } from '../application/persistent-session.js';
import type { PersistentSession } from '../application/persistent-session.js';
import { createSaveRepository, SAVE_KEY } from './storage.js';
import { createWriterLease } from './writer-lease.js';
import type { LockHost } from './writer-lease.js';

export function createBrowserSession(target: Window = window): PersistentSession {
  return bindBrowserSession(target, SAVE_KEY, host => createPersistentSession(createSaveRepository(() => target.localStorage), createWriterLease(host)));
}
interface BrowserLifecycle {
  activate(): Promise<unknown>; suspend(): Promise<void>; dispose(): Promise<void>; notifyExternalChange(): void;
}
export function bindBrowserSession<T extends BrowserLifecycle>(target:Window, saveKey:string, factory:(host:LockHost|undefined)=>T) {
  let host: LockHost | undefined;
  try {
    if (target.isSecureContext && target.navigator.locks) {
      const locks = target.navigator.locks;
      host = { request: (name, options, callback) => locks.request(name, options, callback) };
    }
  } catch { host = undefined; }
  const session = factory(host);
  const onHide = () => { void session.suspend(); };
  const onShow = (event: PageTransitionEvent) => { if (event.persisted) void session.activate(); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === saveKey || event.key === null) session.notifyExternalChange();
  };
  target.addEventListener('pagehide', onHide);
  target.addEventListener('pageshow', onShow);
  target.addEventListener('storage', onStorage);
  return { ...session, dispose: () => {
    target.removeEventListener('pagehide', onHide);
    target.removeEventListener('pageshow', onShow);
    target.removeEventListener('storage', onStorage);
    return session.dispose();
  } };
}
