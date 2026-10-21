import {expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import type {Action,CreateRunInput,DomainEvent,EventId,RunState,Trait} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Sdk,v5VictoryGuide} from './v5-helpers.js';
import {replayV5} from './v5-plans.js';
export {installV4HammerProbe as installV5HammerProbe} from './v4-forge-probe.js';

export const GIFT_FIXTURE_PATH='tests/fixtures/v5/delayed-gift-route.json';
export const giftFixture=JSON.parse(readFileSync(GIFT_FIXTURE_PATH,'utf8')) as {input:CreateRunInput;marketActions:Action[];giftActions:Action[];paymentId:string;replacementOffer:Trait;missing:Trait;replaceId:Trait;afterGiftActions:Action[];reacquireAction:Action};
export const prefixV5=(count:number)=>replayV5(v5Sdk,{runId:'v5-ui-boundary',seed:'v5-economy-0'},v5VictoryGuide.slice(0,count));
export const giftMarketV5=()=>replayV5(v5Sdk,giftFixture.input,giftFixture.marketActions);
export const giftUsedV5=()=>replayV5(v5Sdk,giftFixture.input,giftFixture.giftActions);
export function nextV5(state:RunState,action:Action){const result=v5Sdk.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!result.ok)throw Error(`${state.day}/${action.type}: ${result.error}`);return result;}

/** An explicitly marked restored boundary: all resources/phase/random state come from replayed commands. */
export function eventBoundaryV5(id:EventId):RunState{
 for(let index=0;index<64;index++){
  const made=v5Sdk.createRun({runId:`v5-event-${id}`,seed:`v5-event-${id}-${index}`});if(!made.ok)throw Error(made.error);if(made.state.eventDeck[0]!==id)continue;
  let state=made.state;const send=(action:Action)=>{state=nextV5(state,action).state;};
  send({type:'continue'});for(let n=0;n<3;n++)send({type:'strike',pieceId:'d1-1'});if(!v5Sdk.assessBlade(state,state.blades.find(b=>b.id==='d1-1')!).qualifies)continue;
  send({type:'deliver',pieceId:'d1-1'});send({type:'settle'});send({type:'advance'});send({type:'settle'});send({type:'advance'});send({type:'reserve',pieceId:'d3-1'});
  if(id==='credit'){
   let trial=nextV5(state,{type:'chooseEvent',choice:'accept'}).state;trial=nextV5(trial,{type:'settle'}).state;trial=nextV5(trial,{type:'advance'}).state;let cracked=false,broken=false;
   for(let n=0;n<30;n++){const piece=v5Sdk.getRunView(trial).blades.find(b=>b.blade.id==='d4-1');if(!piece?.canStrike)break;const r=nextV5(trial,{type:'strike',pieceId:'d4-1'});trial=r.state;for(const e of r.events)if(e.type==='Strike')for(const hit of e.hits){cracked ||= hit.result==='crack'&&hit.triggers.includes('credit');broken ||= hit.result==='broken';}if(broken)break;}
   if(!cracked||!broken)continue;
  }
  const checked=v5Sdk.validateRun(state);if(!checked.ok)throw Error(checked.detail);return checked.state;
 }
 throw Error(`No bounded legal ${id} fixture; do not replace eventId or inject funds.`);
}
export function feeBoundaryV5(){let state=prefixV5(49);const actions:Action[]=[{type:'settle'},{type:'advance'},...Array.from({length:8},()=>({type:'strike' as const,pieceId:'d6-1'})),{type:'deliver',pieceId:'d6-1'}];for(const action of actions)state=nextV5(state,action).state;return state;}

/** Manual native-input cases still compare the accepted command and the complete actual save. */
export async function acceptedByV5(h:KeyboardV5,action:Action,input:()=>Promise<void>,label=action.type){
 const before=(await h.read()).state,expected=nextV5(before,action);await input();await expect.poll(async()=>(await h.read()).state.revision).toBe(expected.state.revision);const actual=await h.record(label);expect(actual.state).toEqual(expected.state);
 h.accepted.push({action,runId:before.runId,mode:before.mode,day:before.day,revision:actual.state.revision,coinsBefore:before.coins,coinsAfter:actual.state.coins,events:expected.events});await writeFile(h.info.outputPath('v5-commands.json'),JSON.stringify(h.accepted,null,2));return expected;
}
export async function reloadExactV5(h:KeyboardV5){const before=await h.read();await h.reload();await h.activate(h.page.locator('#v4-continue'));const after=await h.record('real-reload-no-duplicate');expect(after.state).toEqual(before.state);expect(after.raw.save).toBe(before.raw.save);expect(after.collection).toEqual(before.collection);return after.state;}
export async function hitPointV5(page:Page){const box=await page.locator('#v4-hit').boundingBox();if(!box)throw Error('No actual sword hit surface');return{x:box.x+box.width*.59,y:box.y+box.height*.55};}
export function lastStrikeV5(h:KeyboardV5){const events=h.accepted.at(-1)?.events as readonly DomainEvent[]|undefined;const strike=events?.find(e=>e.type==='Strike');if(strike?.type!=='Strike')throw Error('Expected accepted Strike');return strike;}
