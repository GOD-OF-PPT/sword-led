import type { Action, HammerMode, PieceView, ProductId, RunView } from '../../src/core/index.js';
import type { Scenario } from './model.js';

export interface Decision { readonly action: Action; readonly periodMs?: number }
type Quote = (mode: HammerMode) => RunView;

const ROUTES: Readonly<Record<Scenario['upgrades'], readonly ProductId[]>> = {
  heat: ['bellows', 'anvil', 'handle', 'repair'],
  precision: ['handle', 'anvil', 'bellows', 'repair'],
  stability: ['anvil', 'bellows', 'handle', 'repair'],
  none: [],
};

export function createPolicy(scenario: Scenario) {
  let round = 0;
  let order: string[] = [];
  const pickMode = (piece: PieceView, target: number, quote: Quote): HammerMode => {
    if (scenario.hammer !== 'adaptive') return scenario.hammer;
    const timeWeight = scenario.strategy === 'aggressive' ? 0.07 : scenario.strategy === 'conservative' ? 0.015 : 0.025;
    const riskWeight = (scenario.strategy === 'aggressive' ? 0.08 : scenario.strategy === 'conservative' ? 0.3 : 0.15) * (piece.integrity === 1 ? 3 : 1);
    let best: HammerMode = 'light'; let highest = -Infinity;
    for (const mode of ['light', 'standard', 'heavy'] as const) {
      const view = quote(mode); const precise = view.selected?.risk[0]; const ordinary = view.selected?.risk[1];
      if (!precise || !ordinary) throw new Error('Missing visible risk quote');
      const probability = ordinary.damageRiskPct / 100;
      const gain = precise.progressOnSuccess * (1 - probability);
      const heat = Math.max(1, Math.min(piece.heat, view.hammer.heatCost));
      const seconds = (view.hammer.periodMs / 4 + 450) / 1000;
      const finish = piece.nextProgress !== null && piece.nextValue !== null && piece.nextValue >= target
        && piece.nextProgress - piece.progress <= precise.progressOnSuccess ? 0.12 : 0;
      const score = gain / heat + timeWeight * gain / seconds - riskWeight * probability + finish;
      if (score > highest) { highest = score; best = mode; }
    }
    return best;
  };
  return {
    select(view: RunView): string | null {
      if (view.round !== round) {
        round = view.round;
        const pieces = [...view.pieces];
        if (scenario.strategy === 'conservative') pieces.sort((a, b) => b.maxIntegrity - a.maxIntegrity || b.forgedValue - a.forgedValue);
        if (scenario.strategy === 'aggressive') pieces.sort((a, b) => b.forgedValue - a.forgedValue || b.maxIntegrity - a.maxIntegrity);
        order = pieces.map(piece => piece.id);
      }
      return order.find(id => view.pieces.some(piece => piece.id === id && piece.status === 'active')) ?? null;
    },
    decide(view: RunView, quote: Quote): Decision {
      if (view.phase === 'roundSummary') return { action: { type: 'advanceSummary' } };
      if (view.phase === 'merchant') {
        const priorities = view.seals <= 1 && scenario.upgrades !== 'none'
          ? ['repair', ...ROUTES[scenario.upgrades]] : ROUTES[scenario.upgrades];
        const product = priorities.find(id => view.merchant.offers.some(offer => offer.productId === id && offer.availability.allowed));
        if (product) {
          const offer = view.merchant.offers.find(offer => offer.productId === product);
          if (!offer) throw new Error('Missing offered product');
          return { action: { type: 'buy', productId: offer.productId } };
        }
        return { action: { type: 'leaveMerchant' } };
      }
      if (view.phase !== 'workshop') throw new Error('A terminal state must not request another decision');
      const piece = view.selected;
      if (!piece || piece.status !== 'active') return { action: { type: 'settleRound', recycleRemaining: false } };
      if (scenario.strategy === 'raw') return { action: { type: 'deliver', pieceId: piece.id } };
      if (scenario.strategy === 'recycle') return { action: { type: 'recycle', pieceId: piece.id } };
      if (scenario.strategy === 'blind') {
        const heavy = quote('heavy');
        return heavy.selected?.actions.strike.allowed
          ? { action: { type: 'strike', pieceId: piece.id, mode: 'heavy', timingMark: 5000 }, periodMs: heavy.hammer.periodMs }
          : { action: { type: 'deliver', pieceId: piece.id } };
      }
      const spare = view.remaining === 0;
      const spareTier = scenario.strategy === 'aggressive' ? 4 : scenario.strategy === 'balanced' ? 2 : 0;
      if (spare && (piece.tier >= spareTier || piece.integrity === 1)) return { action: { type: 'recycle', pieceId: piece.id } };
      const active = view.pieces.filter(candidate => candidate.status === 'active').length;
      const reserve = scenario.strategy !== 'conservative' && view.round <= 6 && active > 1 ? 1 : 0;
      const target = Math.ceil(view.remaining / Math.max(1, active - reserve)) * (scenario.strategy === 'aggressive' ? 1.25 : 1);
      const minTier = scenario.strategy === 'aggressive' ? (view.round <= 3 ? 4 : 5) : 0;
      if (!spare && piece.forgedValue >= target && piece.tier >= minTier) return { action: { type: 'deliver', pieceId: piece.id } };
      const mode = pickMode(piece, target, quote);
      const selected = quote(mode); const risk = selected.selected?.risk[scenario.strategy === 'conservative' ? 1 : 0];
      if (!risk) throw new Error('No risk preview for an active piece');
      const lastHitMayFinish = piece.nextProgress !== null && piece.nextValue !== null && piece.nextValue >= target
        && piece.nextProgress - piece.progress <= risk.progressOnSuccess;
      if (piece.heat < 40 && view.coal > 0 && !lastHitMayFinish && piece.progress < 35) {
        return { action: { type: 'heat', pieceId: piece.id } };
      }
      const limit = scenario.strategy === 'conservative' ? (piece.integrity === 1 ? 18 : 30)
        : scenario.strategy === 'aggressive' ? (piece.integrity === 1 ? 38 : 55) : (piece.integrity === 1 ? 24 : 42);
      if (!selected.selected?.actions.strike.allowed || risk.damageRiskPct > (spare ? 16 : limit)) {
        return { action: { type: spare ? 'recycle' : 'deliver', pieceId: piece.id } };
      }
      return { action: { type: 'strike', pieceId: piece.id, mode, timingMark: 5000 }, periodMs: selected.hammer.periodMs };
    },
  };
}
