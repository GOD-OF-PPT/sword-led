import type { RunState } from '../core/index.js';
import { validateRun } from '../core/index.js';
import { isRecord } from '../core/guards.js';
import { MAX_SAVE_BYTES } from '../core/validate.js';
import { RULES_VERSION } from '../core/rules.js';

export const SAVE_KEY = 'sword-led.save.v1';
export const BACKUP_KEY = 'sword-led.save.backup.v1';
export type SaveError = 'save_too_large' | 'invalid_json' | 'unsupported_schema' | 'unsupported_rules'
  | 'invalid_timestamp' | 'invalid_state' | 'storage_read_failed' | 'storage_write_failed'
  | 'serialization_failed' | 'storage_conflict';
export type SaveRead =
  | { readonly status: 'empty' }
  | { readonly status: 'valid'; readonly state: RunState; readonly savedAt: string }
  | { readonly status: 'invalid' | 'unavailable'; readonly error: SaveError; readonly detail: string };
export interface SaveReport { readonly main: SaveRead; readonly backup: SaveRead }
export interface SaveBase { readonly raw: string | null | undefined }
export type SaveWrite =
  | { readonly ok: true; readonly savedAt: string; readonly backupWarning: boolean }
  | { readonly ok: false; readonly error: SaveError; readonly detail: string };
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SaveRepository {
  load(): SaveReport;
  inspect(): SaveReport;
  token(): string | null | undefined;
  isCurrent(expected?: SaveBase): boolean;
  write(state: RunState, expected?: SaveBase): SaveWrite;
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 24) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

export function decodeSave(raw: string | null): SaveRead {
  if (raw === null) return { status: 'empty' };
  if (raw.length > MAX_SAVE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) {
    return { status: 'invalid', error: 'save_too_large', detail: 'Save exceeds 256 KiB.' };
  }
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { status: 'invalid', error: 'invalid_json', detail: 'Save is not valid JSON.' }; }
  if (!isRecord(data) || Object.keys(data).sort().join(',') !== 'rulesVersion,savedAt,schemaVersion,state' || data.schemaVersion !== 1) {
    return { status: 'invalid', error: 'unsupported_schema', detail: 'Unsupported save envelope/schema.' };
  }
  if (data.rulesVersion !== RULES_VERSION) return { status: 'invalid', error: 'unsupported_rules', detail: 'Save uses different rules.' };
  if (!validTimestamp(data.savedAt)) return { status: 'invalid', error: 'invalid_timestamp', detail: 'Invalid save timestamp.' };
  const checked = validateRun(data.state, RULES_VERSION);
  return checked.ok ? { status: 'valid', state: checked.state, savedAt: data.savedAt }
    : { status: 'invalid', error: checked.error === 'invalid_rules_version' ? 'unsupported_rules' : 'invalid_state', detail: checked.detail };
}

export function createSaveRepository(storage: () => StorageLike, now: () => string = () => new Date().toISOString()): SaveRepository {
  let baseline: string | null | undefined;
  let lastValidMain: string | undefined;
  const read = (adopt: boolean): SaveReport => {
    let rawMain: string | null | undefined;
    let main: SaveRead;
    let backup: SaveRead;
    let host: StorageLike;
    try { host = storage(); } catch {
      const unavailable: SaveRead = { status: 'unavailable', error: 'storage_read_failed', detail: 'Storage access was denied.' };
      if (adopt) { baseline = undefined; lastValidMain = undefined; }
      return { main: unavailable, backup: unavailable };
    }
    try { rawMain = host.getItem(SAVE_KEY); main = decodeSave(rawMain); }
    catch { main = { status: 'unavailable', error: 'storage_read_failed', detail: 'Primary save could not be read.' }; }
    try { backup = decodeSave(host.getItem(BACKUP_KEY)); }
    catch { backup = { status: 'unavailable', error: 'storage_read_failed', detail: 'Backup could not be read.' }; }
    if (adopt) { baseline = rawMain; lastValidMain = main.status === 'valid' ? rawMain ?? undefined : undefined; }
    return { main, backup };
  };
  return {
    load: () => read(true),
    inspect: () => read(false),
    token: () => baseline,
    isCurrent: expected => {
      const raw = expected ? expected.raw : baseline;
      try { return raw !== undefined && storage().getItem(SAVE_KEY) === raw; } catch { return false; }
    },
    write: (state, expected) => {
      const base = expected ? expected.raw : baseline;
      if (base === undefined) return { ok: false, error: 'storage_read_failed', detail: 'Load the slot before writing.' };
      let host: StorageLike;
      let current: string | null;
      try {
        host = storage();
        current = host.getItem(SAVE_KEY);
        if (current !== base) return { ok: false, error: 'storage_conflict', detail: 'Another writer changed the save.' };
      } catch { return { ok: false, error: 'storage_read_failed', detail: 'Primary save could not be checked.' }; }
      let serialized: string;
      let savedAt: string;
      try {
        savedAt = now();
        if (!validTimestamp(savedAt)) return { ok: false, error: 'serialization_failed', detail: 'Clock returned an invalid timestamp.' };
        serialized = JSON.stringify({ schemaVersion: 1, rulesVersion: RULES_VERSION, savedAt, state });
        if (new TextEncoder().encode(serialized).byteLength > MAX_SAVE_BYTES) {
          return { ok: false, error: 'save_too_large', detail: 'Save exceeds 256 KiB.' };
        }
      } catch { return { ok: false, error: 'serialization_failed', detail: 'Save could not be serialized.' }; }
      let backupWarning = false;
      const previous = current !== null && (current === lastValidMain || decodeSave(current).status === 'valid') ? current : undefined;
      if (previous !== undefined && previous !== serialized) {
        try { host.setItem(BACKUP_KEY, previous); } catch { backupWarning = true; }
      }
      try { host.setItem(SAVE_KEY, serialized); }
      catch { return { ok: false, error: 'storage_write_failed', detail: 'Primary write failed; in-memory progress is not saved.' }; }
      baseline = serialized;
      lastValidMain = serialized;
      return { ok: true, savedAt, backupWarning };
    },
  };
}
