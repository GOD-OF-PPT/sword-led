import { describe, expect, it } from 'vitest';
import { applyCommand, getRunView } from '../../src/core/index.js';
import type { Action, RunState } from '../../src/core/index.js';
import { act, newRun, roundFixture, send } from './helpers';

function sellAll(state: RunState): RunState {
  return state.pieces.reduce((current, piece) => act(current, { type: 'deliver', pieceId: piece.id }), state);
}

function richRound(round: number, seals = 3): RunState {
  const run = roundFixture(round, seals);
  return { ...run, pieces: [{ ...run.pieces[0], progress: 35 }, { ...run.pieces[1], progress: 35 },
    { ...run.pieces[2], progress: 35 }] };
}

describe('quota, closing and history', () => {
  it('rejects premature normal settlement without recycling or consuming resources', () => {
    const run = newRun();
    expect(send(run, { type: 'settleRound', recycleRemaining: false }))
      .toEqual({ ok: false, state: run, error: 'unprocessed_pieces', events: [] });
  });

  it('closes early as one revision, recycling all remaining pieces before a single penalty', () => {
    const run = { ...newRun(), coins: 9999 };
    const result = send(run, { type: 'settleRound', recycleRemaining: true });
    expect(result.ok).toBe(true);
    expect([result.state.revision, result.state.coins, result.state.scrap, result.state.seals]).toEqual([1, 9999, 10, 2]);
    expect(result.state.pieces.every(piece => piece.status === 'recycled')).toBe(true);
    expect(result.state.history).toHaveLength(1);
    expect(result.state.history[0]).toMatchObject({ round: 1, delivered: 0, deficit: 120, metQuota: false, sealsBefore: 3, sealsAfter: 2 });
    expect(result.events.map(event => event.type)).toEqual(['PieceRecycled', 'PieceRecycled', 'PieceRecycled', 'RoundSettled']);
    expect(send(result.state, { type: 'settleRound', recycleRemaining: true }))
      .toMatchObject({ ok: false, error: 'wrong_phase', state: result.state });
  });

  it('waits for settlement after all pieces are disposed and never counts bank coins as quota', () => {
    let state = newRun();
    for (const piece of state.pieces) state = act(state, { type: 'recycle', pieceId: piece.id });
    expect(state.phase).toBe('workshop');
    expect(state.seals).toBe(3);
    expect(getRunView(state).actions.settle).toEqual({ allowed: true });
    const result = act(state, { type: 'settleRound', recycleRemaining: false });
    expect(result.phase).toBe('roundSummary');
    expect(result.seals).toBe(2);
    expect(state.history).toEqual([]);
    expect(Object.isFrozen(result.history[0]?.pieces)).toBe(true);
  });

  it('preserves a locked-in 136 delivery when the remaining steel is recycled', () => {
    const base = newRun();
    let run: RunState = { ...base, pieces: [{ ...base.pieces[0], progress: 9 }, { ...base.pieces[1], progress: 9 }, base.pieces[2]] };
    run = act(run, { type: 'deliver', pieceId: '1:1' });
    run = act(run, { type: 'deliver', pieceId: '1:2' });
    expect(getRunView(run).delivered).toBe(136);
    expect(getRunView(run).remaining).toBe(0);
    const closed = act(run, { type: 'settleRound', recycleRemaining: true });
    expect([closed.coins, closed.scrap, closed.seals]).toEqual([136, 4, 3]);
    expect(closed.history[0]?.metQuota).toBe(true);
  });

  it('treats an exact 150 delivery as success and a 119/120 delivery as a breach', () => {
    const base = roundFixture(2);
    const exact: RunState = { ...base, pieces: [{ ...base.pieces[0], progress: 2 }, base.pieces[1],
      { ...base.pieces[2], material: 'iron', integrity: 4, progress: 14 }] };
    const exactResult = act(sellAll(exact), { type: 'settleRound', recycleRemaining: false });
    expect(exactResult.history[0]).toMatchObject({ quota: 150, delivered: 150, deficit: 0, metQuota: true });
    expect(exactResult.seals).toBe(3);
    const first = newRun();
    const short: RunState = { ...first, pieces: [first.pieces[0], first.pieces[1], { ...first.pieces[2], progress: 9 }] };
    const shortResult = act(sellAll(short), { type: 'settleRound', recycleRemaining: false });
    expect(shortResult.history[0]).toMatchObject({ quota: 120, delivered: 119, deficit: 1, metQuota: false });
    expect([shortResult.coins, shortResult.seals]).toEqual([119, 2]);
    const tomorrow = act(shortResult, { type: 'advanceSummary' });
    expect(getRunView(tomorrow).quota).toBe(150);
    expect(getRunView(tomorrow).delivered).toBe(0);
    expect(tomorrow.coins).toBe(119);
  });
});

describe('round schedule and terminal priority', () => {
  it.each([[0, 'iron'], [1, 'steel'], [0xffffffff, 'meteorite']])('uses supply roll from C-reference seed %i for %s', (seed, material) => {
    const base = richRound(1);
    const run: RunState = { ...base, rng: { ...base.rng, stock: { state: Number(seed), draws: 0 } } };
    const next = act(act(sellAll(run), { type: 'settleRound', recycleRemaining: false }), { type: 'advanceSummary' });
    expect(next.pieces[2].material).toBe(material);
    expect(next.rng.stock.draws).toBe(1);
  });

  it.each([3, 6, 9])('enters a merchant only after surviving round %i and leaves exactly once', round => {
    const run = richRound(round);
    const closed = act(sellAll(run), { type: 'settleRound', recycleRemaining: false });
    expect(closed.phase).toBe('roundSummary');
    const visit = act(closed, { type: 'advanceSummary' });
    expect(visit.phase).toBe('merchant');
    expect(visit.round).toBe(round);
    expect(visit.rng.stock).toEqual(closed.rng.stock);
    expect(send(visit, { type: 'advanceSummary' })).toMatchObject({ ok: false, error: 'wrong_phase' });
    const depart = { runId: visit.runId, expectedRevision: visit.revision, action: { type: 'leaveMerchant' } };
    const next = applyCommand(visit, depart);
    expect(next.state.round).toBe(round + 1);
    expect(next.state.rng.stock.draws).toBe(visit.rng.stock.draws + 1);
    expect(applyCommand(next.state, depart)).toMatchObject({ ok: false, error: 'stale_revision', state: next.state });
    expect(next.state.pieces).toHaveLength(3);
    expect(next.state.pieces.map(piece => piece.id)).toEqual([`${round + 1}:1`, `${round + 1}:2`, `${round + 1}:3`]);
    expect(visit.pieces.every(piece => piece.status === 'delivered')).toBe(true);
  });

  it('resets coal and stock instead of carrying leftover heat or accumulating coal', () => {
    const base = richRound(1);
    const run: RunState = { ...base, coal: 2, upgrades: { handle: 0, bellows: 2, anvil: 0 } };
    const closed = act(sellAll(run), { type: 'settleRound', recycleRemaining: false });
    const next = act(closed, { type: 'advanceSummary' });
    expect(next.coal).toBe(3);
    expect(next.pieces.every(piece => piece.status === 'active' && piece.heat === 100 && piece.stress === 0)).toBe(true);
    expect(next.pieces[0].material).toBe('iron');
    expect(next.pieces[1].material).toBe('steel');
    expect(next.upgrades).toEqual(run.upgrades);
    expect(next.coins).toBe(closed.coins);
  });

  it.each([3, 6, 9, 12])('defeat takes priority on round %i when the last seal is lost', round => {
    const result = send(roundFixture(round, 1), { type: 'settleRound', recycleRemaining: true });
    expect(result.state.phase).toBe('defeat');
    expect(result.state.seals).toBe(0);
    expect(result.events).toContainEqual({ type: 'RunEnded', outcome: 'defeat', round, seals: 0 });
    expect(getRunView(result.state).nextMerchantRound).toBeNull();
    expect(send(result.state, { type: 'advanceSummary' })).toMatchObject({ ok: false, error: 'wrong_phase' });
    expect(send(result.state, { type: 'leaveMerchant' })).toMatchObject({ ok: false, error: 'wrong_phase' });
  });

  it('completes round 12 with a remaining seal and reports a final breach honestly', () => {
    const win = act(sellAll(richRound(12)), { type: 'settleRound', recycleRemaining: false });
    expect(win.phase).toBe('victory');
    const withBreach = act(roundFixture(12, 2), { type: 'settleRound', recycleRemaining: true });
    expect(withBreach.phase).toBe('victory');
    expect(withBreach.seals).toBe(1);
    expect(withBreach.stats.roundsMissed).toBe(1);
    expect(withBreach.history[0]?.metQuota).toBe(false);
    const attempts: Action[] = [{ type: 'advanceSummary' }, { type: 'leaveMerchant' },
      { type: 'settleRound', recycleRemaining: true }, { type: 'deliver', pieceId: '12:1' }];
    for (const action of attempts) expect(send(withBreach, action)).toMatchObject({ ok: false, error: 'wrong_phase', state: withBreach });
  });
});

describe('actual command sequences and bounded invariants', () => {
  it('plays a real three-round failure without injecting state or opening a merchant after defeat', () => {
    let run = newRun('failure-seed');
    for (let round = 1; round <= 3; round++) {
      expect(run.round).toBe(round);
      run = sellAll(run);
      run = act(run, { type: 'settleRound', recycleRemaining: false });
      if (round < 3) run = act(run, { type: 'advanceSummary' });
    }
    expect(run.phase).toBe('defeat');
    expect(run.history).toHaveLength(3);
    expect(run.stats).toMatchObject({ roundsMet: 0, roundsMissed: 3, deliveredPieces: 9 });
    expect(run.rng.stock.draws).toBe(2);
    expect(run.rng.strike.draws).toBe(0);
  });

  it('keeps supply independent from how many strikes were used, and known-state copies replay identically', () => {
    const base = newRun('replay-seed');
    const hit = act(base, { type: 'strike', pieceId: '1:1', mode: 'standard', timingMark: 5000 });
    const copied = structuredClone(hit);
    const a = act(act(hit, { type: 'settleRound', recycleRemaining: true }), { type: 'advanceSummary' });
    const b = act(act(copied, { type: 'settleRound', recycleRemaining: true }), { type: 'advanceSummary' });
    expect(a).toEqual(b);
    const noHit = act(act(base, { type: 'settleRound', recycleRemaining: true }), { type: 'advanceSummary' });
    expect(a.pieces).toEqual(noHit.pieces);
    expect(a.rng.stock).toEqual(noHit.rng.stock);
    expect(a.rng.strike.draws).toBe(1);
    expect(noHit.rng.strike.draws).toBe(0);
  });

  it('preserves nonnegative resources, one-time terminal pieces and pure old states across 50 seeds', () => {
    let accepted = 0;
    for (let seed = 0; seed < 50; seed++) {
      let run = newRun(`invariants-${seed}`);
      const step = (action: Action) => {
        const before = run;
        const snapshot = JSON.stringify(before);
        run = act(before, action);
        expect(JSON.stringify(before)).toBe(snapshot);
        expect(run.revision).toBe(before.revision + 1);
        expect(run.pieces).toHaveLength(3);
        for (const value of [run.coins, run.scrap, run.coal, run.seals]) expect(Number.isSafeInteger(value) && value >= 0).toBe(true);
        expect(run.seals).toBeLessThanOrEqual(3);
        expect(run.coins).toBe(run.stats.coinsEarned - run.stats.coinsSpent);
        expect(run.scrap).toBe(run.stats.scrapEarned - run.stats.scrapSpent);
        expect(run.stats.strikes).toBe(run.stats.successfulStrikes + run.stats.damagedStrikes);
        for (const piece of run.pieces) {
          expect(piece.heat).toBeGreaterThanOrEqual(0);
          expect(piece.heat).toBeLessThanOrEqual(100);
          expect(piece.stress).toBeLessThanOrEqual(100);
          expect(piece.progress).toBeLessThanOrEqual(35);
          expect(piece.integrity).toBeGreaterThanOrEqual(0);
          const old = before.pieces.find(candidate => candidate.id === piece.id);
          if (old && old.status !== 'active') expect(piece.status).toBe(old.status);
          expect(piece.status === 'broken').toBe(piece.integrity === 0);
        }
        for (const piece of getRunView(run).pieces) for (const risk of piece.risk) {
          expect(risk.damageRiskPct).toBeGreaterThanOrEqual(0);
          expect(risk.damageRiskPct).toBeLessThanOrEqual(85);
          expect(risk.breakRiskPct).toBe(piece.integrity === 1 ? risk.damageRiskPct : 0);
        }
        expect(run.rng.strike.draws - before.rng.strike.draws).toBe(action.type === 'strike' ? 1 : 0);
        accepted++;
      };
      for (let round = 0; round < 12 && run.phase !== 'defeat' && run.phase !== 'victory'; round++) {
        const ids = run.pieces.map(piece => piece.id);
        for (const [index, id] of ids.entries()) {
          for (let hit = 0; hit < 4 && getRunView(run, { pieceId: id }).selected?.actions.strike.allowed; hit++) {
            step({ type: 'strike', pieceId: id, mode: hit % 2 ? 'heavy' : 'standard', timingMark: hit % 3 ? 5000 : 0 });
          }
          if (run.pieces.find(piece => piece.id === id)?.status === 'active') {
            step({ type: index % 2 ? 'recycle' : 'deliver', pieceId: id });
          }
        }
        step({ type: 'settleRound', recycleRemaining: false });
        if (run.phase === 'roundSummary') step({ type: 'advanceSummary' });
        if (run.phase === 'merchant') step({ type: 'leaveMerchant' });
      }
      expect(['defeat', 'victory']).toContain(run.phase);
    }
    expect(accepted).toBeGreaterThan(1500);
  }, 15000);
});
