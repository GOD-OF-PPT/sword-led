import type { Purchase, RoundSummary, RunView, Workpiece } from './model.js';
import { MATERIALS, recyclingValue, tierAt, tierOf, valueOf } from './rules.js';
import { freezeDeep } from './immutable.js';

const PIECE_STATUS = { active: '加工中', delivered: '已交货', recycled: '已回收', broken: '已破碎' } as const;

type PieceReceipt = Readonly<ReturnType<typeof pieceReceipt>>;
type RoundReceipt = Readonly<Omit<RoundSummary, 'pieces'> & { pieces: readonly PieceReceipt[]; scrap: number; lost: number }>;
export interface RunLedger {
  readonly rounds: readonly RoundReceipt[];
  readonly highestTier: string;
  readonly lost: number;
  readonly purchases: readonly Readonly<Purchase & { label: string }>[];
}

/** Read-only receipts reuse the rules table; they never award or persist resources. */
function pieceReceipt(piece: Workpiece) {
  return { id: piece.id, material: MATERIALS[piece.material].name, tier: tierAt(tierOf(piece.progress)).name,
    status: PIECE_STATUS[piece.status], statusCode: piece.status, value: valueOf(piece),
    coins: piece.status === 'delivered' ? valueOf(piece) : 0,
    scrap: piece.status === 'broken' ? 1 : piece.status === 'recycled' ? recyclingValue(piece) : 0,
    lost: piece.status === 'broken' ? valueOf(piece) : 0 };
}

function roundReceipt(summary: RoundSummary) {
  const pieces = summary.pieces.map(pieceReceipt);
  return { ...summary, pieces, scrap: pieces.reduce((sum, piece) => sum + piece.scrap, 0),
    lost: pieces.reduce((sum, piece) => sum + piece.lost, 0) };
}

export function getRunLedger(view: RunView): RunLedger {
  const rounds = view.history.map(roundReceipt);
  return freezeDeep({ rounds, highestTier: tierAt(view.stats.highestTier).name,
    lost: rounds.reduce((sum, round) => sum + round.lost, 0),
    purchases: view.purchases.map(purchase => ({ ...purchase, label: view.merchant.offers.find(offer => offer.productId === purchase.product)?.label ?? purchase.product })) });
}
