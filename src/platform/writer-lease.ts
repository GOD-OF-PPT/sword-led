export const WRITER_LOCK = 'sword-led.writer';
export type LeaseOutcome = 'writer' | 'readonly' | 'unsupported' | 'cancelled' | 'error' | 'disposed';
export interface LockHost {
  request(name: string, options: { mode: 'exclusive'; ifAvailable: true }, callback: (lock: object | null) => Promise<void>): Promise<void>;
}
export interface WriterLease {
  acquire(): Promise<LeaseOutcome>;
  release(): Promise<void>;
  owns(): boolean;
  dispose(): Promise<void>;
}

export function createWriterLease(host?: LockHost): WriterLease {
  let generation = 0;
  let held = false;
  let disposed = false;
  let releaseHold: (() => void) | undefined;
  let requestDone: Promise<void> = Promise.resolve();
  let pending: Promise<LeaseOutcome> | null = null;
  const release = (): Promise<void> => {
    generation++;
    held = false;
    releaseHold?.();
    releaseHold = undefined;
    pending = null;
    return requestDone;
  };
  return {
    owns: () => held && !disposed,
    release,
    dispose: () => { disposed = true; return release(); },
    acquire: () => {
      if (disposed) return Promise.resolve('disposed');
      if (!host) return Promise.resolve('unsupported');
      if (held) return Promise.resolve('writer');
      if (pending) return pending;
      const token = ++generation;
      const prior = requestDone;
      const ready: Promise<LeaseOutcome> = prior.then(() => new Promise<LeaseOutcome>(resolve => {
        if (disposed || token !== generation) { resolve('cancelled'); return; }
        try {
          requestDone = host.request(WRITER_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
            if (disposed || token !== generation) { resolve('cancelled'); return; }
            if (lock === null) { resolve('readonly'); return; }
            const hold = new Promise<void>(done => { releaseHold = done; });
            held = true;
            resolve('writer');
            await hold;
            if (token === generation) { held = false; releaseHold = undefined; }
          }).catch(() => {
            if (token === generation) { held = false; releaseHold?.(); releaseHold = undefined; }
            resolve('error');
          });
        } catch { resolve('error'); }
      }));
      pending = ready;
      void ready.then(() => { if (pending === ready) pending = null; });
      return ready;
    },
  };
}
