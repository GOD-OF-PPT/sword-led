import type { HammerMode, PieceView, RunState, RunView, TimingGrade, ViewOptions, Workpiece } from './model.js';
import { freezeDeep } from './immutable.js';
import { available, pieceError, settleError } from './guards.js';
import { damageRisk, deliveredThisRound, HAMMERS, isHammerMode, MATERIALS, MERCHANT_ROUNDS,
  quotaFor, recyclingValue, tierAt, tierOf, valueOf } from './rules.js';

const GRADES: readonly TimingGrade[] = ['precise', 'ordinary', 'mishit'];

function pieceView(state: RunState, piece: Workpiece, mode: HammerMode): PieceView {
  const tier = tierOf(piece.progress);
  const next = tier < 7 ? tierAt(tier + 1) : null;
  return { ...piece, materialName: MATERIALS[piece.material].name, maxIntegrity: MATERIALS[piece.material].integrity,
    tier, tierName: tierAt(tier).name, forgedValue: valueOf(piece),
    deliveredValue: piece.status === 'delivered' ? valueOf(piece) : 0,
    nextProgress: next?.progress ?? null,
    nextValue: next ? Math.floor(MATERIALS[piece.material].baseValue * next.multiplier / 10) : null,
    recoverableScrap: piece.status === 'active' ? recyclingValue(piece) : 0,
    recoveredScrap: piece.status === 'recycled' ? recyclingValue(piece) : piece.status === 'broken' ? 1 : 0,
    risk: piece.status === 'active' ? GRADES.map(grade => {
      const risk = damageRisk(piece, mode, grade, state.upgrades.anvil);
      return { grade, damageRiskPct: risk, breakRiskPct: piece.integrity === 1 ? risk : 0,
        progressOnSuccess: Math.min(35 - piece.progress, HAMMERS[mode].progress + (grade === 'precise' ? 1 : 0)) };
    }) : [],
    actions: { strike: available(pieceError(state, piece, 'strike')), heat: available(pieceError(state, piece, 'heat')),
      deliver: available(pieceError(state, piece, 'deliver')), recycle: available(pieceError(state, piece, 'recycle')) } };
}

export function getRunView(state: RunState, options: ViewOptions = {}): RunView {
  const mode = isHammerMode(options.mode) ? options.mode : 'standard';
  const hammer = HAMMERS[mode];
  const pieces = state.pieces.map(piece => pieceView(state, piece, mode));
  const selected = (options.pieceId ? pieces.find(piece => piece.id === options.pieceId) : undefined)
    ?? pieces.find(piece => piece.status === 'active') ?? null;
  const quota = quotaFor(state.round);
  const delivered = deliveredThisRound(state);
  const terminal = state.phase === 'victory' || state.phase === 'defeat';
  const nextMerchant = terminal ? null : MERCHANT_ROUNDS.find(round => state.phase === 'merchant' ? round > state.round : round >= state.round) ?? null;
  return freezeDeep({ runId: state.runId, revision: state.revision, phase: state.phase, round: state.round,
    totalRounds: 12, quota, delivered, remaining: Math.max(0, quota - delivered), coins: state.coins, scrap: state.scrap,
    coal: state.coal, seals: state.seals, upgrades: state.upgrades, mode,
    hammer: { label: hammer.label, progress: hammer.progress, preciseProgress: hammer.progress + 1,
      heatCost: hammer.heat, stressCost: hammer.stress, periodMs: hammer.periodMs },
    timingBands: { center: 5000, preciseHalfWidth: 600 + 200 * state.upgrades.handle, ordinaryHalfWidth: 2000 },
    pieces, selected, nextMerchantRound: nextMerchant,
    actions: { settle: available(settleError(state, false)), closeEarly: available(settleError(state, true)),
      advance: available(state.phase === 'roundSummary' ? null : 'wrong_phase'),
      leaveMerchant: available(state.phase === 'merchant' ? null : 'wrong_phase') }, history: state.history, stats: state.stats });
}
