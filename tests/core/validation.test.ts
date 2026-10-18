import { beforeAll, describe, expect, it } from 'vitest';
import { getRunView, validateRun } from '../../src/core/index.js';
import type { RunState } from '../../src/core/index.js';
import { act, newRun } from './helpers';
import { firstMerchant } from './scenarios';

let merchant: RunState;
beforeAll(() => { merchant = firstMerchant(); });

describe('unknown save-state validation', () => {
  it('rebuilds immutable canonical state from mutable JSON, without freezing or trusting input', () => {
    const raw = structuredClone(merchant);
    const checked = validateRun(raw);
    expect(checked).toEqual({ ok: true, state: merchant });
    expect(Object.isFrozen(raw)).toBe(false);
    if (!checked.ok) throw new Error(checked.detail);
    expect(checked.state).not.toBe(raw);
    expect(Object.isFrozen(checked.state)).toBe(true);
    expect(Object.isFrozen(checked.state.journal[0])).toBe(true);
  });

  it('restores purchasing limits and the exact next random outcome', () => {
    const bought = act(merchant, { type: 'buy', productId: 'anvil' });
    const restored = validateRun(structuredClone(bought));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.detail);
    expect(getRunView(restored.state).merchant.offers.find(offer => offer.productId === 'anvil')?.availability)
      .toEqual({ allowed: false, reason: 'already_purchased' });
    const a = act(bought, { type: 'leaveMerchant' });
    const b = act(restored.state, { type: 'leaveMerchant' });
    expect(act(a, { type: 'strike', pieceId: '4:1', mode: 'heavy', timingMark: 0 }))
      .toEqual(act(b, { type: 'strike', pieceId: '4:1', mode: 'heavy', timingMark: 0 }));
  });

  it.each([null, [], 1, 'state', undefined, new Date(), { rulesVersion: 'legacy' }])('rejects invalid shape or rules: %j', raw => {
    expect(validateRun(raw).ok).toBe(false);
  });

  it.each([
    { coins: -1 }, { coins: 99999 }, { scrap: -1 }, { coal: 999 }, { seals: 0 },
    { revision: -1 }, { phase: 'victory' }, { phase: 'missing' }, { round: 13 },
    { upgrades: { handle: 5, bellows: 0, anvil: 0 } }, { stats: {} }, { history: [] },
    { purchases: [{ afterRound: 3, product: 'handle', level: 1, coins: 100, scrap: 3 }] },
    { rng: {} }, { extra: 'unknown' }, { journal: [] },
  ])('rejects inconsistent snapshot fields: %j', patch => {
    expect(validateRun({ ...merchant, ...patch }).ok).toBe(false);
  });

  it('rejects forged piece states, random state, history and successful-looking duplicate journals', () => {
    const changedPiece = { ...merchant, pieces: [{ ...merchant.pieces[0], status: 'active' }, merchant.pieces[1], merchant.pieces[2]] };
    expect(validateRun(changedPiece).ok).toBe(false);
    expect(validateRun({ ...merchant, rng: { ...merchant.rng, strike: { ...merchant.rng.strike, state: 0 } } }).ok).toBe(false);
    const bought = act(merchant, { type: 'buy', productId: 'handle' });
    expect(validateRun({ ...bought, purchases: [] }).ok).toBe(false);
    expect(validateRun({ ...bought, journal: [...bought.journal, { type: 'buy', productId: 'handle' }] }))
      .toMatchObject({ ok: false, error: 'invalid_journal' });
    expect(validateRun({ ...merchant, journal: [...merchant.journal, { type: 'buy', productId: 'toString' }] }))
      .toMatchObject({ ok: false, error: 'invalid_journal' });
  });

  it('rejects unsafe JSON values, oversized/deep/cyclic data and accessors without calling them', () => {
    for (const bad of [NaN, Infinity, -Infinity, 1.5, 1n, () => 0, Symbol('bad')]) {
      expect(validateRun({ ...newRun(), coins: bad }).ok).toBe(false);
    }
    let called = 0;
    const getter = Object.defineProperty({}, 'rulesVersion', { enumerable: true, get() { called++; return 'forge-v1'; } });
    expect(validateRun(getter).ok).toBe(false);
    expect(called).toBe(0);
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(validateRun(cycle).ok).toBe(false);
    expect(validateRun({ ...newRun(), huge: '界'.repeat(100000) }).ok).toBe(false);
    expect(validateRun({ ...newRun(), journal: Array.from({ length: 2049 }, () => ({ type: 'advanceSummary' })) }).ok).toBe(false);
  });

  it('accepts reordered object keys but refuses an unsupported installed rules version', () => {
    const raw = Object.fromEntries(Object.entries(newRun()).reverse());
    expect(validateRun(raw).ok).toBe(true);
    expect(validateRun(raw, 'forge-v2')).toMatchObject({ ok: false, error: 'invalid_rules_version' });
  });
});
