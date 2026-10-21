import {test,expect} from '@playwright/test';
import {KeyboardV5,v5Sdk,v5VictoryGuide,keyToV5} from './v5-helpers.js';
import {buildJourney} from './v5-plans.js';

test('current v5: fresh keyboard story earns and completes a reordered twelve-day challenge',async({page},info)=>{
 test.setTimeout(600000);const keyboard=new KeyboardV5(page,info);await keyboard.install();await keyboard.start();expect(v5VictoryGuide).toHaveLength(142);
 const merchants=new Set<number>();let recipeSwitches=0;
 for(const action of v5VictoryGuide){
  await keyboard.leaveIntro();const before=(await keyboard.read()).state;
  if(before.phase==='workshop'&&[3,6,9].includes(before.day)&&!merchants.has(before.day)){merchants.add(before.day);await keyboard.shop(before.day);}
  // These two extra accepted recipe changes exercise the actual controls without drawing forge RNG.
  // The immutable published142 guide remains intact; total story commands are explicitly144.
  if(!recipeSwitches&&before.day===4&&action.type==='strike'&&action.pieceId==='d4-1'){
   expect(before.blades.find(blade=>blade.id==='d4-1')?.recipe).toBe('guard');
   await keyboard.command({type:'setRecipe',pieceId:'d4-1',recipe:'light'});await keyboard.command({type:'setRecipe',pieceId:'d4-1',recipe:'guard'});recipeSwitches=2;
  }
  if(action.type==='chooseModification')await keyboard.capture(`day-${before.day}-keyboard-modification-choice`);
  await keyboard.command(action);
 }
 const victory=await keyboard.record('keyboard-story-victory');expect(victory.state.phase).toBe('victory');expect(victory.state.history.filter(day=>day.met)).toHaveLength(12);expect(victory.state.modifications).toEqual(['warmRack','windbox']);expect(victory.state.coins).toBe(2974);expect(victory.state.seals).toBe(3);expect(keyboard.accepted).toHaveLength(144);expect(recipeSwitches).toBe(2);expect([...merchants]).toEqual([3,6,9]);await keyboard.capture('keyboard-story-victory');
 // Reload is an explicit browser driver operation, not a pointer/gameplay action; retain the same page fixture and DPR.
 await keyboard.reload();await keyboard.activate(page.locator('#v4-continue'));const resumed=await keyboard.record('keyboard-victory-reload');expect(resumed.state).toEqual(victory.state);expect(resumed.collection).toEqual(victory.collection);
 await keyboard.same('keyboard collection inspection',async()=>{
  await keyboard.activate(page.locator('#v4-stage-actions').getByRole('button',{name:'翻开完整炉谱',exact:true}));
  await expect(page.locator('#v4-dialog-body [data-record]')).toHaveCount(12);await expect(page.locator('#v4-dialog-body [data-record][data-rules-version="forge-v5"]')).toHaveCount(12);await keyboard.capture('keyboard-earned-collection');
 });
 const earned=(await keyboard.read()).collection;expect(earned?.challenge).toBe(true);if(!earned)throw Error('No persisted earned collection');
 await keyboard.activate(page.locator('#v4-dialog-actions').getByRole('button',{name:'收好炉谱',exact:true}));
 await keyboard.activate(page.getByRole('button',{name:'回到路口，再开一炉',exact:true}));
 if(!await page.locator('.v4-journey-options').evaluate(node=>(node as HTMLDetailsElement).open))await keyboard.activate(page.locator('.v4-journey-options summary'));await keyToV5(page,page.locator('#v4-seed'));await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('v5-economy-0');
 await keyboard.activate(page.locator('#v4-title-challenge'));await keyboard.activate(page.getByRole('button',{name:'再想想',exact:true}));expect((await keyboard.read()).state).toEqual(victory.state);
 await keyboard.activate(page.locator('#v4-title-challenge'));await keyboard.confirm();
 const challenge=await keyboard.record('keyboard-earned-challenge-created');expect(challenge.state.runId).not.toBe(victory.state.runId);expect(challenge.state.mode).toBe('challenge');expect(challenge.state.phase).toBe('opening');expect(challenge.state.revision).toBe(0);expect(challenge.state.coins).toBe(0);expect(challenge.state.initialEligibility).toEqual(v5Sdk.collectionEligibility(earned));
 const expected=v5Sdk.createRun({runId:challenge.state.runId,seed:challenge.state.seed,mode:'challenge',eligibility:v5Sdk.collectionEligibility(earned)});if(!expected.ok)throw Error(expected.error);expect(challenge.state).toEqual(expected.state);await keyboard.capture('keyboard-earned-challenge-opening');
 expect(challenge.state.seed).toBe('v5-economy-0');expect(challenge.state.commissionOrder).not.toEqual(Array.from({length:12},(_,index)=>index+1));const plan=buildJourney(v5Sdk,{runId:challenge.state.runId,seed:challenge.state.seed,mode:'challenge',eligibility:challenge.state.initialEligibility});expect(plan.state.phase).toBe('victory');expect(plan.state.history.every(day=>day.met)).toBe(true);
 for(const action of plan.actions){const before=(await keyboard.read()).state;await keyboard.command(action);const current=(await keyboard.read()).state;if(action.type==='advance'&&[6,7,9,11].includes(current.day)){await keyboard.leaveIntro();await expect(page.locator('#v4-goal-name')).toContainText(v5Sdk.commissionFor(current).title);if(current.day===9)await expect(page.locator('#v4-shop')).toBeVisible();}if(action.type==='deliver'&&before.day===12)expect(current.phase).toBe('workshop');}
 const final=await keyboard.record('keyboard-earned-challenge-victory');expect(final.state).toEqual(plan.state);expect(final.state.mode).toBe('challenge');expect(final.state.history.filter(day=>day.met)).toHaveLength(12);await keyboard.capture('keyboard-earned-challenge-victory');await keyboard.reload();await keyboard.activate(page.locator('#v4-continue'));const resumedChallenge=await keyboard.record('keyboard-challenge-victory-reload');expect(resumedChallenge.state).toEqual(final.state);expect(resumedChallenge.collection).toEqual(final.collection);
 await keyboard.finish({freshUIJourneys:2,storyGuideCommands:142,recipeSwitchCommands:recipeSwitches,challengeCreations:1,challengeDomainCommands:plan.actions.length,storyEnding:'victory',challengeEnding:final.state.phase});
});
