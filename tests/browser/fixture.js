import * as core from '/dist/sword-led-core.js';
import { createBrowserSession, SAVE_KEY, BACKUP_KEY } from '/dist/sword-led-session.js';

const session = createBrowserSession(window);
window.storageTest = { session, core, SAVE_KEY, BACKUP_KEY, ready: session.activate(), lastPageShowPersisted: false };
window.addEventListener('pageshow', event => { window.storageTest.lastPageShowPersisted = event.persisted; });
