import type { RunState } from '../../src/core/index.js';
export interface NativeUiCacheResult {
  browser: string; method: string; nativePersisted: boolean; pageShowTrusted: boolean; heapRetained: boolean;
  oldKeyupUnchanged: boolean; restoredStorage: string;
  inputReadiness: { activeBefore: string; activeAfter: string; strikeEnabled: boolean };
  before: RunState; changed: RunState; restored: RunState; finalState: RunState; errors: string[];
}
export function verifyNativeUiCache(baseURL: string): Promise<NativeUiCacheResult>;
