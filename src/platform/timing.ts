import type { HammerMode } from '../core/index.js';

export interface InputIdentity {
  readonly runId: string; readonly revision: number; readonly generation: number; readonly epoch: number;
  readonly pieceId: string; readonly mode: HammerMode; readonly periodMs: number;
  readonly rulesVersion?: string; readonly node?: number;
}
export interface Attempt { readonly id: number; readonly owner: string; readonly startedAt: number; readonly identity: InputIdentity }
export interface ReleasedAttempt extends Attempt { readonly timingMark: number }

export function timingMarkAt(elapsedMs: number, periodMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(periodMs) || periodMs <= 0) return 0;
  const phase = (Math.max(0, elapsedMs) % periodMs) / periodMs;
  return Math.round((1 - Math.abs(2 * phase - 1)) * 10000);
}
export function sameInput(a: InputIdentity, b: InputIdentity | null): boolean {
  return b !== null && a.runId === b.runId && a.revision === b.revision && a.generation === b.generation
    && a.epoch === b.epoch && a.pieceId === b.pieceId && a.mode === b.mode && a.periodMs === b.periodMs
    && a.rulesVersion === b.rulesVersion && a.node === b.node;
}

export class StrikeAttempt {
  #current: Attempt | null = null;
  #sequence = 0;
  get current(): Attempt | null { return this.#current; }
  start(identity: InputIdentity | null, owner: string, stamp: number): boolean {
    if (this.#current || !identity || !Number.isFinite(stamp) || stamp < 0 || !Number.isFinite(identity.periodMs) || identity.periodMs <= 0) return false;
    this.#current = Object.freeze({ id: ++this.#sequence, owner, startedAt: stamp, identity: Object.freeze({ ...identity }) });
    return true;
  }
  cancel(): void { this.#current = null; }
  release(owner: string, stamp: number, latest: InputIdentity | null): ReleasedAttempt | null {
    const attempt = this.#current;
    if (!attempt || attempt.owner !== owner) return null;
    this.#current = null;
    if (!sameInput(attempt.identity, latest) || !Number.isFinite(stamp) || stamp < attempt.startedAt) return null;
    return Object.freeze({ ...attempt, timingMark: timingMarkAt(stamp - attempt.startedAt, attempt.identity.periodMs) });
  }
}
