import type { Action, CommandResult, CreateResult, CreateRunInput, DomainEvent, ErrorCode,
  GameStats, Material, PieceTrio, RoundSummary, RunState, Workpiece } from './model.js';
import { freezeDeep } from './immutable.js';
import { isRecord, parseAction, pieceError, settleError } from './guards.js';
import { nextRandom, seedStream } from './random.js';
import { merchantOffer } from './merchant.js';
import { damageRisk, deliveredThisRound, gradeOf, HAMMERS, MATERIALS, MAX_PROGRESS,
  MERCHANT_ROUNDS, quotaFor, recyclingValue, RULES_VERSION, tierOf, valueOf } from './rules.js';

const EMPTY_EVENTS: readonly [] = Object.freeze([]);

function initialStats(): GameStats {
  return { strikes: 0, successfulStrikes: 0, damagedStrikes: 0, heats: 0,
    deliveredPieces: 0, recycledPieces: 0, brokenPieces: 0, highestTier: 0,
    coinsEarned: 0, coinsSpent: 0, scrapEarned: 0, scrapSpent: 0, roundsMet: 0, roundsMissed: 0 };
}

function makePiece(round: number, slot: number, material: Material): Workpiece {
  return { id: `${round}:${slot}`, material, progress: 0, heat: 100, stress: 0,
    integrity: MATERIALS[material].integrity, status: 'active' };
}

function trio(round: number, materials: readonly [Material, Material, Material]): PieceTrio {
  return [makePiece(round, 1, materials[0]), makePiece(round, 2, materials[1]), makePiece(round, 3, materials[2])];
}

function replacePiece(state: RunState, replacement: Workpiece): PieceTrio {
  const [a, b, c] = state.pieces;
  return [a.id === replacement.id ? replacement : a, b.id === replacement.id ? replacement : b,
    c.id === replacement.id ? replacement : c];
}

export function createRun(input: CreateRunInput): CreateResult {
  if (!isRecord(input) || typeof input.runId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.runId)) {
    return { ok: false, error: 'invalid_run_id' };
  }
  if (typeof input.seed !== 'string') return { ok: false, error: 'invalid_seed' };
  const seed = input.seed.normalize('NFC').trim();
  if (Array.from(seed).length < 1 || Array.from(seed).length > 64) return { ok: false, error: 'invalid_seed' };
  return freezeDeep({ ok: true, state: {
    rulesVersion: RULES_VERSION, runId: input.runId, seed, revision: 0, phase: 'workshop', round: 1,
    coins: 0, scrap: 0, coal: 1, seals: 3, upgrades: { handle: 0, bellows: 0, anvil: 0 },
    pieces: trio(1, ['iron', 'iron', 'steel']), rng: { stock: seedStream(seed, 'stock'), strike: seedStream(seed, 'strike') },
    history: [], purchases: [], stats: initialStats(), journal: [],
  } });
}

function reject(state: RunState, error: ErrorCode): CommandResult {
  return { ok: false, state, error, events: EMPTY_EVENTS };
}

function accept(previous: RunState, next: RunState, events: readonly DomainEvent[]): CommandResult {
  return freezeDeep({ ok: true, state: { ...next, revision: previous.revision + 1 }, events });
}

function recycle(state: RunState, piece: Workpiece): { readonly state: RunState; readonly event: DomainEvent } {
  const scrap = recyclingValue(piece);
  return {
    state: { ...state, scrap: state.scrap + scrap, pieces: replacePiece(state, { ...piece, status: 'recycled' }),
      stats: { ...state.stats, recycledPieces: state.stats.recycledPieces + 1, scrapEarned: state.stats.scrapEarned + scrap } },
    event: { type: 'PieceRecycled', pieceId: piece.id, scrap },
  };
}

function startNextRound(state: RunState): { readonly state: RunState; readonly event: DomainEvent } {
  const round = state.round + 1;
  const draw = nextRandom(state.rng.stock);
  const third: Material = draw.value < 0.35 ? 'iron' : draw.value < 0.80 ? 'steel' : 'meteorite';
  const coal = 1 + state.upgrades.bellows;
  return { state: { ...state, round, phase: 'workshop', coal, pieces: trio(round, ['iron', 'steel', third]),
    rng: { ...state.rng, stock: draw.stream } }, event: { type: 'RoundStarted', round, quota: quotaFor(round), coal } };
}

function settleRound(state: RunState, recycleRemaining: boolean): CommandResult {
  const error = settleError(state, recycleRemaining);
  if (error) return reject(state, error);
  let next = state;
  const events: DomainEvent[] = [];
  for (const piece of state.pieces) {
    if (piece.status === 'active') {
      const result = recycle(next, piece);
      next = result.state;
      events.push(result.event);
    }
  }
  const quota = quotaFor(state.round);
  const delivered = deliveredThisRound(next);
  const metQuota = delivered >= quota;
  const seals = state.seals - (metQuota ? 0 : 1);
  const phase = seals === 0 ? 'defeat' : state.round === 12 ? 'victory' : 'roundSummary';
  const summary: RoundSummary = { round: state.round, quota, delivered, deficit: Math.max(0, quota - delivered),
    metQuota, sealsBefore: state.seals, sealsAfter: seals, coalRemaining: next.coal, pieces: next.pieces };
  next = { ...next, phase, seals, history: [...state.history, summary], stats: { ...next.stats,
    roundsMet: state.stats.roundsMet + (metQuota ? 1 : 0), roundsMissed: state.stats.roundsMissed + (metQuota ? 0 : 1) } };
  events.push({ type: 'RoundSettled', summary });
  if (phase === 'victory' || phase === 'defeat') events.push({ type: 'RunEnded', outcome: phase, round: state.round, seals });
  return accept(state, next, events);
}

function applyPieceAction(state: RunState, action: Extract<Action, { readonly pieceId: string }>): CommandResult {
  const piece = state.pieces.find(candidate => candidate.id === action.pieceId);
  const error = pieceError(state, piece, action.type);
  if (error) return reject(state, error);
  if (!piece) return reject(state, 'piece_not_found');
  switch (action.type) {
    case 'heat':
      return accept(state, { ...state, coal: state.coal - 1,
        pieces: replacePiece(state, { ...piece, heat: 100, stress: Math.min(100, piece.stress + 5) }),
        stats: { ...state.stats, heats: state.stats.heats + 1 } },
      [{ type: 'Heated', pieceId: piece.id, coalSpent: 1 }]);
    case 'deliver': {
      const value = valueOf(piece);
      return accept(state, { ...state, coins: state.coins + value,
        pieces: replacePiece(state, { ...piece, status: 'delivered' }), stats: { ...state.stats,
          deliveredPieces: state.stats.deliveredPieces + 1, coinsEarned: state.stats.coinsEarned + value } },
      [{ type: 'PieceDelivered', pieceId: piece.id, value }]);
    }
    case 'recycle': {
      const result = recycle(state, piece);
      return accept(state, result.state, [result.event]);
    }
    case 'strike': {
      const grade = gradeOf(action.timingMark, state.upgrades.handle);
      const risk = damageRisk(piece, action.mode, grade, state.upgrades.anvil);
      const draw = nextRandom(state.rng.strike);
      const damaged = draw.value < risk / 100;
      const hammer = HAMMERS[action.mode];
      const progress = damaged ? piece.progress : Math.min(MAX_PROGRESS, piece.progress + hammer.progress + (grade === 'precise' ? 1 : 0));
      const integrity = piece.integrity - (damaged ? 1 : 0);
      const broken = integrity === 0;
      const updated: Workpiece = { ...piece, progress, integrity, heat: Math.max(0, piece.heat - hammer.heat),
        stress: Math.min(100, piece.stress + hammer.stress + (damaged ? 6 : 0)), status: broken ? 'broken' : 'active' };
      const tierBefore = tierOf(piece.progress);
      const tierAfter = tierOf(progress);
      const events: DomainEvent[] = [{ type: 'StrikeResolved', pieceId: piece.id, mode: action.mode,
        timing: grade, timingMark: action.timingMark, damageRiskPct: risk, breakRiskPct: piece.integrity === 1 ? risk : 0,
        outcome: broken ? 'broken' : damaged ? 'damage' : 'success', progressGained: progress - piece.progress,
        heatBefore: piece.heat, heatAfter: updated.heat, stressBefore: piece.stress, stressAfter: updated.stress }];
      if (tierAfter > tierBefore) events.push({ type: 'TierRaised', pieceId: piece.id, from: tierBefore,
        to: tierAfter, valueBefore: valueOf(piece), valueAfter: valueOf(updated) });
      if (broken) events.push({ type: 'PieceBroken', pieceId: piece.id, lostValue: valueOf(piece), scrap: 1 });
      return accept(state, { ...state, pieces: replacePiece(state, updated), scrap: state.scrap + (broken ? 1 : 0),
        rng: { ...state.rng, strike: draw.stream }, stats: { ...state.stats, strikes: state.stats.strikes + 1,
          successfulStrikes: state.stats.successfulStrikes + (damaged ? 0 : 1),
          damagedStrikes: state.stats.damagedStrikes + (damaged ? 1 : 0), brokenPieces: state.stats.brokenPieces + (broken ? 1 : 0),
          highestTier: Math.max(state.stats.highestTier, tierAfter), scrapEarned: state.stats.scrapEarned + (broken ? 1 : 0) } }, events);
    }
  }
}

export function applyCommand(state: RunState, command: unknown): CommandResult {
  if (state.rulesVersion !== RULES_VERSION) return reject(state, 'invalid_rules_version');
  if (!isRecord(command) || typeof command.runId !== 'string' || !Number.isSafeInteger(command.expectedRevision)) {
    return reject(state, 'invalid_command');
  }
  if (command.runId !== state.runId) return reject(state, 'foreign_run');
  if (command.expectedRevision !== state.revision) return reject(state, 'stale_revision');
  const parsed = parseAction(command.action);
  if (!parsed.ok) return reject(state, parsed.error);
  const result = reduceAction(state, parsed.action);
  if (!result.ok) return result;
  return freezeDeep({ ...result, state: { ...result.state, journal: [...state.journal, parsed.action] } });
}

function reduceAction(state: RunState, action: Action): CommandResult {
  switch (action.type) {
    case 'buy': {
      const offer = merchantOffer(state, action.productId);
      if (!offer.availability.allowed) return reject(state, offer.availability.reason);
      if (!offer.price) return reject(state, 'max_level');
      const purchase = { afterRound: state.round, product: action.productId,
        level: action.productId === 'repair' ? 1 : state.upgrades[action.productId] + 1,
        coins: offer.price.coins, scrap: offer.price.scrap };
      return accept(state, { ...state, coins: state.coins - purchase.coins, scrap: state.scrap - purchase.scrap,
        seals: action.productId === 'repair' ? state.seals + 1 : state.seals,
        upgrades: action.productId === 'repair' ? state.upgrades
          : { ...state.upgrades, [action.productId]: purchase.level },
        purchases: [...state.purchases, purchase], stats: { ...state.stats,
          coinsSpent: state.stats.coinsSpent + purchase.coins, scrapSpent: state.stats.scrapSpent + purchase.scrap } },
      [{ type: 'PurchaseMade', purchase }]);
    }
    case 'settleRound': return settleRound(state, action.recycleRemaining);
    case 'advanceSummary': {
      if (state.phase !== 'roundSummary') return reject(state, 'wrong_phase');
      if (MERCHANT_ROUNDS.includes(state.round)) return accept(state, { ...state, phase: 'merchant' },
        [{ type: 'MerchantEntered', afterRound: state.round }]);
      const next = startNextRound(state);
      return accept(state, next.state, [next.event]);
    }
    case 'leaveMerchant': {
      if (state.phase !== 'merchant') return reject(state, 'wrong_phase');
      const next = startNextRound(state);
      return accept(state, next.state, [next.event]);
    }
    default: return applyPieceAction(state, action);
  }
}
