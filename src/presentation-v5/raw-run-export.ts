import {V5_SAVE_KEY, V5_BACKUP_KEY} from '../application/v5-persistence.js';
import type {StorageLike} from '../platform/storage.js';

type RunSlotKey = typeof V5_SAVE_KEY | typeof V5_BACKUP_KEY;
export type RawRunExportSlot =
 | {readonly key: RunSlotKey; readonly ok: true; readonly raw: string | null}
 | {readonly key: RunSlotKey; readonly ok: false; readonly error: 'storage_read_failed'};
export interface RawRunExport {
 readonly format: 'sword-led.disk-run-export.v1';
 readonly capturedAt: string;
 readonly slots: {readonly main: RawRunExportSlot; readonly backup: RawRunExportSlot};
}

/** Preserve disk text for recovery. This is neither a decoded run nor an importable save. */
export function readRawRunExport(
 storage: () => Pick<StorageLike, 'getItem'>,
 now: () => string = () => new Date().toISOString(),
): RawRunExport {
 const read = (key: RunSlotKey): RawRunExportSlot => {
  try { return {key, ok: true, raw: storage().getItem(key)}; }
  catch { return {key, ok: false, error: 'storage_read_failed'}; }
 };
 return {
  format: 'sword-led.disk-run-export.v1',
  capturedAt: now(),
  // Access each slot independently: one blocked read must not hide the other original.
  slots: {main: read(V5_SAVE_KEY), backup: read(V5_BACKUP_KEY)},
 };
}
