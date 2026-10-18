import type { StorageLike } from './storage.js';

export const SETTINGS_KEY = 'sword-led.settings.v1';
export interface Preferences { readonly muted: boolean; readonly volume: number; readonly slow: boolean; readonly reducedMotion: boolean }
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ muted: false, volume: 55, slow: false, reducedMotion: false });
export type SettingsProblem = 'invalid' | 'read_failed' | 'write_failed' | null;
export interface PreferencesSnapshot { readonly value: Preferences; readonly dirty: boolean; readonly persisted: boolean; readonly problem: SettingsProblem }
function valid(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).sort().join(',') === 'muted,reducedMotion,slow,volume' && typeof data.muted === 'boolean'
    && typeof data.slow === 'boolean' && typeof data.reducedMotion === 'boolean'
    && typeof data.volume === 'number' && Number.isInteger(data.volume) && data.volume >= 0 && data.volume <= 100;
}
export function decodePreferences(raw: string | null): Preferences | null {
  if (raw === null) return DEFAULT_PREFERENCES;
  if (raw.length > 4096 || new TextEncoder().encode(raw).byteLength > 4096) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !('schemaVersion' in data) || data.schemaVersion !== 1) return null;
    const { schemaVersion: ignored, ...value } = data;
    return valid(value) ? Object.freeze(value) : null;
  } catch { return null; }
}

export function createPreferences(storage: () => StorageLike) {
  let snapshot: PreferencesSnapshot = Object.freeze({ value: DEFAULT_PREFERENCES, dirty: false, persisted: false, problem: null });
  const listeners = new Set<(value: PreferencesSnapshot) => void>();
  const publish = () => { for (const listener of listeners) listener(snapshot); };
  const load = () => {
    if (snapshot.dirty) return;
    try {
      const raw = storage().getItem(SETTINGS_KEY), value = decodePreferences(raw);
      snapshot = Object.freeze({ value: value ?? snapshot.value, dirty: false, persisted: raw !== null && value !== null, problem: value ? null : 'invalid' });
    } catch { snapshot = Object.freeze({ value: snapshot.value, dirty: false, persisted: false, problem: 'read_failed' }); }
    publish();
  };
  const save = () => {
    try {
      storage().setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, ...snapshot.value }));
      snapshot = Object.freeze({ ...snapshot, dirty: false, persisted: true, problem: null });
    } catch { snapshot = Object.freeze({ ...snapshot, dirty: true, persisted: false, problem: 'write_failed' }); }
    publish();return !snapshot.dirty;
  };
  load();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: (value: PreferencesSnapshot) => void) { listeners.add(listener);listener(snapshot);return () => { listeners.delete(listener); }; },
    update(patch: Partial<Preferences>) {
      const value = { ...snapshot.value, ...patch };if (!valid(value)) return false;
      snapshot = Object.freeze({ value: Object.freeze(value), dirty: true, persisted: false, problem: null });return save();
    },
    retry: save,
    reload: load,
  };
}
