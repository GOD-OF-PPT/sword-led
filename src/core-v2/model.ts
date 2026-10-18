import type { HammerMode, Material, RandomStream, TimingGrade } from '../core/model.js';
export type { HammerMode, Material, TimingGrade };
export type Stat = 'edge' | 'toughness' | 'balance';
export type Pattern = 'edge' | 'spine' | 'bridge';
export type Technique = 'edgeTooth' | 'bridgeClip' | 'reheatSand' | 'warmTongs' | 'shardBox' | 'balanceWeight';
export type ConditionKind = 'steady' | 'wetCoal' | 'brightFire' | 'brittle' | 'urgent' | 'reclaimed';
export type Phase = 'workshop' | 'roundSummary' | 'merchant' | 'victory' | 'defeat';
export interface Ratings { readonly edge: number; readonly toughness: number; readonly balance: number }
export interface Condition { readonly kind: ConditionKind; readonly stat: Stat | null; readonly pattern: Pattern | null }
export interface Workpiece {
  readonly id: string; readonly material: Material; readonly baseValue: number; readonly temperedBonus: number;
  readonly threshold: number; readonly maxIntegrity: number; readonly integrity: number;
  readonly heat: number; readonly stress: number; readonly ratings: Ratings;
  readonly nodes: readonly number[]; readonly chain: readonly number[]; readonly patterns: readonly Pattern[];
  readonly traces: readonly { readonly pattern: Pattern; readonly nodes: readonly number[]; readonly rewarded: boolean }[];
  readonly strikes: number; readonly heavyStrikes: number; readonly reheats: number; readonly bridgeUsed: boolean;
  readonly quench: 'water' | 'oil' | null; readonly status: 'active' | 'delivered' | 'recycled' | 'broken';
  readonly paidValue: number; readonly recoveredScrap: number;
}
export type RequestKind = 'guard' | 'courier' | 'hunter' | 'protector' | 'ceremony' | 'duelist';
export interface Request {
  readonly id: string; readonly kind: RequestKind; readonly label: string;
  readonly needs: readonly { readonly stat: Stat; readonly minimum: number }[];
  readonly patterns: readonly Pattern[];
}
export interface CustomerReturn {
  readonly requestId: string; readonly label: string; readonly pieceId: string;
  readonly dueRound: number; readonly received: boolean;
}
export interface Summary {
  readonly round: number; readonly quota: number; readonly delivered: number; readonly credit: number;
  readonly met: boolean; readonly sealsBefore: number; readonly sealsAfter: number; readonly nextCredit: number;
  readonly pieces: readonly Workpiece[]; readonly condition: Condition; readonly request: Request | null;
}
export interface Purchase { readonly afterRound: number; readonly productId: Technique | 'repair'; readonly replaced: Technique | null; readonly coins: number; readonly scrap: number }
export interface RunState {
  readonly rulesVersion: 'forge-v2'; readonly runId: string; readonly seed: string; readonly revision: number;
  readonly phase: Phase; readonly round: number; readonly coins: number; readonly scrap: number; readonly coal: number; readonly seals: number;
  readonly starterChosen: boolean; readonly techniques: readonly Technique[];
  readonly pieces: readonly Workpiece[]; readonly condition: Condition; readonly credit: number; readonly pendingCredit: number;
  readonly requests: readonly Request[]; readonly requestDecided: boolean; readonly acceptedRequestId: string | null;
  readonly fulfilledRequestId: string | null; readonly returns: readonly CustomerReturn[];
  readonly roundBreaks: number; readonly merchant: readonly Technique[]; readonly purchases: readonly Purchase[];
  readonly history: readonly Summary[];
  readonly rng: Readonly<Record<'stock' | 'requests' | 'conditions' | 'merchant', RandomStream>>;
  readonly journal: readonly Action[];
}
export type Action =
  | { readonly type: 'chooseTechnique'; readonly techniqueId: Technique }
  | { readonly type: 'chooseRequest'; readonly requestId: string | null }
  | { readonly type: 'strike'; readonly pieceId: string; readonly node: number; readonly mode: HammerMode; readonly timingMark: number }
  | { readonly type: 'reheat' | 'deliver' | 'scrap'; readonly pieceId: string }
  | { readonly type: 'quench'; readonly pieceId: string; readonly medium: 'water' | 'oil' }
  | { readonly type: 'settleRound'; readonly recycleRemaining: boolean }
  | { readonly type: 'buy'; readonly productId: Technique | 'repair'; readonly replaceId?: Technique }
  | { readonly type: 'advanceSummary' | 'leaveMerchant' };
export type ErrorCode = 'invalid_run_id' | 'invalid_seed' | 'invalid_command' | 'foreign_run' | 'stale_revision'
  | 'wrong_phase' | 'choose_technique' | 'choose_request' | 'already_chosen' | 'invalid_technique' | 'invalid_request'
  | 'piece_not_found' | 'piece_finalized' | 'already_quenched' | 'not_forged' | 'invalid_node' | 'node_full'
  | 'invalid_hammer' | 'invalid_timing' | 'no_heat' | 'no_coal' | 'already_hot' | 'unprocessed_pieces'
  | 'not_offered' | 'already_owned' | 'already_purchased' | 'replacement_required' | 'invalid_replacement'
  | 'repair_not_needed' | 'insufficient_coins' | 'insufficient_scrap';
export interface DomainEvent {
  readonly type: 'starter' | 'request' | 'strike' | 'pattern' | 'broken' | 'reheat' | 'quench' | 'delivery' | 'scrap' | 'return' | 'settled' | 'merchant' | 'purchase' | 'round';
  readonly pieceId?: string; readonly value?: number; readonly scrap?: number; readonly grade?: TimingGrade;
  readonly pattern?: Pattern; readonly label?: string;
}
export interface CreateRunInput { readonly runId: string; readonly seed: string }
export type CreateResult = { readonly ok: true; readonly state: RunState } | { readonly ok: false; readonly error: 'invalid_run_id' | 'invalid_seed' };
export type CommandResult = { readonly ok: true; readonly state: RunState; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly state: RunState; readonly error: ErrorCode; readonly events: readonly [] };
export interface PieceOutcome {
  readonly allowed: boolean; readonly reason: ErrorCode | null; readonly piece: Workpiece;
  readonly heatCost: number; readonly stressAdded: number; readonly gained: number; readonly damaged: number;
  readonly pattern: Pattern | null;
}
