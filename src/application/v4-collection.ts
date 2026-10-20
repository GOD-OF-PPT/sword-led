import {canonicalJson} from '../core/validate.js';
import {freezeDeep} from '../core/immutable.js';
import {isRecord} from '../core/guards.js';
import {COMMISSIONS,RECIPE_IDS,TRAIT_IDS,routeAssessment,validateRun,getCollectionAwards,VALUE_CAP,LEVEL_CAP,JOURNAL_LIMIT} from '../core-v4/index.js';
import type {Blade,Recipe,Trait,Eligibility,RunState} from '../core-v4/index.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,SaveRepository,StorageLike} from '../platform/storage.js';

export interface CollectionWork {
  readonly commissionId:number; readonly day:number; readonly routeId:string;
  readonly runId:string; readonly blades:readonly Blade[];
}
export interface CollectionState {
  readonly chapters:readonly number[]; readonly mastery:readonly Recipe[];
  readonly traits:readonly Trait[]; readonly challenge:boolean; readonly works:readonly CollectionWork[];
}
export const COLLECTION_KEY='sword-led.collection.v1';
export const COLLECTION_BACKUP_KEY='sword-led.collection.backup.v1';
const keys=(v:Record<string,unknown>,names:readonly string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
const integer=(v:unknown,min:number,max:number):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
export const emptyCollection=():CollectionState=>freezeDeep({chapters:[],mastery:[],traits:[],challenge:false,works:[]});

function validBlade(value:unknown,work:{day:number;commissionId:number}):value is Blade {
  if(!isRecord(value)||!keys(value,['id','slot','suppliedDay','recipe','status','base','value','peak','level','cracked','hits','charge','successes','normalGreats','bursts','finalizedDay','commissionId']))return false;
  if(!integer(value.slot,1,3)||!integer(value.suppliedDay,1,work.day)||value.id!==`d${value.suppliedDay}-${value.slot}`)return false;
  if(!RECIPE_IDS.some(r=>r===value.recipe)||value.status!=='commissioned'||value.finalizedDay!==work.day||value.commissionId!==work.commissionId||typeof value.cracked!=='boolean')return false;
  if(!integer(value.base,1,VALUE_CAP)||!integer(value.value,1,VALUE_CAP)||!integer(value.peak,value.value,VALUE_CAP)||!integer(value.level,0,LEVEL_CAP))return false;
  if(!integer(value.hits,0,JOURNAL_LIMIT)||!integer(value.charge,0,6)||!integer(value.bursts,0,JOURNAL_LIMIT)||!integer(value.successes,0,value.hits)||!integer(value.normalGreats,0,value.successes))return false;
  return value.hits===value.bursts*6+value.charge;
}
function validWork(value:unknown):value is CollectionWork {
  if(!isRecord(value)||!keys(value,['commissionId','day','routeId','runId','blades'])||!integer(value.commissionId,1,12)||!integer(value.day,1,12)||!id(value.runId))return false;
  const c=COMMISSIONS[value.commissionId-1]!,route=c.routes.find(r=>r.id===value.routeId);
  if(!route||!Array.isArray(value.blades)||value.blades.length!==route.count)return false;
  const expectedDays=value.commissionId<=4||value.commissionId===8||value.commissionId===12?[value.commissionId]:value.commissionId<8?[5,6,7]:[9,10,11];
  if(!expectedDays.includes(value.day))return false;
  const work={day:value.day,commissionId:value.commissionId};
  return value.blades.every(b=>validBlade(b,work)&&routeAssessment({day:work.day},b,route).matches)
    &&new Set(value.blades.map(b=>(b as Blade).id)).size===route.count;
}
const score=(w:CollectionWork)=>w.blades.reduce((n,b)=>n+b.value,0);
function best(a:CollectionWork,b:CollectionWork):CollectionWork {
  const difference=score(a)-score(b);
  return difference>0?a:difference<0?b:canonicalJson(a)!<=canonicalJson(b)!?a:b;
}
export function mergeCollections(a:CollectionState,b:CollectionState):CollectionState {
  const works=new Map<number,CollectionWork>();
  for(const w of [...a.works,...b.works])works.set(w.commissionId,works.has(w.commissionId)?best(works.get(w.commissionId)!,w):w);
  return freezeDeep({chapters:[...new Set([...a.chapters,...b.chapters])].sort((a,b)=>a-b),
    mastery:RECIPE_IDS.filter(r=>a.mastery.includes(r)||b.mastery.includes(r)),
    traits:TRAIT_IDS.filter(t=>a.traits.includes(t)||b.traits.includes(t)),
    challenge:a.challenge||b.challenge,works:[...works.values()].sort((a,b)=>a.commissionId-b.commissionId)});
}
export function validateCollection(input:unknown):{ok:true;state:CollectionState}|{ok:false;error:string;detail:string} {
  const fail=()=>({ok:false as const,error:'invalid_state',detail:'Expected bounded collection sets and valid commission receipts.'});
  const encoded=canonicalJson(input);if(!encoded)return fail();const v:unknown=JSON.parse(encoded);
  if(!isRecord(v)||!keys(v,['chapters','mastery','traits','challenge','works'])||typeof v.challenge!=='boolean')return fail();
  if(!Array.isArray(v.chapters)||v.chapters.length>3||!v.chapters.every(c=>integer(c,1,3)))return fail();
  if(!Array.isArray(v.mastery)||v.mastery.length>3||!v.mastery.every(r=>RECIPE_IDS.some(id=>id===r)))return fail();
  if(!Array.isArray(v.traits)||v.traits.length>6||!v.traits.every(t=>TRAIT_IDS.some(id=>id===t)))return fail();
  if(!Array.isArray(v.works)||v.works.length>12||!v.works.every(validWork))return fail();
  const state=v as unknown as CollectionState,normalized=mergeCollections(emptyCollection(),state);
  if(!same(normalized,state)||state.chapters.some(c=>c>1&&!state.chapters.includes(c-1)))return fail();
  if(state.challenge&&(!state.chapters.includes(3)||state.works.length<10||![4,8,12].every(c=>state.works.some(w=>w.commissionId===c))))return fail();
  return {ok:true,state:normalized};
}
/** Only callers already holding a core-created/replayed immutable state use this internal fast path. */
export function awardsForTrustedRun(state:RunState):CollectionState {
  const awards=getCollectionAwards(state);
  return mergeCollections(emptyCollection(),{chapters:awards.chapters,mastery:awards.mastery,traits:awards.traits,challenge:awards.challenge,works:awards.works});
}
export function collectionFromRun(input:unknown):{ok:true;state:CollectionState}|{ok:false;error:string;detail:string} {
  const checked=validateRun(input);return checked.ok?{ok:true,state:awardsForTrustedRun(checked.state)}:checked;
}
export function collectionEligibility(state:CollectionState):Eligibility {
  return freezeDeep({recipes:RECIPE_IDS.filter(r=>r==='light'||r==='guard'&&state.chapters.includes(1)||r==='heavy'&&state.chapters.includes(2)),challenge:state.challenge});
}
export const COLLECTION_CODEC:SaveCodec<CollectionState>=Object.freeze({key:COLLECTION_KEY,backupKey:COLLECTION_BACKUP_KEY,schemaVersion:1,rulesVersion:'forge-v4-collection-v1',validate:validateCollection});
export const decodeCollection=(raw:string|null)=>decodeStoredSave(raw,COLLECTION_CODEC);
export interface CollectionRepository extends SaveRepository<CollectionState> {
  readRaw():{readonly main:{readonly ok:true;readonly raw:string|null}|{readonly ok:false};readonly backup:{readonly ok:true;readonly raw:string|null}|{readonly ok:false}};
}
export function createCollectionRepository(storage:()=>StorageLike,now?:()=>string):CollectionRepository {
  const repository=createAdaptedSaveRepository(storage,COLLECTION_CODEC,now);
  const read=(key:string)=>{try{return {ok:true as const,raw:storage().getItem(key)};}catch{return {ok:false as const};}};
  return {...repository,readRaw:()=>({main:read(COLLECTION_KEY),backup:read(COLLECTION_BACKUP_KEY)})};
}
