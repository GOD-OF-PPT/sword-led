import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyCommand,createRun,getRunView,validateRun} from '../../src/core-v4/index.js';
import type {Action,RunState} from '../../src/core-v4/index.js';
import {chapterFacts,commissionImage,endingFacts,journeyOutcome,journeyScreen} from '../../src/presentation-v4/journey.js';
import {buildJourneyStage} from '../../src/presentation-v4/stages.js';
import {awardsForTrustedRun} from '../../src/application/v4-collection.js';

const witness=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')) as RunState;
function take(state:RunState,action:Action){
  const result=applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});
  if(!result.ok)throw Error(result.error);
  return result.state;
}
const creation=createRun({runId:witness.runId,seed:witness.seed,mode:witness.mode,eligibility:witness.initialEligibility});
if(!creation.ok)throw Error(creation.error);
const states:RunState[]=[creation.state];
for(const action of witness.journal)states.push(take(states.at(-1)!,action));
function find(predicate:(state:RunState)=>boolean){const state=states.find(predicate);if(!state)throw Error('Missing real journal prefix');return state;}
const fourth=find(s=>s.day===4&&s.phase==='summary');
const eighth=find(s=>s.day===8&&s.phase==='workshop');
const one=find(s=>s.day===8&&s.phase==='workshop'&&getRunView(s).commission.progress.routes[0]!.count===1);
const two=find(s=>s.day===8&&s.phase==='workshop'&&getRunView(s).commission.progress.complete);
const eighthSummary=find(s=>s.day===8&&s.phase==='summary');
const finishChapter=(state:RunState)=>{
  const settled=take(state,{type:'settle'});
  expect(settled.phase).toBe('chapter');
  return take(settled,{type:'chooseModification',modification:settled.chapterChoices[0]!});
};

describe('eight-day factual journey projections using accepted journal prefixes',()=>{
  it('retains the exact core witness and extends the release boundary without changing a phase',()=>{
    expect(states.at(-1)).toEqual(witness);
    expect(journeyScreen(fourth)).toBe('receipt');
    expect(journeyScreen(fourth,4)).toBe('complete');
    const fifth=take(fourth,{type:'advance'});
    expect(journeyScreen(fifth)).toBe('workshop');
    expect(journeyScreen(fifth,4)).toBe('future');
    expect(journeyScreen(eighthSummary,8)).toBe('complete');
    expect(journeyScreen(take(eighthSummary,{type:'advance'}),8)).toBe('future');
    expect(journeyScreen(eighthSummary)).toBe('receipt');
    expect(journeyScreen(take(eighthSummary,{type:'advance'}))).toBe('workshop');
  });
  it('shows a real second-chapter defeat instead of hiding it behind the former day-four cutoff',()=>{
    let state=take(fourth,{type:'advance'});
    for(let i=0;i<3;i++){state=take(state,{type:'settle'});if(i<2)state=take(state,{type:'advance'});}
    expect(state.day).toBe(7);expect(state.phase).toBe('defeat');
    expect(journeyScreen(state)).toBe('defeat');
    expect(chapterFacts(state,2)).toMatchObject({completed:0,days:3,chapterEndMet:false,chapterResolved:false,chapterEarned:false});
    expect(validateRun(state).ok).toBe(true);
  });
  it('counts chapter facts from that chapter and keeps first-chapter success independent',()=>{
    expect(chapterFacts(eighthSummary,1)).toMatchObject({completed:4,days:4,chapterEndMet:true,chapterEarned:true});
    expect(chapterFacts(eighthSummary,2)).toMatchObject({completed:4,days:4,chapterEndMet:true,chapterEarned:true,startDay:5,endDay:8});
    expect(chapterFacts(eighthSummary,2).lamps.map(l=>l.day)).toEqual([5,6,7,8]);
    expect(chapterFacts(eighth,2).letterAvailable).toBe(true);
    expect(chapterFacts(take(fourth,{type:'advance'}),2).letterAvailable).toBe(false);
  });
  it('uses zero, one and two real commissioned pieces for the three station images',()=>{
    const dark=journeyOutcome(eighth,8),partial=journeyOutcome(one,8),complete=journeyOutcome(two,8);
    expect(dark).toMatchObject({count:0,required:2,complete:false,pieceIds:[],progressText:'0/2'});
    expect(dark.image).toContain('twin-stations-dark-v1.webp');
    expect(partial).toMatchObject({count:1,required:2,complete:false,progressText:'1/2'});
    expect(partial.pieceIds).toHaveLength(0);expect(partial.matchedPieceIds).toHaveLength(1);expect(partial.image).toContain('twin-stations-one-v1.webp');
    expect(complete).toMatchObject({count:2,required:2,complete:true,progressText:'2/2'});
    expect(complete.image).toContain('twin-stations-lit-v1.webp');
    expect(new Set(complete.pieceIds).size).toBe(2);
    expect(complete.blades.every(b=>b.status==='commissioned'&&b.commissionId===8)).toBe(true);
  });
  it('does not turn guild sale money into a station or a matching piece',()=>{
    const blank=eighth.blades.find(b=>b.status==='active'&&b.id!==eighth.reserveId&&!getRunView(eighth).blades.find(v=>v.blade.id===b.id)!.assessment.qualifies)!;
    const sold=take(eighth,{type:'deliver',pieceId:blank.id});
    expect(sold.daySales).toBeGreaterThan(0);
    expect(journeyOutcome(sold,8)).toMatchObject({count:0,complete:false,pieceIds:[]});
  });
  it('retains one accepted sword after an unsuccessful settlement even though no winning route exists',()=>{
    const summary=finishChapter(one),later=take(summary,{type:'advance'});
    expect(summary.history.at(-1)).toMatchObject({met:false,pieceIds:[]});
    expect(chapterFacts(summary,2)).toMatchObject({completed:3,chapterEndMet:false,chapterResolved:true,chapterEarned:true});
    const current=journeyOutcome(summary,8),historical=journeyOutcome(later,8);
    expect(current).toMatchObject({count:1,complete:false,settled:true,met:false});
    expect(historical).toMatchObject({count:1,complete:false,settled:true,met:false});
    expect(historical.pieceIds).toEqual([]);expect(historical.matchedPieceIds).toEqual(current.matchedPieceIds);expect(historical.matchedBlades).toHaveLength(1);
    expect(historical.image).toContain('twin-stations-one-v1.webp');
    expect(validateRun(later).ok).toBe(true);
  });
  it('retains zero-station regret while allowing the real surviving chapter modification',()=>{
    const summary=finishChapter(eighth),later=take(summary,{type:'advance'});
    expect(chapterFacts(summary,2)).toMatchObject({chapterEndMet:false,chapterEarned:true});
    expect(summary.modifications).toHaveLength(2);
    expect(journeyOutcome(later,8)).toMatchObject({count:0,complete:false,pieceIds:[]});
    expect(journeyOutcome(later,8).image).toContain('twin-stations-dark-v1.webp');
  });
  it('uses actual history IDs for a successful past station and never invents rescue success',()=>{
    const previous=journeyOutcome(witness,8);
    expect(previous.pieceIds).toEqual(witness.history.find(h=>h.commissionId===8)!.pieceIds);
    expect(previous).toMatchObject({count:2,complete:true,settled:true,met:true});
    expect(journeyOutcome(fourth,7)).toMatchObject({count:0,complete:false,pieceIds:[]});
    expect(journeyOutcome(fourth,7).image).toContain('winter-forge-v1.webp');
    for(const id of [5,6]){
      expect(journeyOutcome(fourth,id).image).toContain('winter-forge-v1.webp');
      expect(journeyOutcome(witness,id).image).not.toContain('winter-forge-v1.webp');
    }
  });
  it('does not mutate valid input, consume randomness or expose mutable output',()=>{
    const before=JSON.stringify(one),forgeDraws=one.rng.forge.draws;
    const outcome=journeyOutcome(one,8),facts=chapterFacts(one,2);
    expect(JSON.stringify(one)).toBe(before);expect(one.rng.forge.draws).toBe(forgeDraws);
    expect(Object.isFrozen(outcome)).toBe(true);expect(Object.isFrozen(outcome.pieceIds)).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);expect(Object.isFrozen(facts.lamps)).toBe(true);
  });
  it('freezes detached projection copies without freezing a serialized legal caller snapshot',()=>{
    const restored=JSON.parse(JSON.stringify(eighthSummary)) as RunState,before=JSON.stringify(restored);
    expect(validateRun(restored).ok).toBe(true);
    const outcome=journeyOutcome(restored,8),facts=chapterFacts(restored,2);
    expect(JSON.stringify(restored)).toBe(before);
    expect(Object.isFrozen(restored.blades[0])).toBe(false);
    expect(Object.isFrozen(restored.history.at(-1))).toBe(false);
    expect(Object.isFrozen(outcome.blades[0])).toBe(true);
    expect(Object.isFrozen(facts.closing)).toBe(true);
    expect(outcome.blades[0]).not.toBe(restored.blades.find(b=>b.id===outcome.pieceIds[0]));
  });
  it('builds the actual chapter DOM without freezing or changing a valid restored caller',()=>{
    // Minimal DOM ports suffice here; browser layout and actions have separate real-page tests.
    vi.stubGlobal('document',{createElement:()=>({dataset:{},classList:{add(){}},append(){},matches:()=>false})});
    try{
      const restored=JSON.parse(JSON.stringify(eighthSummary)) as RunState,before=JSON.stringify(restored);
      const node=()=>document.createElement('div');
      const stage=buildJourneyStage(restored,{throughDay:8,collection:{data:awardsForTrustedRun(eighthSummary),pending:false,problem:null},action:node,commandAction:node,thumb:node,prop:node,leaveScene(){},book(){},toTitle(){},exportRun(){}});
      expect(stage.mode).toBe('complete');expect(stage.title).toBe('第二程，走完了');
      expect(JSON.stringify(restored)).toBe(before);expect(validateRun(restored).ok).toBe(true);
      expect(Object.isFrozen(restored.history)).toBe(false);expect(Object.isFrozen(restored.history[0])).toBe(false);expect(Object.isFrozen(restored.blades[0])).toBe(false);
    }finally{vi.unstubAllGlobals();}
  });
});

function replayWitness(name:string,change:(action:Action,state:RunState)=>Action=action=>action){
  const saved=JSON.parse(readFileSync(`docs/evidence/T11-4-2-3i1/witness-fixed/${name}.json`,'utf8')) as RunState;
  const created=createRun({runId:saved.runId,seed:saved.seed,mode:saved.mode,eligibility:saved.initialEligibility});
  if(!created.ok)throw Error(created.error);
  return saved.journal.reduce((state,action)=>take(state,change(action,state)),created.state);
}
function replayFinalSwordReturn(){
  const firstSnowSword=witness.history.find(record=>record.commissionId===8)!.pieceIds[0]!;
  // The later guild sale would otherwise become the second qualifying delivery after the skipped receipt.
  return replayWitness('complete',(action,state)=>state.day===8&&action.type==='deliver'&&action.pieceId!==firstSnowSword?{type:'scrap',pieceId:action.pieceId}:action);
}
const eleventh=find(s=>s.day===11&&s.phase==='workshop');
function newRelayBlade(state:RunState,pieceId:string){
  state=take(state,{type:'setRecipe',pieceId,recipe:'light'});
  state=take(state,{type:'strike',pieceId});state=take(state,{type:'strike',pieceId});
  return take(state,{type:'deliver',pieceId});
}

describe('final chapter, actual route receipts and core-decided endings',()=>{
  it('keeps both new-sword relay progress and a later old-sword winning receipt',()=>{
    const first=newRelayBlade(eleventh,'d11-1');
    expect(journeyOutcome(first,11)).toMatchObject({complete:false,routeId:null,pieceIds:[],matchedPieceIds:['d11-1'],progressText:'0/1 或 1/2'});
    expect(journeyOutcome(first,11).image).toContain('relay-one-v1.webp');
    const old=take(take(first,{type:'reserve',pieceId:'d10-2'}),{type:'deliver',pieceId:'d10-2'});
    const outcome=journeyOutcome(old,11);
    expect(outcome).toMatchObject({complete:true,routeId:'old',pieceIds:['d10-2'],matchedPieceIds:['d11-1','d10-2'],progressText:'1/1 或 1/2'});
    expect(outcome.blades.map(b=>b.id)).toEqual(['d10-2']);
    expect(outcome.matchedBlades.map(b=>b.id)).toEqual(['d11-1','d10-2']);
    const settled=take(old,{type:'settle'}),historical=journeyOutcome(take(settled,{type:'advance'}),11);
    expect(historical.pieceIds).toEqual(outcome.pieceIds);expect(historical.matchedPieceIds).toEqual(outcome.matchedPieceIds);
    expect(validateRun(settled).ok).toBe(true);
  });
  it('retains a single new relay sword after a missed settlement, and requires a second distinct new sword',()=>{
    const first=newRelayBlade(eleventh,'d11-1'),settled=take(first,{type:'settle'}),later=take(settled,{type:'advance'});
    expect(journeyOutcome(later,11)).toMatchObject({complete:false,pieceIds:[],matchedPieceIds:['d11-1'],count:1,required:2,settled:true,met:false});
    expect(journeyOutcome(later,11).image).toContain('relay-one-v1.webp');
    const complete=newRelayBlade(first,'d11-2');
    expect(journeyOutcome(complete,11)).toMatchObject({complete:true,routeId:'two-new',pieceIds:['d11-1','d11-2'],matchedPieceIds:['d11-1','d11-2']});
    expect(journeyOutcome(complete,11).image).toContain('relay-complete-v1.webp');
    expect(validateRun(later).ok).toBe(true);expect(validateRun(complete).ok).toBe(true);
  });
  it('uses commission IDs and actual delivered days in a reordered challenge with eleven completed commissions',()=>{
    const challenge=replayWitness('challenge'),facts=endingFacts(challenge)!;
    expect(challenge.phase).toBe('victory');expect(journeyScreen(challenge)).toBe('ending');
    expect(facts).toMatchObject({phase:'victory',completed:11,missingCritical:[],finalBladeMade:true});
    expect(journeyOutcome(challenge,11)).toMatchObject({day:9,routeId:'old',pieceIds:['d8-3'],complete:true});
    expect(journeyOutcome(challenge,11).image).toContain('relay-complete-v1.webp');
    expect(facts.people.find(p=>p.name==='杜伯')!.records.find(r=>r.commissionId===9)).toMatchObject({day:10,status:'missed'});
    expect(facts.people.find(p=>p.name==='阿禾')!.records.find(r=>r.commissionId===11)).toMatchObject({day:9,status:'met'});
  });
  it('leaves final sword delivery in the workshop and enters the ending only on settlement',()=>{
    const before=find(s=>s.day===12&&s.phase==='workshop'&&getRunView(s).commission.progress.complete);
    expect(journeyScreen(before)).toBe('workshop');expect(endingFacts(before)).toBeNull();
    expect(journeyOutcome(before,12).image).toContain('last-lantern-delivered-v1.webp');
    const final=take(before,{type:'settle'});
    expect(journeyScreen(final)).toBe('ending');expect(endingFacts(final)!.image).toContain('ending-twelve-lights-v1.webp');
    expect(endingFacts(final)).toMatchObject({completed:12,missingCritical:[],finalBladeMade:true});
  });
  it('distinguishes a missing final sword from a return that already made the final sword',()=>{
    const without=replayWitness('return'),withFinal=replayFinalSwordReturn();
    expect(without.phase).toBe('return');expect(withFinal.phase).toBe('return');
    expect(endingFacts(without)).toMatchObject({completed:11,missingCritical:[12],finalBladeMade:false});
    expect(endingFacts(withFinal)).toMatchObject({completed:11,missingCritical:[8],finalBladeMade:true});
    expect(endingFacts(withFinal)!.image).toContain('ending-homeward-v1.webp');
    expect(endingFacts(withFinal)!.works.find(w=>w.commissionId===12)!.blades[0]!.level).toBeGreaterThanOrEqual(9);
    expect(validateRun(withFinal).ok).toBe(true);
  });
  it('does not turn unreached stations or earlier missed deliveries into saved works',()=>{
    const defeat=replayWitness('defeat'),facts=endingFacts(defeat)!;
    expect(journeyScreen(defeat)).toBe('defeat');expect(facts.phase).toBe('defeat');
    expect(facts.works).toEqual([]);expect(facts.lamps.filter(l=>l.status==='missed')).toHaveLength(3);
    expect(facts.lamps.filter(l=>l.status==='unreached')).toHaveLength(9);
    expect(facts.people.find(p=>p.name==='阿岚')).toMatchObject({completed:0,missed:1,unreached:3});
    expect(facts.image).toContain('ending-embers-v1.webp');
  });
  it('returns immutable ending copies without freezing or changing a legal serialized caller',()=>{
    const restored=JSON.parse(JSON.stringify(witness)) as RunState,before=JSON.stringify(restored),facts=endingFacts(restored)!;
    expect(JSON.stringify(restored)).toBe(before);expect(Object.isFrozen(restored.blades[0])).toBe(false);
    expect(Object.isFrozen(facts)).toBe(true);expect(Object.isFrozen(facts.lamps[0]!.matchedBlades)).toBe(true);
    expect(facts.works[0]!.blades[0]).not.toBe(restored.blades.find(b=>b.id===facts.works[0]!.pieceIds[0]));
    expect(facts.completed).toBe(getRunView(structuredClone(restored)).ending!.completed);
    expect(commissionImage(11,{complete:true,routeId:'old',count:1,required:1})).toContain('relay-complete-v1.webp');
    expect(()=>commissionImage(99,{complete:false})).toThrow(RangeError);
  });
  it('builds a true day-eight continuation, neutral third-chapter arrival and legal ending challenge intent',()=>{
    const labels:string[]=[],texts:string[]=[];
    vi.stubGlobal('document',{createElement:()=>({dataset:{},classList:{add(){}},append(){},matches:()=>false,set textContent(copy:string){texts.push(copy);}})});
    try{
      const node=()=>document.createElement('div'),action=(label:string)=>{labels.push(label);return node();},startChallenge=vi.fn();
      const context={throughDay:12 as const,collection:{data:awardsForTrustedRun(witness),pending:false,problem:null},action,commandAction:action,thumb:node,prop:node,leaveScene(){},book(){},toTitle(){},exportRun(){},startChallenge};
      const receipt=buildJourneyStage(eighthSummary,context);
      expect(receipt.mode).toBe('receipt');expect(labels).toContain('沿灯路，去下一天');
      const intro=buildJourneyStage(take(eighthSummary,{type:'advance'}),{...context,chapterIntro:true});
      expect(intro.image).toContain('mountain-pass-arrival-v1.webp');expect(intro.title).toContain('第三章');
      const ending=buildJourneyStage(witness,context);
      expect(ending.mode).toBe('ending');expect(ending.title).toBe('十二灯复明');expect(labels).toContain('行脚挑战，再走一程');
      labels.length=0;
      buildJourneyStage(witness,{...context,collection:{...context.collection,pending:true}});
      expect(labels).not.toContain('行脚挑战，再走一程');
      expect(startChallenge).not.toHaveBeenCalled();
      texts.length=0;
      const madeButReturn=replayFinalSwordReturn();
      buildJourneyStage(madeButReturn,context);
      expect(texts.join('\n')).toContain('山口护灯剑已经做成');expect(texts.join('\n')).not.toContain('山口护灯剑尚未做成');
    }finally{vi.unstubAllGlobals();}
  });
});
