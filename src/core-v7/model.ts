import type {RandomStream} from '../core/model.js';

export const RULES_VERSION='forge-v7';
export const MAX_JOURNAL_ACTIONS=500;
export const MAX_SAVE_BYTES=200*1024;
export type Chapter=1|2|3;
export type NodeId=1|2|3|4|5|6|7|8|9;
export type Technique='ordinary'|'steady'|'fissure';
export type ToolKind='rebound'|'furnace';
export type Phase='prepare'|'forging'|'encounter'|'choice'|'failed'|'ending';
export type ChoiceKind='first-road'|'bridge-rescue'|'bridge-tool'|'crossing-extra'|'camp-old-sword'|'station-first'|'station-second'|'shelter-ring'|'relay-carrier';
export type ChoiceId='escort'|'salvage'|'rescue-ferryman'|'save-cargo'|'take-rebound'|'take-furnace'|'leave-crossing'|'hold-crossing'|'keep-old'|'dismantle-old'|'pay-upgrade'|'north-first'|'south-first'|'leave-station'|'continue-station'|'take-ring'|'leave-ring'|'courier-carries'|'player-carries';
export type EncounterId='n1'|'n2'|'n3-main'|'n3-extra'|'n5-north'|'n5-south'|'n6'|'n7'|'n8'|'n9';
export type TargetId='wood-guard'|'bridge-latch'|'charger'|'flanker'|'rammer'|'north-latch'|'south-latch'|'roof-lock'|'main-rock'|'loose-rock'|'relay-latch'|'drive-lock'|'reverse-wheel';
export type CutTarget='bridge-rope'|'south-rope'|'relay-rope';
export type WeaponSlot='hand'|'reserve';
export type ErrorCode='invalid_run_id'|'invalid_seed'|'invalid_command'|'wrong_rules'|'wrong_run'|'stale_revision'|'record_limit'|'wrong_phase'|'unavailable'|'weapon_unavailable'|'no_blanks'|'no_charge'|'hammer_limit'|'empty_blade'|'already_fissure'|'slot_occupied'|'invalid_target'|'not_enough_actions'|'guard_already_used'|'not_enough_coins'|'at_capacity'|'upgrade_used'|'no_tool'|'no_rebound'|'not_worn'|'no_retry'|'not_ready'|'not_enough_light'|'choice_unavailable';

export interface Weapon {
 readonly id:string;
 readonly source:'inherited'|'forged';
 readonly madeInChapter:Chapter;
 readonly status:'forging'|'sealed'|'broken'|'donated'|'discarded';
 readonly owner:'forge'|'player'|'alan'|'shelter'|'lamp'|'none';
 readonly strength:number;
 readonly sealedStrength:number|null;
 readonly hits:number;
 readonly cracked:boolean;
 readonly fissureMarked:boolean;
 readonly technique:'steady'|'fissure'|null;
}
export interface ToolState {
 readonly kind:ToolKind;
 readonly level:1|2;
 readonly stored:number;
}
export interface StoryFlags {
 readonly escortFirst:boolean|null;
 readonly ferrymanSaved:boolean|null;
 readonly crossingHeld:boolean;
 readonly northSaved:boolean;
 readonly southSaved:boolean;
 readonly firstStation:'north'|'south'|null;
 readonly ferryAssistUsed:boolean;
 readonly ring:'taken'|'left'|null;
 readonly oldDecision:'kept'|'dismantled'|'paid'|null;
 readonly donatedToAlan:string|null;
 readonly shelterSword:string|null;
 readonly carrier:'courier'|'player'|null;
 readonly coreOwner:'player'|'courier'|'socket'|'party';
}
export interface EncounterTarget {
 readonly id:TargetId;
 readonly name:string;
 readonly role:'threat'|'mechanism';
 readonly health:number;
 readonly maxHealth:number;
 readonly armor:number;
 readonly pressures:readonly number[];
 readonly requiresDestroyed:TargetId|null;
}
export interface EncounterStep {
 readonly round:number;
 readonly action:string;
 readonly weaponId:string|null;
 readonly targetId:string|null;
 readonly amount:number;
 readonly before:number|null;
 readonly after:number|null;
}
export interface Encounter {
 readonly id:EncounterId;
 readonly round:number;
 readonly roundLimit:number;
 readonly actions:number;
 readonly block:number;
 readonly opening:boolean;
 readonly guarded:boolean;
 readonly braced:boolean;
 readonly braceAssistUsed:boolean;
 readonly alanGuard:boolean;
 readonly reboundClaimed:boolean;
 readonly followUpUsed:boolean;
 readonly furnaceTriggered:boolean;
 readonly routeOpened:boolean;
 readonly targets:readonly EncounterTarget[];
 readonly environment:readonly number[];
 readonly steps:readonly EncounterStep[];
}
export interface EncounterRecord {
 readonly encounter:Encounter;
 readonly outcome:'completed'|'failed';
 readonly lampAfter:number;
}
export interface NodeRecord {
 readonly node:NodeId;
 readonly choices:readonly ChoiceId[];
 readonly coinsEarned:number;
 readonly completed:boolean;
}
export interface Ending {
 readonly kind:'relit'|'homeward'|'embers';
 readonly node:NodeId;
 readonly dedicatedWeaponId:string|null;
}
export interface Failure {readonly reason:'light-exhausted'|'round-limit'|'retreat';readonly node:NodeId}
export interface PlayableState {
 readonly chapter:Chapter;
 readonly node:NodeId;
 readonly phase:Phase;
 readonly choice:ChoiceKind|null;
 readonly lamp:number;
 readonly coins:number;
 readonly blanks:number;
 readonly charge:0|1;
 readonly weapons:readonly Weapon[];
 readonly handId:string|null;
 readonly reserveId:string|null;
 readonly forgeId:string|null;
 readonly tool:ToolState|null;
 readonly upgradeUsed:boolean;
 readonly flags:StoryFlags;
 readonly encounter:Encounter|null;
 readonly encounterHistory:readonly EncounterRecord[];
 readonly nodes:readonly NodeRecord[];
 readonly rng:RandomStream;
 readonly failure:Failure|null;
 readonly ending:Ending|null;
}
export interface FailedAttempt {
 readonly atRevision:number;
 readonly chapter:Chapter;
 readonly node:NodeId;
 readonly reason:Failure['reason'];
 readonly lamp:number;
 readonly coins:number;
 readonly weapons:readonly Weapon[];
 readonly encounter:Encounter|null;
 readonly flags:StoryFlags;
}
export interface RunState extends PlayableState {
 readonly rulesVersion:typeof RULES_VERSION;
 readonly runId:string;
 readonly seed:string;
 readonly revision:number;
 readonly weaponSerial:number;
 readonly retries:Readonly<Record<Chapter,0|1>>;
 readonly failedAttempts:readonly FailedAttempt[];
 readonly checkpoint:PlayableState;
 readonly journal:readonly Action[];
}
export type Action=
 |{readonly type:'beginForge'}
 |{readonly type:'forge';readonly weaponId:string;readonly kind:Technique}
 |{readonly type:'seal';readonly weaponId:string;readonly slot:WeaponSlot;readonly replace:boolean}
 |{readonly type:'discardForge';readonly weaponId:string}
 |{readonly type:'equip'|'discardWeapon'|'temper'|'ignite';readonly weaponId:string}
 |{readonly type:'depart'|'guard'|'endRound'|'ferryAssist'|'useSideRoute'|'placeCore'|'assistBrace'|'retryChapter'|'evacuate'|'acceptFailure'}
 |{readonly type:'choose';readonly choice:ChoiceId}
 |{readonly type:'strike'|'followUp';readonly targetId:TargetId}
 |{readonly type:'cut';readonly targetId:CutTarget}
 |{readonly type:'donate';readonly weaponId:string;readonly recipient:'shelter'|'alan'}
 |{readonly type:'shop';readonly item:'coal'|'blank'|'upgrade'|'exchange'};
export type DomainEvent=
 |{readonly type:'ForgeStarted';readonly weaponId:string}
 |{readonly type:'Forged';readonly weaponId:string;readonly kind:Technique;readonly result:'success'|'crack'|'broken'|'steady'|'fissure';readonly before:number;readonly after:number;readonly ticket:number|null;readonly crackTickets:number;readonly chargeBefore:number;readonly chargeAfter:number}
 |{readonly type:'Sealed';readonly weaponId:string;readonly slot:WeaponSlot;readonly replacedId:string|null}
 |{readonly type:'Equipped';readonly weaponId:string;readonly previousId:string|null;readonly actions:number|null}
 |{readonly type:'Discarded'|'Broken';readonly weaponId:string}
 |{readonly type:'Donated';readonly weaponId:string;readonly recipient:'shelter'|'alan'|'lamp'|'upgrade'}
 |{readonly type:'EncounterStarted';readonly encounterId:EncounterId;readonly node:NodeId}
 |{readonly type:'Struck';readonly source:'strike'|'followUp';readonly weaponId:string|null;readonly targetId:TargetId;readonly damage:number;readonly before:number;readonly after:number;readonly strengthBefore:number|null;readonly strengthAfter:number|null;readonly opening:boolean}
 |{readonly type:'Guarded';readonly block:number;readonly braced:boolean}
 |{readonly type:'RoundEnded';readonly round:number;readonly pressure:number;readonly reduction:number;readonly block:number;readonly loss:number;readonly before:number;readonly after:number}
 |{readonly type:'ReboundStored';readonly before:number;readonly after:number}
 |{readonly type:'Recharged';readonly before:number;readonly after:number;readonly gained:number}
 |{readonly type:'Tempered';readonly weaponId:string;readonly before:number;readonly after:number;readonly crackCleared:boolean}
 |{readonly type:'MechanismUsed';readonly mechanism:CutTarget|'side-route'|'ferry'|'core'|'brace-assist';readonly targetId:string|null}
 |{readonly type:'EncounterCompleted';readonly encounterId:EncounterId;readonly lamp:number}
 |{readonly type:'ChoiceMade';readonly choice:ChoiceId;readonly node:NodeId}
 |{readonly type:'NodeCompleted';readonly node:NodeId}
 |{readonly type:'ChapterStarted';readonly chapter:Chapter;readonly lampBefore:number;readonly lampAfter:number;readonly blanksBefore:number;readonly blanksAfter:number}
 |{readonly type:'CoinsChanged';readonly amount:number;readonly total:number;readonly reason:string}
 |{readonly type:'LightChanged';readonly amount:number;readonly total:number;readonly reason:string}
 |{readonly type:'ToolChanged';readonly kind:ToolKind;readonly level:1|2}
 |{readonly type:'ShopUsed';readonly item:'coal'|'blank'|'upgrade'|'exchange';readonly price:number}
 |{readonly type:'Failed';readonly reason:Failure['reason'];readonly node:NodeId}
 |{readonly type:'Retried';readonly chapter:Chapter;readonly used:1}
 |{readonly type:'EndingReached';readonly kind:Ending['kind'];readonly dedicatedWeaponId:string|null};
export interface CreateRunInput {readonly runId:string;readonly seed:string}
export type CreateRunResult={readonly ok:true;readonly state:RunState}|{readonly ok:false;readonly error:ErrorCode};
export type CommandResult={readonly ok:true;readonly state:RunState;readonly events:readonly DomainEvent[]}|
 {readonly ok:false;readonly state:RunState;readonly error:ErrorCode;readonly events:readonly []};
export type ValidationResult={readonly ok:true;readonly state:RunState}|{readonly ok:false;readonly error:string;readonly detail:string};
export type Mutable<T>=T extends readonly(infer U)[]?Mutable<U>[]:T extends object?{-readonly[K in keyof T]:Mutable<T[K]>}:T;
/** Internal drafts are created only by the pure command owner. Never expose one as a saved result. */
export type Draft=Mutable<RunState>;
