import { applyCommand, createRun, getRunView } from '../../src/core/index.js';
import type { Action, Material, RunState } from '../../src/core/index.js';

// A legal illustrated playthrough, separate from the policy benchmark. No assigned wallets or forced outcomes.
export function conceptScenario(seed: string): RunState | null {
  const start = createRun({ runId: 'concept-b', seed });
  if (!start.ok) throw new Error(start.error);
  let state = start.state;
  const thirdIs = (material: Material) => state.pieces[2].material === material;
  const act = (action: Action) => {
    const result = applyCommand(state, { runId: state.runId, expectedRevision: state.revision, action });
    if (!result.ok) return false;
    state = result.state; return true;
  };
  const forge = (slot: number, progress: number, allowHeat = true) => {
    const id = state.pieces[slot]?.id; if (!id) return false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const piece = state.pieces[slot];
      if (!piece || piece.status !== 'active') return false;
      if (piece.progress >= progress) return true;
      if (allowHeat && piece.heat < 16 && state.coal && !act({ type: 'heat', pieceId: id })) return false;
      if (!act({ type: 'strike', pieceId: id, mode: 'light', timingMark: 5000 })) return false;
    }
    return false;
  };
  const dispose = (slot: number, type: 'deliver' | 'recycle') => {
    const piece = state.pieces[slot]; return piece ? act({ type, pieceId: piece.id }) : false;
  };
  const settle = (amount: number) => {
    if (getRunView(state).delivered !== amount || !act({ type: 'settleRound', recycleRemaining: false })) return false;
    return act({ type: 'advanceSummary' });
  };
  if (!forge(0, 9) || !dispose(0, 'deliver') || !forge(1, 9) || !dispose(1, 'deliver')
    || !dispose(2, 'recycle') || !settle(136) || !thirdIs('iron')) return null;
  if (!forge(0, 14) || !dispose(0, 'deliver') || !forge(1, 5) || !dispose(1, 'deliver')
    || !dispose(2, 'recycle') || !settle(155) || !thirdIs('iron')) return null;
  if (!forge(0, 14) || !dispose(0, 'deliver') || !forge(1, 9) || !dispose(1, 'deliver')
    || !dispose(2, 'recycle') || !settle(183) || state.phase !== 'merchant'
    || !act({ type: 'buy', productId: 'handle' }) || !act({ type: 'buy', productId: 'anvil' })
    || !act({ type: 'leaveMerchant' }) || !thirdIs('meteorite')) return null;
  if (!forge(0, 14) || !dispose(0, 'deliver') || !forge(1, 9) || !dispose(1, 'deliver')
    || !forge(2, 2) || !dispose(2, 'deliver') || !settle(227)) return null;
  if (!dispose(0, 'recycle')) return null;
  for (const slot of [1, 2]) {
    const id = state.pieces[slot]?.id; if (!id) return null;
    for (let attempt = 0; attempt < 20 && state.pieces[slot]?.status === 'active'; attempt++) {
      const piece = state.pieces[slot]; if (!piece) return null;
      if (piece.heat === 0 && !act({ type: 'heat', pieceId: id })) return null;
      if (!act({ type: 'strike', pieceId: id, mode: 'heavy', timingMark: 10000 })) return null;
    }
    if (state.pieces[slot]?.status !== 'broken') return null;
  }
  if (!settle(0) || !thirdIs('meteorite') || !forge(0, 20, false) || !dispose(0, 'deliver')) return null;
  for (const mark of [5000, 5000, 5000, 10000, 10000]) {
    if (!act({ type: 'strike', pieceId: state.pieces[1].id, mode: 'standard', timingMark: mark })) return null;
  }
  const view = getRunView(state, { pieceId: state.pieces[1].id, mode: 'standard' });
  const piece = view.selected;
  if (view.coins !== 585 || view.scrap !== 6 || view.coal !== 1 || view.seals !== 2 || view.delivered !== 144
    || piece?.progress !== 9 || piece.integrity !== 1 || piece.heat !== 40 || piece.stress !== 47
    || piece.risk[0]?.damageRiskPct !== 14 || piece.risk[1]?.damageRiskPct !== 20 || piece.risk[2]?.damageRiskPct !== 32) return null;
  return state;
}
