import { describe, expect, it } from 'vitest';
import { applyCommand, createRun, getRunView } from '../../src/core/index.js';
import type { HammerMode, TimingGrade } from '../../src/core/index.js';
import { act, firstPieceFixture, newRun, send } from './helpers';

describe('new run and immutable commands', () => {
  it('starts with exactly three fixed pieces, zero wallet and independent full stock', () => {
    const run = newRun();
    expect(run.pieces.map(piece => [piece.id, piece.material, piece.heat, piece.stress, piece.integrity]))
      .toEqual([['1:1', 'iron', 100, 0, 4], ['1:2', 'iron', 100, 0, 4], ['1:3', 'steel', 100, 0, 3]]);
    expect([run.round, run.coins, run.scrap, run.coal, run.seals, run.revision]).toEqual([1, 0, 0, 1, 3, 0]);
    expect(run.rng.stock.draws).toBe(0);
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.pieces[0])).toBe(true);
  });

  it('normalizes NFC/trim in the core and validates seed/run identity', () => {
    expect(newRun(' e\u0301 ')).toEqual(newRun('é'));
    expect(createRun({ runId: 'run', seed: ' ' })).toEqual({ ok: false, error: 'invalid_seed' });
    expect(createRun({ runId: 'run', seed: '锤'.repeat(65) })).toEqual({ ok: false, error: 'invalid_seed' });
    expect(createRun({ runId: 'run', seed: '🔥'.repeat(64) }).ok).toBe(true);
    expect(createRun({ runId: '', seed: 'valid' })).toEqual({ ok: false, error: 'invalid_run_id' });
    expect(createRun({ runId: '<script>', seed: 'valid' })).toEqual({ ok: false, error: 'invalid_run_id' });
  });

  it.each([null, [], {}, 'strike', { runId: 'test-run', expectedRevision: NaN, action: {} },
    { runId: 'test-run', expectedRevision: 0.5, action: {} }])('rejects malformed envelopes: %j', command => {
    const run = newRun();
    const result = applyCommand(run, command);
    expect(result).toEqual({ ok: false, state: run, error: 'invalid_command', events: [] });
    expect(result.state).toBe(run);
  });

  it('rejects foreign, stale and replayed commands without effects', () => {
    const run = newRun();
    const command = { runId: run.runId, expectedRevision: 0, action: { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 } };
    const first = applyCommand(run, command);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    expect(first.state.revision).toBe(1);
    expect(applyCommand(first.state, command)).toEqual({ ok: false, error: 'stale_revision', state: first.state, events: [] });
    expect(applyCommand(run, { ...command, runId: 'other' }).ok).toBe(false);
    expect(run.pieces[0].progress).toBe(0);
    expect(run.rng.strike.draws).toBe(0);
  });

  it.each([
    { type: 'strike', pieceId: '1:1', mode: 'toString', timingMark: 5000 },
    ...[-1, 10001, 1.5, NaN, Infinity].map(timingMark => ({ type: 'strike', pieceId: '1:1', mode: 'standard', timingMark })),
    { type: 'strike', mode: 'light', timingMark: 5000 }, { type: 'settleRound' }, { type: 'buy', productId: 'anvil' },
  ])('rejects invalid action input without spending or drawing: %j', action => {
    const run = newRun();
    const result = send(run, action);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(run);
    expect(result.events).toEqual([]);
  });
});

describe('timing, gain and damage', () => {
  const modes: readonly [HammerMode, number, number, number][] = [
    ['light', 2, 8, 3], ['standard', 3, 12, 7], ['heavy', 4, 18, 12],
  ];
  it.each(modes)('%s precise strike uses configured gain, heat and stress', (mode, gain, heat, stress) => {
    const run = firstPieceFixture({}, { upgrades: { handle: 0, bellows: 0, anvil: 2 } });
    const result = send(run, { type: 'strike', pieceId: '1:1', mode, timingMark: 5000 });
    expect(result.ok).toBe(true);
    expect(result.state.pieces[0]).toMatchObject({ progress: gain, heat: 100 - heat, stress, integrity: 4 });
    expect(result.state.rng.strike.draws).toBe(1);
    expect(result.state.rng.stock).toEqual(run.rng.stock);
  });

  it.each(modes)('%s gives no precise bonus on ordinary or mishit successes', (mode, preciseGain, heat, stress) => {
    for (const mark of [3000, 0]) {
      const base = newRun();
      const run = firstPieceFixture({}, { upgrades: { handle: 0, bellows: 0, anvil: 2 },
        rng: { stock: base.rng.stock, strike: { state: 1, draws: 0 } } });
      const next = act(run, { type: 'strike', pieceId: '1:1', mode, timingMark: mark });
      expect(next.pieces[0]).toMatchObject({ progress: preciseGain - 1, heat: 100 - heat, stress, integrity: 4 });
    }
  });

  const marks: readonly [number, TimingGrade][] = [[0, 'mishit'], [2999, 'mishit'], [3000, 'ordinary'],
    [4399, 'ordinary'], [4400, 'precise'], [5000, 'precise'], [5600, 'precise'], [5601, 'ordinary'],
    [7000, 'ordinary'], [7001, 'mishit'], [10000, 'mishit']];
  it.each(marks)('classifies exact integer mark %i as %s', (timingMark, grade) => {
    const result = send(newRun(), { type: 'strike', pieceId: '1:1', mode: 'light', timingMark });
    expect(result.ok).toBe(true);
    expect(result.events[0]).toMatchObject({ type: 'StrikeResolved', timing: grade });
  });

  it.each([1, 2])('widens precise half-window at handle level %i without widening ordinary', level => {
    const run = firstPieceFixture({}, { upgrades: { handle: level, bellows: 0, anvil: 0 } });
    const half = 600 + 200 * level;
    expect(getRunView(run).timingBands.preciseHalfWidth).toBe(half);
    for (const mark of [5000 - half, 5000 + half]) {
      expect(send(run, { type: 'strike', pieceId: '1:1', mode: 'light', timingMark: mark }).events[0])
        .toMatchObject({ timing: 'precise' });
    }
    expect(send(run, { type: 'strike', pieceId: '1:1', mode: 'light', timingMark: 7001 }).events[0])
      .toMatchObject({ timing: 'mishit' });
  });

  it('uses the published pre-strike steel example and distinguishes break chance', () => {
    const run = firstPieceFixture({ material: 'steel', progress: 9, heat: 40, stress: 47, integrity: 1 },
      { upgrades: { handle: 1, bellows: 0, anvil: 1 } });
    const before = JSON.stringify(run);
    const view = getRunView(run);
    expect(view.selected?.risk).toEqual([
      { grade: 'precise', damageRiskPct: 14, breakRiskPct: 14, progressOnSuccess: 3 },
      { grade: 'ordinary', damageRiskPct: 20, breakRiskPct: 20, progressOnSuccess: 2 },
      { grade: 'mishit', damageRiskPct: 32, breakRiskPct: 32, progressOnSuccess: 2 },
    ]);
    expect(view.selected).toMatchObject({ forgedValue: 83, nextValue: 123, nextProgress: 14, recoverableScrap: 5 });
    expect(send(run, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 }).events[0])
      .toMatchObject({ damageRiskPct: 14, breakRiskPct: 14 });
    expect(JSON.stringify(run)).toBe(before);
    const safeIntegrity = firstPieceFixture({ material: 'steel', progress: 9, heat: 40, stress: 47, integrity: 2 },
      { upgrades: { handle: 1, bellows: 0, anvil: 1 } });
    expect(getRunView(safeIntegrity).selected?.risk[0]?.breakRiskPct).toBe(0);
  });

  it.each([[40, 0], [39, 4], [30, 4], [29, 8], [1, 16]])('adds cold risk from heat %i using ceil', (heat, extra) => {
    const view = getRunView(firstPieceFixture({ material: 'meteorite', heat, progress: 9, stress: 0, integrity: 2 }));
    expect(view.selected?.risk[1]?.damageRiskPct).toBe(21 + extra);
  });

  it('steps stress risk at 20-point boundaries and applies each anvil level', () => {
    const boundaries: readonly (readonly [number, number])[] = [[19, 17], [20, 20], [39, 20], [40, 23], [100, 32]];
    for (const [stress, expected] of boundaries) {
      for (const anvil of [0, 1, 2]) {
        const run = firstPieceFixture({ material: 'steel', progress: 9, stress, integrity: 3 },
          { upgrades: { handle: 0, bellows: 0, anvil } });
        expect(getRunView(run).selected?.risk[1]?.damageRiskPct).toBe(expected - anvil * 3);
      }
    }
  });

  it('quotes all material/tier prices from the published integer value table', () => {
    const thresholds = [0, 2, 5, 9, 14, 20, 27, 35];
    const cases = [
      { material: 'iron', integrity: 4, values: [18, 28, 45, 68, 100, 144, 207, 288] },
      { material: 'steel', integrity: 3, values: [22, 35, 55, 83, 123, 176, 253, 352] },
      { material: 'meteorite', integrity: 2, values: [28, 44, 70, 106, 156, 224, 322, 448] },
    ] satisfies readonly { material: 'iron' | 'steel' | 'meteorite'; integrity: number; values: readonly number[] }[];
    for (const row of cases) for (const [tier, progress] of thresholds.entries()) {
      const view = getRunView(firstPieceFixture({ material: row.material, integrity: row.integrity, progress }));
      expect(view.selected?.tier).toBe(tier);
      expect(view.selected?.forgedValue).toBe(row.values[tier]);
    }
  });

  it('crosses multiple tiers, retains overflow and caps progress exactly', () => {
    const fresh = firstPieceFixture({ progress: 1 }, { upgrades: { handle: 0, bellows: 0, anvil: 2 } });
    const result = send(fresh, { type: 'strike', pieceId: '1:1', mode: 'heavy', timingMark: 5000 });
    expect(result.state.pieces[0].progress).toBe(5);
    expect(result.events).toContainEqual({ type: 'TierRaised', pieceId: '1:1', from: 0, to: 2, valueBefore: 18, valueAfter: 45 });
    // The C-reference vector for state 1 starts above 0.62, safely above this fixture's damage risk.
    const almost = firstPieceFixture({ progress: 34 }, { rng: { stock: fresh.rng.stock, strike: { state: 1, draws: 3 } },
      upgrades: { handle: 0, bellows: 0, anvil: 2 } });
    const capped = act(almost, { type: 'strike', pieceId: '1:1', mode: 'heavy', timingMark: 5000 });
    expect(capped.pieces[0].progress).toBe(35);
    expect(getRunView(capped).selected).toMatchObject({ nextValue: null, nextProgress: null });
    expect(send(capped, { type: 'strike', pieceId: '1:1', mode: 'light', timingMark: 5000 }))
      .toMatchObject({ ok: false, error: 'max_progress', state: capped });
  });

  it('damages then breaks once, preserving progress and reporting the lost value', () => {
    const run = firstPieceFixture({ material: 'steel', progress: 9, integrity: 1, heat: 20, stress: 90 },
      { rng: { stock: newRun().rng.stock, strike: { state: 0, draws: 0 } } });
    const result = send(run, { type: 'strike', pieceId: '1:1', mode: 'heavy', timingMark: 0 });
    expect(result.state.pieces[0]).toMatchObject({ progress: 9, heat: 2, stress: 100, integrity: 0, status: 'broken' });
    expect(result.events).toContainEqual({ type: 'PieceBroken', pieceId: '1:1', lostValue: 83, scrap: 1 });
    expect(result.state.scrap).toBe(1);
    expect(result.state.stats).toMatchObject({ strikes: 1, damagedStrikes: 1, brokenPieces: 1, scrapEarned: 1 });
    for (const type of ['deliver', 'recycle', 'heat']) {
      expect(send(result.state, { type, pieceId: '1:1' })).toMatchObject({ ok: false, error: 'piece_finalized', state: result.state });
    }
    const notBroken = firstPieceFixture({ material: 'steel', progress: 9, integrity: 2, heat: 20, stress: 30 },
      { rng: { stock: newRun().rng.stock, strike: { state: 0, draws: 0 } } });
    const cracked = act(notBroken, { type: 'strike', pieceId: '1:1', mode: 'heavy', timingMark: 0 });
    expect(cracked.pieces[0]).toMatchObject({ integrity: 1, status: 'active', progress: 9, stress: 48 });
  });
});

describe('heat and irreversible disposal', () => {
  it('never spends coal on full heat or without coal; reheating cannot heal', () => {
    expect(send(newRun(), { type: 'heat', pieceId: '1:1' })).toMatchObject({ ok: false, error: 'already_hot' });
    const cold = firstPieceFixture({ heat: 0, stress: 98, integrity: 2, progress: 5 });
    expect(send(cold, { type: 'strike', pieceId: '1:1', mode: 'light', timingMark: 5000 }))
      .toMatchObject({ ok: false, error: 'no_heat', state: cold });
    expect(send(cold, { type: 'deliver', pieceId: '1:1' }).ok).toBe(true);
    expect(send(cold, { type: 'recycle', pieceId: '1:1' }).ok).toBe(true);
    const reheated = act(cold, { type: 'heat', pieceId: '1:1' });
    expect(reheated.pieces[0]).toMatchObject({ heat: 100, stress: 100, integrity: 2, progress: 5 });
    expect(reheated.coal).toBe(0);
    const noCoal = firstPieceFixture({ heat: 1 }, { coal: 0 });
    expect(send(noCoal, { type: 'heat', pieceId: '1:1' })).toMatchObject({ ok: false, error: 'no_coal' });
    expect(send(noCoal, { type: 'strike', pieceId: '1:1', mode: 'light', timingMark: 5000 }).state.pieces[0].heat).toBe(0);
    expect(send(noCoal, { type: 'deliver', pieceId: '1:1' }).ok).toBe(true);
    expect(send(noCoal, { type: 'recycle', pieceId: '1:1' }).ok).toBe(true);
  });

  it('delivers only actual value, whereas recycling never contributes to quota', () => {
    const run = firstPieceFixture({ progress: 9 });
    const sold = act(run, { type: 'deliver', pieceId: '1:1' });
    expect([sold.coins, sold.scrap, getRunView(sold).delivered]).toEqual([68, 0, 68]);
    expect(getRunView(sold, { pieceId: '1:1' }).selected?.deliveredValue).toBe(68);
    const recycled = act(run, { type: 'recycle', pieceId: '1:1' });
    expect([recycled.coins, recycled.scrap, getRunView(recycled).delivered]).toEqual([0, 4, 0]);
    expect(send(sold, { type: 'deliver', pieceId: '1:1' })).toMatchObject({ ok: false, error: 'piece_finalized' });
    expect(send(recycled, { type: 'deliver', pieceId: '1:1' })).toMatchObject({ ok: false, error: 'piece_finalized' });
    expect(send(run, { type: 'deliver', pieceId: 'other-round:1' })).toMatchObject({ ok: false, error: 'piece_not_found' });
  });

  it('keeps preview pure and exposes the same allowed actions as execution', () => {
    const run = firstPieceFixture({ heat: 0 }, { coal: 0 });
    const snapshot = JSON.stringify(run);
    for (let n = 0; n < 20; n++) getRunView(run);
    const view = getRunView(run);
    expect(view.selected?.actions.strike).toEqual({ allowed: false, reason: 'no_heat' });
    expect(view.selected?.actions.heat).toEqual({ allowed: false, reason: 'no_coal' });
    expect(view.selected?.actions.deliver.allowed).toBe(true);
    expect(view.selected?.actions.recycle.allowed).toBe(true);
    expect(JSON.stringify(run)).toBe(snapshot);
    expect(Object.isFrozen(view)).toBe(true);
    expect(view.actions.settle).toEqual({ allowed: false, reason: 'unprocessed_pieces' });
  });

  it('never freezes caller-owned mutable copies while returning immutable views/results', () => {
    const input = structuredClone(newRun());
    expect(Object.isFrozen(input.upgrades)).toBe(false);
    const view = getRunView(input);
    expect(Object.isFrozen(input.upgrades)).toBe(false);
    expect(Object.isFrozen(input.history)).toBe(false);
    expect(Object.isFrozen(view.upgrades)).toBe(true);
    const result = act(input, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    expect(Object.isFrozen(input.upgrades)).toBe(false);
    expect(Object.isFrozen(input.stats)).toBe(false);
    expect(input.pieces[0].progress).toBe(0);
    expect(Object.isFrozen(result.stats)).toBe(true);
  });
});
