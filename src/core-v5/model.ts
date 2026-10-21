import type {RandomStream} from '../core/model.js';
export type {Trait} from '../core-v3/model.js';
import type {Trait} from '../core-v3/model.js';

export type Recipe='light'|'guard'|'heavy';
export type Modification='windbox'|'warmRack'|'wideMouth';
export type EventId='donation'|'loan'|'salvage'|'credit'|'shelter'|'rest';
export type Phase='opening'|'workshop'|'chapter'|'summary'|'victory'|'return'|'defeat';
export type Mode='story'|'challenge';
export interface Eligibility {readonly recipes:readonly Recipe[];readonly challenge:boolean}
export interface CreateRunInput {readonly runId:string;readonly seed:string;readonly mode?:Mode;readonly eligibility?:Eligibility}
export interface Blade {
 readonly id:string;readonly slot:number;readonly suppliedDay:number;readonly recipe:Recipe;
 readonly status:'active'|'commissioned'|'sold'|'recycled'|'broken'|'traded'|'donated'|'bartered';
 readonly base:number;readonly value:number;readonly peak:number;readonly level:number;readonly cracked:boolean;
 readonly hits:number;readonly charge:number;readonly successes:number;readonly normalGreats:number;readonly bursts:number;
 readonly finalizedDay:number|null;readonly commissionId:number|null;
}
export interface RouteCondition {
 readonly id:string;readonly count:number;readonly value:number;readonly recipe?:Recipe;
 readonly crack?:'intact'|'cracked';readonly age?:'old'|'new';readonly maxHits?:number;readonly minLevel?:number;readonly minBursts?:number;
}
export interface Commission {
 readonly id:number;readonly title:string;readonly customer:'guard'|'courier'|'smith';readonly name:string;
 readonly request:string;readonly success:string;readonly failure:string;readonly scene:string;readonly routes:readonly RouteCondition[];
}
export interface DayRecord {
 readonly day:number;readonly commissionId:number;readonly met:boolean;readonly routeId:string|null;readonly pieceIds:readonly string[];
 readonly sales:number;readonly recovered:number;readonly baseFees:number;readonly marketSpent:number;readonly recoveredIds:readonly string[];readonly reserveId:string|null;
 readonly sealsBefore:number;readonly sealsAfter:number;readonly protected:boolean;readonly modification:Modification|null;
}
export interface EventRecord {readonly day:number;readonly id:EventId;readonly choice:'accept'|'decline';readonly pieceId:string|null;readonly coins:number}
export interface DayBuffs {readonly supplyPct:100|120;readonly loan:boolean;readonly shelter:boolean}
export interface RunState {
 readonly rulesVersion:'forge-v5';readonly runId:string;readonly seed:string;readonly mode:Mode;readonly initialEligibility:Eligibility;
 readonly revision:number;readonly phase:Phase;readonly day:number;readonly commissionOrder:readonly number[];
 readonly coins:number;readonly seals:number;readonly supplyBase:number;readonly upgradeCount:number;readonly inheritance:number;
 readonly blades:readonly Blade[];readonly reserveId:string|null;readonly daySales:number;readonly dayRecovered:number;readonly marketSpent:number;
 readonly traits:readonly Trait[];readonly gift:'locked'|'available'|'claimed';readonly pardonUsed:boolean;readonly crackGuard:boolean;
 readonly modifications:readonly Modification[];readonly chapterChoices:readonly Modification[];
 readonly shop:readonly Trait[];readonly sold:readonly Trait[];readonly upgraded:boolean;readonly repaired:boolean;
 readonly dayBuffs:DayBuffs;readonly pending:DayBuffs;readonly eventDeck:readonly EventId[];readonly eventId:EventId|null;
 readonly eventStatus:'none'|'available'|'accepted'|'declined';readonly eventHistory:readonly EventRecord[];
 readonly history:readonly DayRecord[];readonly rng:{readonly forge:RandomStream;readonly shop:RandomStream;readonly events:RandomStream;readonly content:RandomStream};readonly journal:readonly Action[];
}
export type Action=
 |{readonly type:'continue'|'upgrade'|'repair'|'settle'|'advance'}
 |{readonly type:'strike'|'deliver'|'scrap'|'reserve';readonly pieceId:string}
 |{readonly type:'setRecipe';readonly pieceId:string;readonly recipe:Recipe}
 |{readonly type:'buy';readonly pieceId:string;readonly traitId:Trait;readonly replaceId?:Trait}
 |{readonly type:'claimGift';readonly traitId:Trait|null;readonly replaceId?:Trait}
 |{readonly type:'chooseModification';readonly modification:Modification}
 |{readonly type:'chooseEvent';readonly choice:'accept'|'decline';readonly pieceId?:string};
export type Trigger=Trait|Modification|'loan'|'credit'|'shelter';
export interface Hit {readonly result:'success'|'great'|'crack'|'broken';readonly before:number;readonly after:number;readonly level:number;readonly triggers:readonly Trigger[];readonly recoveryAmount:number}
export type DomainEvent=
 |{readonly type:'Strike';readonly pieceId:string;readonly burst:boolean;readonly hits:readonly Hit[]}
 |{readonly type:'Delivered';readonly pieceId:string;readonly amount:number;readonly matched:boolean;readonly commissionId:number;readonly pieceValue:number;readonly baseFeeDelta:number;readonly qualityBonus:number;readonly marketRemaining:number}
 |{readonly type:'MainCompleted';readonly commissionId:number;readonly routeId:string;readonly pieceIds:readonly string[]}
 |{readonly type:'Disposed';readonly pieceId:string;readonly disposition:Blade['status'];readonly amount:number;readonly marketRemaining:number}
 |{readonly type:'Reserved';readonly pieceId:string;readonly previousId:string|null}
 |{readonly type:'Recipe';readonly pieceId:string;readonly recipe:Recipe}
 |{readonly type:'Trait';readonly traitId:Trait|null;readonly compensation:number}
 |{readonly type:'Modification';readonly modification:Modification}
 |{readonly type:'EventChoice';readonly record:EventRecord}
 |{readonly type:'Settled';readonly record:DayRecord}
 |{readonly type:'Opened'|'Advanced'|'Upgraded'|'Repaired'|'GiftAvailable'};
export type ErrorCode='invalid_run_id'|'invalid_seed'|'invalid_command'|'wrong_rules'|'wrong_run'|'stale_revision'|'wrong_phase'|'piece_unavailable'|'reserved_piece'|'at_cap'|'record_limit'|'no_shop'|'already_owned'|'sold_out'|'invalid_replacement'|'insufficient_coins'|'unavailable'|'recipe_locked'|'recipe_unavailable'|'challenge_locked'|'market_exhausted'|'blade_unworked';
export type CommandResult={readonly ok:true;readonly state:RunState;readonly events:readonly DomainEvent[]}|{readonly ok:false;readonly state:RunState;readonly error:ErrorCode;readonly events:readonly []};
