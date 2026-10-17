export type Material = 'iron' | 'steel' | 'meteorite';
export type HammerMode = 'light' | 'standard' | 'heavy';
export type TimingGrade = 'precise' | 'ordinary' | 'mishit';
export type PieceStatus = 'active' | 'delivered' | 'recycled' | 'broken';
export type Phase = 'workshop' | 'roundSummary' | 'merchant' | 'victory' | 'defeat';
export type ProductId = 'handle' | 'bellows' | 'anvil' | 'repair';

export interface Workpiece {
  readonly id: string;
  readonly material: Material;
  readonly progress: number;
  readonly heat: number;
  readonly stress: number;
  readonly integrity: number;
  readonly status: PieceStatus;
}

export type PieceTrio = readonly [Workpiece, Workpiece, Workpiece];

export interface Upgrades {
  readonly handle: number;
  readonly bellows: number;
  readonly anvil: number;
}

export interface RandomStream {
  readonly state: number;
  readonly draws: number;
}

export interface Purchase {
  readonly afterRound: number;
  readonly product: ProductId;
  readonly level: number;
  readonly coins: number;
  readonly scrap: number;
}

export interface GameStats {
  readonly strikes: number;
  readonly successfulStrikes: number;
  readonly damagedStrikes: number;
  readonly heats: number;
  readonly deliveredPieces: number;
  readonly recycledPieces: number;
  readonly brokenPieces: number;
  readonly highestTier: number;
  readonly coinsEarned: number;
  readonly coinsSpent: number;
  readonly scrapEarned: number;
  readonly scrapSpent: number;
  readonly roundsMet: number;
  readonly roundsMissed: number;
}

export interface RoundSummary {
  readonly round: number;
  readonly quota: number;
  readonly delivered: number;
  readonly deficit: number;
  readonly metQuota: boolean;
  readonly sealsBefore: number;
  readonly sealsAfter: number;
  readonly coalRemaining: number;
  readonly pieces: PieceTrio;
}

export interface RunState {
  readonly rulesVersion: 'forge-v1';
  readonly runId: string;
  readonly seed: string;
  readonly revision: number;
  readonly phase: Phase;
  readonly round: number;
  readonly coins: number;
  readonly scrap: number;
  readonly coal: number;
  readonly seals: number;
  readonly upgrades: Upgrades;
  readonly pieces: PieceTrio;
  readonly rng: { readonly stock: RandomStream; readonly strike: RandomStream };
  readonly history: readonly RoundSummary[];
  readonly purchases: readonly Purchase[];
  readonly stats: GameStats;
}

export type Action =
  | { readonly type: 'strike'; readonly pieceId: string; readonly mode: HammerMode; readonly timingMark: number }
  | { readonly type: 'heat' | 'deliver' | 'recycle'; readonly pieceId: string }
  | { readonly type: 'settleRound'; readonly recycleRemaining: boolean }
  | { readonly type: 'advanceSummary' | 'leaveMerchant' };

export interface RunCommand {
  readonly runId: string;
  readonly expectedRevision: number;
  readonly action: Action;
}

export type ErrorCode =
  | 'invalid_run_id' | 'invalid_seed' | 'invalid_command' | 'foreign_run'
  | 'stale_revision' | 'wrong_phase' | 'piece_not_found' | 'piece_finalized'
  | 'no_heat' | 'max_progress' | 'no_coal' | 'already_hot'
  | 'unprocessed_pieces' | 'invalid_timing' | 'invalid_hammer' | 'invalid_rules_version';

export type Availability =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: ErrorCode };

export type DomainEvent =
  | { readonly type: 'StrikeResolved'; readonly pieceId: string; readonly mode: HammerMode;
      readonly timing: TimingGrade; readonly timingMark: number; readonly damageRiskPct: number;
      readonly breakRiskPct: number; readonly outcome: 'success' | 'damage' | 'broken';
      readonly progressGained: number; readonly heatBefore: number; readonly heatAfter: number;
      readonly stressBefore: number; readonly stressAfter: number }
  | { readonly type: 'TierRaised'; readonly pieceId: string; readonly from: number; readonly to: number;
      readonly valueBefore: number; readonly valueAfter: number }
  | { readonly type: 'PieceDelivered'; readonly pieceId: string; readonly value: number }
  | { readonly type: 'PieceRecycled'; readonly pieceId: string; readonly scrap: number }
  | { readonly type: 'PieceBroken'; readonly pieceId: string; readonly lostValue: number; readonly scrap: 1 }
  | { readonly type: 'Heated'; readonly pieceId: string; readonly coalSpent: 1 }
  | { readonly type: 'RoundSettled'; readonly summary: RoundSummary }
  | { readonly type: 'RoundStarted'; readonly round: number; readonly quota: number; readonly coal: number }
  | { readonly type: 'MerchantEntered'; readonly afterRound: number }
  | { readonly type: 'RunEnded'; readonly outcome: 'victory' | 'defeat'; readonly round: number; readonly seals: number };

export type CommandResult =
  | { readonly ok: true; readonly state: RunState; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly state: RunState; readonly error: ErrorCode; readonly events: readonly [] };

export interface CreateRunInput { readonly runId: string; readonly seed: string }
export type CreateResult =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly error: 'invalid_run_id' | 'invalid_seed' };

export interface RiskPreview {
  readonly grade: TimingGrade;
  readonly damageRiskPct: number;
  readonly breakRiskPct: number;
  readonly progressOnSuccess: number;
}

export interface PieceView extends Workpiece {
  readonly materialName: string;
  readonly maxIntegrity: number;
  readonly tier: number;
  readonly tierName: string;
  readonly forgedValue: number;
  readonly deliveredValue: number;
  readonly nextProgress: number | null;
  readonly nextValue: number | null;
  readonly recoverableScrap: number;
  readonly recoveredScrap: number;
  readonly risk: readonly RiskPreview[];
  readonly actions: {
    readonly strike: Availability;
    readonly heat: Availability;
    readonly deliver: Availability;
    readonly recycle: Availability;
  };
}

export interface ViewOptions { readonly pieceId?: string | null; readonly mode?: HammerMode }
export interface RunView {
  readonly runId: string;
  readonly revision: number;
  readonly phase: Phase;
  readonly round: number;
  readonly totalRounds: 12;
  readonly quota: number;
  readonly delivered: number;
  readonly remaining: number;
  readonly coins: number;
  readonly scrap: number;
  readonly coal: number;
  readonly seals: number;
  readonly upgrades: Upgrades;
  readonly mode: HammerMode;
  readonly hammer: { readonly label: string; readonly progress: number; readonly preciseProgress: number;
    readonly heatCost: number; readonly stressCost: number; readonly periodMs: number };
  readonly timingBands: { readonly center: 5000; readonly preciseHalfWidth: number; readonly ordinaryHalfWidth: 2000 };
  readonly pieces: readonly PieceView[];
  readonly selected: PieceView | null;
  readonly nextMerchantRound: number | null;
  readonly actions: { readonly settle: Availability; readonly closeEarly: Availability;
    readonly advance: Availability; readonly leaveMerchant: Availability };
  readonly history: readonly RoundSummary[];
  readonly stats: GameStats;
}
