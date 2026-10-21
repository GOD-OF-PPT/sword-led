import {describe, expect, it, vi} from 'vitest';
import {V5_SAVE_KEY, V5_BACKUP_KEY} from '../../src/application/v5-persistence.js';
import {readRawRunExport} from '../../src/presentation-v5/raw-run-export.js';

const capturedAt = '2026-10-21T09:10:11.000Z';
const at = () => capturedAt;

describe('raw v5 disk-run export', () => {
 it('preserves non-JSON and newer-schema originals without decoding or Unicode normalization', () => {
  const main = '  非JSON原件\r\n锤🔥 e\u0301\u0000\t尾部 \n';
  const backup = '{\r\n "schemaVersion": 999, "rulesVersion": "未来规则", "state": "剑🗡️ e\u0301"\r\n}\n';
  const slots = new Map<string, string>([[V5_SAVE_KEY, main], [V5_BACKUP_KEY, backup]]);
  const getItem = vi.fn((key: string) => slots.get(key) ?? null);
  const result = readRawRunExport(() => ({getItem}), at);

  expect(result).toEqual({
   format: 'sword-led.disk-run-export.v1', capturedAt,
   slots: {main: {key: V5_SAVE_KEY, ok: true, raw: main}, backup: {key: V5_BACKUP_KEY, ok: true, raw: backup}},
  });
  expect(getItem.mock.calls.map(([key]) => key)).toEqual([V5_SAVE_KEY, V5_BACKUP_KEY]);
 });

 it('distinguishes a missing slot from an unreadable slot', () => {
  const result = readRawRunExport(() => ({getItem: () => null}), at);
  expect(result.slots).toEqual({
   main: {key: V5_SAVE_KEY, ok: true, raw: null},
   backup: {key: V5_BACKUP_KEY, ok: true, raw: null},
  });
 });

 it.each([V5_SAVE_KEY, V5_BACKUP_KEY])('keeps the other original when %s cannot be read', deniedKey => {
  const main = '坏主档原文\n', backup = '备份原文\r\n';
  const getItem = vi.fn((key: string) => {
   if (key === deniedKey) throw new Error('Read denied');
   return key === V5_SAVE_KEY ? main : backup;
  });
  const result = readRawRunExport(() => ({getItem}), at);

  expect(result.slots.main).toEqual(deniedKey === V5_SAVE_KEY
   ? {key: V5_SAVE_KEY, ok: false, error: 'storage_read_failed'}
   : {key: V5_SAVE_KEY, ok: true, raw: main});
  expect(result.slots.backup).toEqual(deniedKey === V5_BACKUP_KEY
   ? {key: V5_BACKUP_KEY, ok: false, error: 'storage_read_failed'}
   : {key: V5_BACKUP_KEY, ok: true, raw: backup});
  expect(getItem.mock.calls.map(([key]) => key)).toEqual([V5_SAVE_KEY, V5_BACKUP_KEY]);
 });

 it('marks both failures when access to storage itself is blocked', () => {
  const storage = vi.fn(() => { throw new Error('Storage getter denied'); });
  const result = readRawRunExport(storage, at);
  expect(result.slots).toEqual({
   main: {key: V5_SAVE_KEY, ok: false, error: 'storage_read_failed'},
   backup: {key: V5_BACKUP_KEY, ok: false, error: 'storage_read_failed'},
  });
  expect(storage).toHaveBeenCalledTimes(2);
 });

 it('retries storage access independently for the backup after a main accessor failure', () => {
  let accesses = 0;
  const getItem = vi.fn(() => '可带走的备份原文');
  const result = readRawRunExport(() => {
   if (++accesses === 1) throw new Error('First storage access denied');
   return {getItem};
  }, at);

  expect(result.slots.main).toEqual({key: V5_SAVE_KEY, ok: false, error: 'storage_read_failed'});
  expect(result.slots.backup).toEqual({key: V5_BACKUP_KEY, ok: true, raw: '可带走的备份原文'});
  expect(getItem).toHaveBeenCalledWith(V5_BACKUP_KEY);
  expect(accesses).toBe(2);
 });

 it('touches only the v5 disk-run keys and never writes, removes or clears storage', () => {
  const originals = new Map<string, string>([
   [V5_SAVE_KEY, '主原文'], [V5_BACKUP_KEY, '备原文'],
   ['sword-led.save.v4', '旧行程保持'], ['sword-led.collection.v2', '炉谱保持'],
  ]);
  const before = [...originals.entries()];
  const storage = {
   getItem: vi.fn((key: string) => originals.get(key) ?? null),
   setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  };
  readRawRunExport(() => storage, at);

  expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([V5_SAVE_KEY, V5_BACKUP_KEY]);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(storage.clear).not.toHaveBeenCalled();
  expect([...originals.entries()]).toEqual(before);
 });
});
