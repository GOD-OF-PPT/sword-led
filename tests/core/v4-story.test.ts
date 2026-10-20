import {describe,it,expect} from 'vitest';
import {createRun,applyCommand} from '../../src/core-v4/index.js';
import type {RunState,Action} from '../../src/core-v4/index.js';
import {firstChapterScreen,firstChapterFacts,noticeFromEvents} from '../../src/presentation-v4/story.js';
import {readFileSync} from 'node:fs';
const witness=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')) as RunState;
function start(){const r=createRun({runId:'story-real',seed:witness.seed});if(!r.ok)throw Error(r.error);return r.state;}
function take(s:RunState,action:Action){const r=applyCommand(s,{runId:s.runId,expectedRevision:s.revision,action});if(!r.ok)throw Error(r.error);return r;}
describe('first-chapter factual presentation',()=>{
 it('resolves actual commission receipts before a truthful chapter slice, then protects later saves',()=>{let s=start();expect(firstChapterScreen(s)).toBe('opening');for(const a of witness.journal.slice(0,63)){s=take(s,a).state;if(a.type==='settle'&&s.day<4)expect(firstChapterScreen(s)).toBe('receipt');}expect(firstChapterScreen(s)).toBe('complete');expect(s.phase).toBe('summary');expect(firstChapterFacts(s)).toMatchObject({completed:4,days:4,bridgeMet:true,bridgeResolved:true,chaptersEarned:true});s=take(s,{type:'advance'}).state;expect(firstChapterScreen(s)).toBe('future');});
 it('three real misses fail and do not invent earned chapters or completed lamps',()=>{let s=take(start(),{type:'continue'}).state;for(let i=0;i<3;i++){s=take(s,{type:'settle'}).state;if(i<2)s=take(s,{type:'advance'}).state;}expect(firstChapterScreen(s)).toBe('defeat');expect(firstChapterFacts(s)).toMatchObject({completed:0,bridgeMet:false,bridgeResolved:false,chaptersEarned:false});expect(firstChapterFacts(s).lamps.every(l=>!l.done)).toBe(true);});
 it('only accepted completion emits a useful next action; event outcomes remain facts after restore',()=>{let s=start(),completion=false,event=false;for(const a of witness.journal.slice(0,43)){const r=take(s,a);s=r.state;const n=noticeFromEvents(r.events,s);if(r.events.some(e=>e.type==='MainCompleted')){completion=true;expect(n?.title).toBe('这一站，有剑了');expect(n?.action).toBe(s.gift==='available'?'gift':'settle');}if(a.type==='chooseEvent'){event=true;expect(n?.title).toBe('选择已经记下');expect(JSON.parse(JSON.stringify(s)).eventHistory).toEqual(s.eventHistory);}}expect(completion&&event).toBe(true);expect(noticeFromEvents([],s)).toBeNull();});
});
