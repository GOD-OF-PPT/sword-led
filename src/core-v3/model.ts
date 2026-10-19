import type {RandomStream} from '../core/model.js';
export type Trait='steady'|'ember'|'inherit'|'echo'|'crackedEdge'|'pardon';
export type Phase='workshop'|'summary'|'experienceComplete'|'victory'|'defeat';
export interface Blade {
  readonly id:string;readonly suppliedRound:number;readonly status:'active'|'delivered'|'recycled'|'broken'|'traded';
  readonly base:number;readonly value:number;readonly peak:number;readonly level:number;readonly cracked:boolean;
  readonly hits:number;readonly charge:number;readonly successes:number;readonly finalizedRound:number|null;
}
export type Action=
  |{readonly type:'strike'|'deliver'|'scrap'|'reserve';readonly pieceId:string}
  |{readonly type:'buy';readonly pieceId:string;readonly traitId:Trait;readonly replaceId?:Trait}
  |{readonly type:'claimGift';readonly traitId:Trait|null;readonly replaceId?:Trait}
  |{readonly type:'upgrade'|'repair'|'settle'|'advance'};
export interface RoundRecord {readonly round:number;readonly quota:number;readonly delivered:number;readonly met:boolean;
  readonly recovered:number;readonly recoveredIds:readonly string[];readonly reserveId:string|null;readonly sealsBefore:number;readonly sealsAfter:number;readonly protected:boolean}
export interface RunState {
  readonly rulesVersion:'forge-v3';readonly runId:string;readonly seed:string;readonly roundLimit:3|12;readonly revision:number;
  readonly phase:Phase;readonly round:number;readonly coins:number;readonly seals:number;readonly base:number;
  readonly blades:readonly Blade[];readonly reserveId:string|null;readonly delivered:number;readonly traits:readonly Trait[];
  readonly gift:'locked'|'available'|'claimed';readonly pardonUsed:boolean;readonly pendingInheritance:number;
  readonly shop:readonly Trait[];readonly sold:readonly Trait[];readonly upgraded:boolean;readonly repaired:boolean;
  readonly history:readonly RoundRecord[];readonly rng:{readonly forge:RandomStream;readonly shop:RandomStream};readonly journal:readonly Action[];
}
export interface CreateRunInput {readonly runId:string;readonly seed:string;readonly roundLimit?:3|12}
export type ErrorCode='invalid_run_id'|'invalid_seed'|'invalid_command'|'wrong_run'|'stale_revision'|'wrong_phase'|'piece_unavailable'|'reserved_piece'|'at_cap'|'record_limit'|'no_shop'|'already_owned'|'sold_out'|'invalid_replacement'|'insufficient_coins'|'unavailable';
export interface Hit {readonly result:'success'|'great'|'crack'|'broken';readonly before:number;readonly after:number;readonly level:number;readonly triggers:readonly Trait[]}
export type DomainEvent=
  |{readonly type:'Strike';readonly pieceId:string;readonly burst:boolean;readonly hits:readonly Hit[]}
  |{readonly type:'Delivered'|'Recycled'|'Traded';readonly pieceId:string;readonly amount:number}
  |{readonly type:'Reserved';readonly pieceId:string;readonly previousId:string|null}
  |{readonly type:'Trait';readonly traitId:Trait|null}
  |{readonly type:'Upgraded'|'Repaired'|'Advanced'}
  |{readonly type:'Settled';readonly summary:RoundRecord};
export type CommandResult={readonly ok:true;readonly state:RunState;readonly events:readonly DomainEvent[]}|{readonly ok:false;readonly state:RunState;readonly error:ErrorCode;readonly events:readonly []};
