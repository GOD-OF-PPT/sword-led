import {canonicalJson} from '../core/validate.js';
import {freezeDeep} from '../core/immutable.js';
import {isRecord} from '../core/guards.js';
import {RECIPE_IDS,TRAIT_IDS,validateRun,getCollectionAwards} from '../core-v5/index.js';
import type {Blade,Recipe,Trait,Eligibility,RunState} from '../core-v5/index.js';
import {validateRun as validateLegacyRun,getCollectionAwards as legacyAwards} from '../core-v4/index.js';
import {validateCollection as validateLegacyCollection,decodeCollection as decodeLegacy,
  COLLECTION_KEY as LEGACY_KEY,COLLECTION_BACKUP_KEY as LEGACY_BACKUP_KEY} from './v4-collection.js';
import type {CollectionState as LegacyCollectionState} from './v4-collection.js';
import {createAdaptedSaveRepository,decodeStoredSave} from '../platform/storage.js';
import type {SaveCodec,SaveRepository,StorageLike} from '../platform/storage.js';

export interface CollectionWork {
  readonly commissionId:number;readonly day:number;readonly routeId:string;
  readonly runId:string;readonly blades:readonly Blade[];readonly rulesVersion:'forge-v4'|'forge-v5';
}
export interface CollectionState {
  readonly chapters:readonly number[];readonly mastery:readonly Recipe[];
  readonly traits:readonly Trait[];readonly challenge:boolean;readonly works:readonly CollectionWork[];
}
export const COLLECTION_KEY='sword-led.collection.v2';
export const COLLECTION_BACKUP_KEY='sword-led.collection.backup.v2';
export const LEGACY_COLLECTION_KEY=LEGACY_KEY;
export const LEGACY_COLLECTION_BACKUP_KEY=LEGACY_BACKUP_KEY;
const keys=(v:Record<string,unknown>,names:readonly string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
type CollectionResult={ok:true;state:CollectionState}|{ok:false;error:string;detail:string};
const invalid=():CollectionResult=>({ok:false,error:'invalid_state',detail:'Expected bounded collection sets and source-tagged commission receipts.'});
export const emptyCollection=():CollectionState=>freezeDeep({chapters:[],mastery:[],traits:[],challenge:false,works:[]});

const score=(w:CollectionWork)=>w.blades.reduce((sum,b)=>sum+b.value,0);
function best(a:CollectionWork,b:CollectionWork):CollectionWork {
  const difference=score(a)-score(b);
  return difference>0?a:difference<0?b:canonicalJson(a)!<=canonicalJson(b)!?a:b;
}
export function mergeCollections(a:CollectionState,b:CollectionState):CollectionState {
  const works=new Map<number,CollectionWork>();
  for(const work of [...a.works,...b.works])works.set(work.commissionId,works.has(work.commissionId)?best(works.get(work.commissionId)!,work):work);
  return freezeDeep({chapters:[...new Set([...a.chapters,...b.chapters])].sort((a,b)=>a-b),
    mastery:RECIPE_IDS.filter(recipe=>a.mastery.includes(recipe)||b.mastery.includes(recipe)),
    traits:TRAIT_IDS.filter(trait=>a.traits.includes(trait)||b.traits.includes(trait)),
    challenge:a.challenge||b.challenge,works:[...works.values()].sort((a,b)=>a.commissionId-b.commissionId)});
}

export function validateCollection(input:unknown):CollectionResult {
  const encoded=canonicalJson(input);if(encoded===null)return invalid();
  const value:unknown=JSON.parse(encoded);
  if(!isRecord(value)||!keys(value,['chapters','mastery','traits','challenge','works'])||!Array.isArray(value.works)||value.works.length>12)return invalid();
  const stripped:unknown[]=[];
  for(const work of value.works){
    if(!isRecord(work)||!keys(work,['commissionId','day','routeId','runId','blades','rulesVersion'])
      ||(work.rulesVersion!=='forge-v4'&&work.rulesVersion!=='forge-v5'))return invalid();
    const {rulesVersion:_,...receipt}=work;
    stripped.push(receipt);
  }
  // Both rule versions retain the same receipt shape and twelve route conditions.
  // The legacy validator checks every bounded field and route; receipts do not claim to contain a full run journal.
  const checked=validateLegacyCollection({...value,works:stripped});
  if(!checked.ok)return invalid();
  const state=value as unknown as CollectionState,normalized=mergeCollections(emptyCollection(),state);
  return same(normalized,state)?{ok:true,state:normalized}:invalid();
}

function tagAwards(state:LegacyCollectionState,rulesVersion:CollectionWork['rulesVersion']):CollectionState {
  return mergeCollections(emptyCollection(),{chapters:state.chapters,mastery:state.mastery,traits:state.traits,challenge:state.challenge,
    works:state.works.map(work=>({...work,rulesVersion}))});
}
/** Only callers holding a core-created or fully replayed v5 state use this internal fast path. */
export function awardsForTrustedRun(state:RunState):CollectionState {
  return tagAwards(getCollectionAwards(state),'forge-v5');
}
export function collectionFromRun(input:unknown):CollectionResult {
  const encoded=canonicalJson(input);if(encoded===null)return invalid();
  const value:unknown=JSON.parse(encoded);
  if(!isRecord(value))return invalid();
  if(value.rulesVersion==='forge-v5'){
    const checked=validateRun(value);
    return checked.ok?{ok:true,state:awardsForTrustedRun(checked.state)}:checked;
  }
  if(value.rulesVersion==='forge-v4'){
    const checked=validateLegacyRun(value);
    return checked.ok?{ok:true,state:tagAwards(legacyAwards(checked.state),'forge-v4')}:checked;
  }
  return {ok:false,error:'invalid_rules_version',detail:'Collection awards require a replayable forge-v4 or forge-v5 run.'};
}
export function collectionFromLegacy(input:unknown):CollectionResult {
  const checked=validateLegacyCollection(input);
  return checked.ok?{ok:true,state:tagAwards(checked.state,'forge-v4')}:checked;
}
export const decodeLegacyCollection=decodeLegacy;
export function collectionEligibility(state:CollectionState):Eligibility {
  return freezeDeep({recipes:RECIPE_IDS.filter(recipe=>recipe==='light'||recipe==='guard'&&state.chapters.includes(1)||recipe==='heavy'&&state.chapters.includes(2)),challenge:state.challenge});
}
export const COLLECTION_CODEC:SaveCodec<CollectionState>=Object.freeze({key:COLLECTION_KEY,backupKey:COLLECTION_BACKUP_KEY,schemaVersion:2,rulesVersion:'forge-collection-v2',validate:validateCollection});
export const decodeCollection=(raw:string|null)=>decodeStoredSave(raw,COLLECTION_CODEC);
export interface CollectionRepository extends SaveRepository<CollectionState> {
  readRaw():{readonly main:{readonly ok:true;readonly raw:string|null}|{readonly ok:false};readonly backup:{readonly ok:true;readonly raw:string|null}|{readonly ok:false}};
}
export interface LegacyCollectionSource {readRaw():ReturnType<CollectionRepository['readRaw']>}
function rawReader(storage:()=>StorageLike,mainKey:string,backupKey:string):()=>ReturnType<CollectionRepository['readRaw']> {
  const read=(key:string)=>{try{return {ok:true as const,raw:storage().getItem(key)};}catch{return {ok:false as const};}};
  return ()=>({main:read(mainKey),backup:read(backupKey)});
}
export function createCollectionRepository(storage:()=>StorageLike,now?:()=>string):CollectionRepository {
  return {...createAdaptedSaveRepository(storage,COLLECTION_CODEC,now),readRaw:rawReader(storage,COLLECTION_KEY,COLLECTION_BACKUP_KEY)};
}
/** A source port only: reading old slots never adopts, rewrites or migrates either one. */
export function createLegacyCollectionSource(storage:()=>StorageLike):LegacyCollectionSource {
  return {readRaw:rawReader(storage,LEGACY_COLLECTION_KEY,LEGACY_COLLECTION_BACKUP_KEY)};
}
