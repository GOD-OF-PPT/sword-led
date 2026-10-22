import {test,expect} from '../e2e/fixtures.js';
import type {Page,Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import type {Action,CreateRunInput,DomainEvent,RunState} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Sdk,v5VictoryGuide} from '../e2e/v5-helpers.js';
import {replayV5} from '../e2e/v5-plans.js';

// Fixed, formally replayed recovery boundaries; see the source manifest for their original journals.
interface CreditWitness {input:CreateRunInput;actions:Action[];boundaries:{burst:number;firstProtectedCrack:number}}
const creditWitness:CreditWitness=JSON.parse(readFileSync('tests/fixtures/v5/t04-credit-prefix.json','utf8'));
const protectedRisk=/首(?:次)?裂(?:损)?.*保(?:价|住估值)/;
const gameKeys=['sword-led.save.v5','sword-led.save.backup.v5','sword-led.collection.v2','sword-led.collection.backup.v2'] as const;
interface FloatObservation {at:number;text:string}
declare global {interface Window {__g4T04Float?:{rows:FloatObservation[];stop():void}}}

function fixedBoundaries(){
 const prefix=v5VictoryGuide.slice(0,16),next=v5VictoryGuide[16];
 if(next?.type!=='strike'||next.pieceId!=='d3-1')throw Error('The published fixed first-crack boundary changed; do not search another seed.');
 const made=(runId:string,actions:readonly Action[])=>replayV5(v5Sdk,{runId,seed:'v5-economy-0'},actions);
 // Withholding one optional gift is a legal command sequence, not a trait/RNG edit.
 const unprotected=made('G4-T04-unprotected',prefix.filter(action=>action.type!=='claimGift'));
 const steady=made('G4-T04-steady',prefix);
 const burst=replayV5(v5Sdk,creditWitness.input,creditWitness.actions.slice(0,creditWitness.boundaries.burst));
 const credit=replayV5(v5Sdk,creditWitness.input,creditWitness.actions.slice(0,creditWitness.boundaries.firstProtectedCrack));
 expect(unprotected.traits).not.toContain('steady');expect(unprotected.crackGuard).toBe(false);
 expect(steady.traits).toContain('steady');expect(steady.blades.find(blade=>blade.id==='d3-1')).toMatchObject({status:'active',cracked:false});
 expect(credit.traits).not.toContain('steady');expect(credit.crackGuard).toBe(true);
 expect(credit.blades.find(blade=>blade.id==='d4-1')).toMatchObject({status:'active',cracked:false,charge:2});
 expect(burst.crackGuard).toBe(true);expect(burst.blades.find(blade=>blade.id==='d4-1')?.charge).toBe(6);
 return{unprotected,steady,burst,credit};
}
async function slots(page:Page){return page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),gameKeys);}
async function assertEstimate(locator:Locator){const text=await locator.innerText();expect(text).toContain('估值');expect(text).not.toMatch(/身价|金币/);return text;}
async function armFloat(page:Page){await page.evaluate(()=>{
 window.__g4T04Float?.stop();const node=document.querySelector('#v4-float');if(!node)throw Error('Missing real contact float');
 const rows:FloatObservation[]=[],observer=new MutationObserver(()=>{const text=node.textContent??'';if(text&&rows.length<16)rows.push({at:performance.now(),text});});
 observer.observe(node,{subtree:true,childList:true,characterData:true});window.__g4T04Float={rows,stop:()=>observer.disconnect()};
});}
async function stopFloat(page:Page){return page.evaluate(()=>{const capture=window.__g4T04Float;if(!capture)return[];capture.stop();delete window.__g4T04Float;return capture.rows;});}
function strikeOf(events:unknown):Extract<DomainEvent,{type:'Strike'}>{
 if(!Array.isArray(events))throw Error('Missing actual accepted event list');
 const strike=events.find((event:DomainEvent)=>event.type==='Strike');
 if(strike?.type!=='Strike')throw Error('Missing formal Strike');return strike;
}

test('v5 restored legal boundaries show the real first-crack protection, consumption, second crack and safe burst with current estimate wording',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const fixtures=fixedBoundaries();
 const evidence:Record<string,unknown>[]=[];let phase='before-first-restore';
 const risk=page.locator('#v4-risk');
 const inspect=async(label:string,readUI:()=>Promise<unknown>)=>{
  const before=await h.read(),rawBefore=await slots(page),observed=await readUI();
  const after=await h.read(),rawAfter=await slots(page);expect(after.state).toEqual(before.state);expect(rawAfter).toEqual(rawBefore);
  evidence.push({label,kind:'UI observation only; four economic slots unchanged',observed,rawBefore,rawAfter,revision:after.state.revision});
 };
 const restore=async(label:string,state:RunState,pieceId:string)=>{
  phase=label;await h.restoreLegitimate(state);await h.select(pieceId);
  await expect(page.locator('#v4-workshop')).toBeVisible();await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
  evidence.push({label,kind:'Replay/codec-validated legitimate prefix recovery, not a fresh full game',runId:state.runId,seed:state.seed,journal:state.journal,risk:await risk.innerText()});
 };
 const hit=async(label:string,pieceId:string)=>{
  phase=label;const before=(await h.read()).state;await armFloat(page);
  const after=await h.command({type:'strike',pieceId}),observed=await stopFloat(page);
  const strike=strikeOf(h.accepted.at(-1)?.events);expect(observed.some(row=>row.text.includes('估值'))).toBe(true);expect(observed.every(row=>!/身价|金币/.test(row.text))).toBe(true);
  evidence.push({label,before,after,strike,liveContactFloat:observed});return{before,after,strike};
 };
 try{
  await restore('unprotected-first-crack',fixtures.unprotected,'d3-1');
  await expect(risk).toContainText('首裂会掉价');await expect(risk).not.toContainText(protectedRisk);
  const ordinary=await hit('real-unprotected-first-crack','d3-1');expect(ordinary.strike.burst).toBe(false);expect(ordinary.strike.hits).toHaveLength(1);
  expect(ordinary.strike.hits[0]?.result).toBe('crack');expect(ordinary.strike.hits[0]?.triggers).not.toContain('steady');expect(ordinary.strike.hits[0]?.triggers).not.toContain('credit');
  expect(ordinary.strike.hits[0]?.after).toBe(Math.floor(ordinary.strike.hits[0]!.before*80/100));await expect(risk).toContainText('再裂会断');

  await restore('steady-first-crack',fixtures.steady,'d3-1');
  await expect(risk).toContainText(protectedRisk);await expect(risk).toContainText(/仍(?:会)?(?:留下?|有)裂纹/);await expect(risk).not.toContainText('首裂会掉价');
  await inspect('current-canvas-aria',async()=>{const aria=await page.locator('#v4-blade').getAttribute('aria-label');expect(aria).toContain('估值');expect(aria).not.toMatch(/身价|金币/);return aria;});
  await inspect('steady-modal-is-read-only',async()=>{await h.activate(page.locator('#v4-traits [data-trait="steady"]'));await expect(page.locator('#v4-dialog-title')).toHaveText('稳手护符');const text=await assertEstimate(page.locator('#v4-dialog-body'));await h.activate(page.locator('#v4-dialog-actions').getByRole('button',{name:'回铁砧',exact:true}));return text;});
  await inspect('packing-preview-is-read-only',async()=>{await h.activate(page.locator('#v4-next-plan'));await expect(page.locator('#v4-dialog-title')).toContainText('明日装箱');await h.activate(page.locator('#v4-dialog-body details summary'));const text=await assertEstimate(page.locator('#v4-dialog-body'));await h.activate(page.locator('#v4-dialog-actions').getByRole('button',{name:'回炉边，自己拿主意',exact:true}));return text;});
  await inspect('merchant-trait-detail-is-read-only',async()=>{await h.activate(page.locator('#v4-shop'));await expect(page.locator('.v5-market-stall')).toBeVisible();await h.activate(page.locator('.v5-stall-detail details summary'));const text=await assertEstimate(page.locator('#v4-dialog-body'));await h.activate(page.locator('#v4-dialog-actions').getByRole('button',{name:'回铁砧',exact:true}));return text;});
  const protectedHit=await hit('real-steady-first-crack','d3-1');expect(protectedHit.strike.hits[0]?.result).toBe('crack');expect(protectedHit.strike.hits[0]?.triggers).toContain('steady');expect(protectedHit.strike.hits[0]?.after).toBe(protectedHit.strike.hits[0]?.before);
  expect(protectedHit.after.blades.find(blade=>blade.id==='d3-1')?.cracked).toBe(true);expect(protectedHit.after.traits).toContain('steady');await expect(risk).toContainText('再裂会断');await expect(risk).not.toContainText(protectedRisk);

  await restore('safe-burst-with-credit-still-available',fixtures.burst,'d4-1');
  await expect(risk).toContainText('安全连锻');await expect(risk).toContainText('不会裂');await expect(risk).not.toContainText(protectedRisk);
  const burst=await hit('real-safe-burst-does-not-spend-credit','d4-1');expect(burst.strike.burst).toBe(true);expect(burst.strike.hits.every(value=>value.result!=='crack'&&value.result!=='broken'&&!value.triggers.includes('credit'))).toBe(true);expect(burst.after.crackGuard).toBe(true);

  await restore('credit-before-actual-consumption',fixtures.credit,'d4-1');
  await expect(risk).toContainText(protectedRisk);await expect(risk).toContainText(/仍(?:会)?(?:留下?|有)裂纹/);
  const credit=await hit('real-credit-consumption','d4-1');expect(credit.strike.hits[0]?.result).toBe('crack');expect(credit.strike.hits[0]?.triggers).toContain('credit');expect(credit.strike.hits[0]?.after).toBe(credit.strike.hits[0]?.before);expect(credit.after.crackGuard).toBe(false);
  await expect(risk).toContainText('再裂会断');await expect(risk).not.toContainText(protectedRisk);
  await inspect('spent-credit-cannot-protect-another-intact-sword',async()=>{await h.select('d4-2');await expect(risk).toContainText('首裂会掉价');await expect(risk).not.toContainText(protectedRisk);await h.select('d4-1');return{guard:(await h.read()).state.crackGuard,risk:await risk.innerText()};});
  const next=await hit('real-already-cracked-normal-hit','d4-1');expect(next.after.crackGuard).toBe(false);await expect(risk).toContainText('再裂会断');
  const broken=await hit('real-second-crack-is-still-a-break','d4-1');expect(broken.strike.hits[0]?.result).toBe('broken');expect(broken.strike.hits[0]?.triggers).not.toContain('credit');expect(broken.strike.hits[0]?.after).toBe(0);expect(broken.after.crackGuard).toBe(false);
  expect(h.accepted).toHaveLength(6);phase='complete';await h.finish({scope:'One bounded UI consumer: four formally replayed recovery boundaries, six real Accepted strikes and read-only terminology/slot checks; not a new full journey or an audio/performance matrix',restoredBoundaries:4,actualStrikeCommands:6});
 }finally{
  const remaining=await stopFloat(page).catch(()=>[]);await writeFile(info.outputPath('t04-risk-language.json'),JSON.stringify({phase,evidence,remainingFloat:remaining,finalSlots:await slots(page).catch(error=>({error:String(error)})),scope:'Actual UI observations belong only to this execution. Recovery sources are fixed formal journal prefixes, not a fresh complete journey; no wallet/RNG/phase/result injection.'},null,2)+'\n');
 }
});
