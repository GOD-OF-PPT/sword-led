import type {RandomStream} from '../core/model.js';

export const RULES_VERSION='forge-v6';
export const MAX_JOURNAL_ACTIONS=500;
export const MAX_SAVE_BYTES=200*1024;
export type School='steady'|'fissure';
export type Tool='rebound'|'furnace';
export type ForgeStage='main'|'echo';
export type Phase='main-forge'|'main-trial'|'cache'|'echo-forge'|'echo-trial'|'echo-recharge'|'recap'|'failed';
export type PieceId='main-1'|'main-2'|'main-3'|'echo-1'|'echo-2'|'echo-3';
export type TargetId='main-guard'|'echo-primary'|'echo-secondary';
export interface CreateRunInput {readonly runId:string;readonly seed:string}
export interface Blade {
 readonly id:PieceId;readonly stage:ForgeStage;readonly school:School|null;
 readonly status:'blank'|'forging'|'sealed'|'failed'|'broken'|'abandoned'|'used';
 readonly strength:number;readonly cracked:boolean;readonly fissureMarked:boolean;readonly hits:number;
 // Sealing facts stay intact while current strength can wear down during trial.
 readonly sealedStrength:number|null;readonly sealedCracked:boolean|null;readonly sealedHits:number|null;
}
export interface TrialStep {
 readonly action:'guard'|'strike'|'followUp'|'rope'|'latch';readonly targetId:TargetId|'rope'|'latch';
 readonly turn:number;readonly strengthBefore:number;readonly strengthAfter:number;
 readonly damage:number;readonly targetBefore:number|null;readonly targetAfter:number|null;readonly usedOpening:boolean;
}
export interface Trial {
 readonly kind:'main'|'rebound'|'furnace';readonly pieceId:PieceId;
 readonly turnsLeft:number;readonly opening:boolean;
 readonly primary:{readonly id:'main-guard'|'echo-primary';readonly health:number;readonly armor:2};
 readonly secondary:{readonly id:'echo-secondary';readonly health:number;readonly armor:0}|null;
 readonly storedOverkill:number;readonly reboundTriggered:boolean;readonly followUpUsed:boolean;
 readonly steps:readonly TrialStep[];
}
export interface EchoRecord {
 readonly started:boolean;readonly submitted:boolean;readonly toolTriggered:boolean;
 readonly rechargeGained:0|1;readonly returnedToForge:boolean;readonly techniqueUsedAfterRecharge:boolean;
 readonly demonstrated:boolean;readonly outcome:'not-started'|'pending'|'demonstrated'|'incomplete';
 readonly reason:string|null;
}
export interface RunState {
 readonly rulesVersion:typeof RULES_VERSION;readonly runId:string;readonly seed:string;
 readonly revision:number;readonly phase:Phase;
 readonly coins:number;readonly gateCleared:boolean;readonly gatePaid:boolean;readonly tool:Tool|null;
 readonly blades:readonly Blade[];readonly activePieceId:PieceId|null;
 readonly charges:{readonly main:0|1;readonly echo:0|1};
 readonly trial:Trial|null;readonly trials:readonly Trial[];readonly echo:EchoRecord;
 readonly rng:{readonly forge:RandomStream};readonly journal:readonly Action[];
 readonly endReason:string|null;
}
export type Action=
 |{readonly type:'chooseSchool';readonly pieceId:PieceId;readonly school:School}
 |{readonly type:'forge';readonly pieceId:PieceId;readonly useTechnique:boolean}
 |{readonly type:'discard'|'seal';readonly pieceId:PieceId}
 |{readonly type:'guard'|'leaveCache'}
 |{readonly type:'strike';readonly targetId:'main-guard'|'echo-primary'}
 |{readonly type:'takeCache';readonly target:'rope'|'latch'}
 |{readonly type:'followUp';readonly targetId:'echo-secondary'};
export type DomainEvent=
 |{readonly type:'SchoolChosen';readonly pieceId:PieceId;readonly school:School}
 |{readonly type:'Forged';readonly pieceId:PieceId;readonly technique:boolean;readonly school:School;
   readonly result:'success'|'crack'|'broken'|'steady'|'fissure';readonly before:number;readonly after:number;
   readonly ticket:number|null;readonly crackTickets:0|200|350;readonly chargeBefore:0|1;readonly chargeAfter:0|1}
 |{readonly type:'Discarded'|'Sealed';readonly pieceId:PieceId}
 |{readonly type:'Guarded';readonly pieceId:PieceId;readonly turnsLeft:number}
 |{readonly type:'Struck';readonly pieceId:PieceId;readonly targetId:TargetId;readonly damage:number;
   readonly overkill:number;readonly before:number;readonly after:number;readonly usedOpening:boolean;readonly turnsLeft:number}
 |{readonly type:'TrialFailed';readonly pieceId:PieceId;readonly stage:ForgeStage}
 |{readonly type:'GateCleared';readonly amount:15;readonly turnsLeft:number}
 |{readonly type:'CacheTaken';readonly target:'rope'|'latch';readonly tool:Tool;readonly damage:number;readonly strengthAfter:number}
 |{readonly type:'EchoStarted';readonly tool:Tool}
 |{readonly type:'FollowUpStored';readonly damage:number}
 |{readonly type:'FollowUpUsed';readonly targetId:'echo-secondary';readonly damage:number;readonly healthAfter:number}
 |{readonly type:'ChargeRestored';readonly before:0|1;readonly after:1;readonly gained:0|1}
 |{readonly type:'Recap';readonly demonstrated:boolean;readonly reason:string}
 |{readonly type:'Failed';readonly reason:string};
export type ErrorCode='invalid_run_id'|'invalid_seed'|'invalid_command'|'wrong_rules'|'wrong_run'|'stale_revision'|
 'wrong_phase'|'piece_unavailable'|'school_required'|'school_locked'|'no_charge'|'already_cracked'|'hammer_limit'|
 'empty_blade'|'turns_exhausted'|'target_unavailable'|'cache_unavailable'|'tool_unavailable'|'record_limit'|'unavailable';
export type CreateRunResult={readonly ok:true;readonly state:RunState}|{readonly ok:false;readonly error:ErrorCode};
export type CommandResult={readonly ok:true;readonly state:RunState;readonly events:readonly DomainEvent[]}|
 {readonly ok:false;readonly state:RunState;readonly error:ErrorCode;readonly events:readonly []};
export type ValidationResult={readonly ok:true;readonly state:RunState}|
 {readonly ok:false;readonly error:'invalid_state'|'invalid_rules_version'|'invalid_journal';readonly detail:string};
export interface Availability {readonly allowed:boolean;readonly reason:ErrorCode|null}
export interface DamagePreview {
 readonly damage:number;readonly strengthBefore:number;readonly strengthAfter:number;readonly ignoresArmor:boolean;
 readonly openingBonus:number;readonly fissureBonus:number;readonly wear:number;
}
export interface ForgePreview {
 readonly ordinary:Availability&{readonly crackTickets:0|200|350;readonly totalTickets:1000;
   readonly successStrength:number;readonly crackStrength:number;readonly crackBreaks:boolean;readonly draws:1};
 readonly technique:Availability&{readonly school:School|null;readonly strengthAfter:number;readonly crackedAfter:boolean;
   readonly fissureMarkedAfter:boolean;readonly chargeAfter:number;readonly draws:0};
 readonly seal:Availability;readonly discard:Availability;readonly chooseSchool:Availability;
}
export interface CachePreview extends Availability {
 readonly target:'rope'|'latch';readonly tool:Tool;readonly required:number;readonly actual:number;
 readonly intactRequired:boolean;readonly intact:boolean;readonly turnsRequired:1;readonly damage:number;readonly strengthAfter:number;
}
export interface RunView {
 readonly rulesVersion:typeof RULES_VERSION;readonly runId:string;readonly revision:number;readonly phase:Phase;
 readonly activePiece:Blade|null;readonly blades:readonly Blade[];readonly unusedBlanks:number;readonly charge:number;
 readonly batch:{readonly stage:ForgeStage;readonly total:3;readonly unusedIds:readonly PieceId[];readonly charge:number};
 readonly coins:number;readonly gateCleared:boolean;readonly gatePaid:boolean;readonly tool:Tool|null;
 readonly forge:ForgePreview|null;
 readonly trial:Trial|null;readonly history:readonly Trial[];
 readonly guard:Availability;readonly strike:Availability&{readonly targetId:'main-guard'|'echo-primary';readonly preview:DamagePreview|null};
 readonly followUp:Availability&{readonly targetId:'echo-secondary';readonly damage:number};
 readonly caches:readonly CachePreview[];readonly leaveCache:Availability;
 // Predictions from this blade do not assert that the gate/cache was actually cleared.
 readonly bladeUses:{readonly direct:DamagePreview;readonly opening:DamagePreview;
   readonly ropeAfterGate:CachePreview;readonly latchAfterGate:CachePreview;
   readonly mainPlan:{readonly clearable:boolean;readonly maxRemainingTurns:number|null;
    readonly routes:readonly {readonly actions:readonly ('guard'|'strike')[];readonly damage:number;
     readonly remainingTurns:number;readonly strengthAfterGate:number;readonly rope:boolean;readonly latch:boolean}[]}}|null;
 readonly echo:EchoRecord;readonly ended:boolean;readonly endReason:string|null;
}
