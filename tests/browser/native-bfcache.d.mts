export interface NativeCacheEvidence {
  browser: string;
  nativePersisted: boolean;
  heapRetained: boolean;
  restoredMode: string;
  latestRevision: number;
  staleRejected: string;
  resumedMode: string;
}
export function verifyNativeBfcache(baseURL: string): Promise<NativeCacheEvidence>;
