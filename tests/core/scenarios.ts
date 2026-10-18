import { getRunView } from '../../src/core/index.js';
import type { RunState } from '../../src/core/index.js';
import { act, newRun } from './helpers';

// Actual accepted commands only: these fixtures can pass validateRun's complete replay.
export function workRound(run: RunState, strategy: 'all' | 'two' | 'recycle'): RunState {
  let state = run;
  for (const [index, id] of state.pieces.map(piece => piece.id).entries()) {
    const deliver = strategy === 'all' || (strategy === 'two' && index < 2);
    const target = deliver ? 20 : 14;
    for (let hit = 0; hit < 30; hit++) {
      const piece = state.pieces.find(candidate => candidate.id === id);
      if (!piece || piece.status !== 'active' || piece.progress >= target) break;
      if (piece.heat < 24 && state.coal > 0) state = act(state, { type: 'heat', pieceId: id });
      if (!getRunView(state, { pieceId: id, mode: 'light' }).selected?.actions.strike.allowed) break;
      state = act(state, { type: 'strike', pieceId: id, mode: 'light', timingMark: 5000 });
    }
    if (state.pieces.find(piece => piece.id === id)?.status === 'active') {
      state = act(state, { type: deliver ? 'deliver' : 'recycle', pieceId: id });
    }
  }
  return act(state, { type: 'settleRound', recycleRemaining: false });
}

export function firstMerchant(): RunState {
  let state = newRun('merchant-0');
  for (const strategy of ['all', 'two', 'recycle'] satisfies readonly ('all' | 'two' | 'recycle')[]) {
    state = act(workRound(state, strategy), { type: 'advanceSummary' });
  }
  if (state.phase !== 'merchant' || state.coins !== 784 || state.scrap !== 22 || state.seals !== 2) {
    throw new Error('The pinned merchant scenario changed; inspect the rule change instead of editing a wallet.');
  }
  return state;
}

export function secondMerchant(state: RunState): RunState {
  let run = act(state, { type: 'leaveMerchant' });
  for (let day = 4; day <= 6; day++) run = act(workRound(run, 'two'), { type: 'advanceSummary' });
  if (run.phase !== 'merchant' || run.round !== 6) throw new Error('Second merchant scenario did not survive.');
  return run;
}
