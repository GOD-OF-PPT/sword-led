import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {KeyboardV5,v5Sdk} from './v5-helpers.js';
import {buildJourney,replayV5} from './v5-plans.js';

for(const count of [0,1]as const)test(`restored legitimate day-eight boundary: ${count}/2 remains a missed pair and keeps partial pay`,async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const input={runId:`T02-twin-${count}`,seed:'v5-economy-0'},plan=buildJourney(v5Sdk,input,{throughDay:8});
 let prefix=plan.states.find(s=>s.day===8&&s.phase==='workshop'&&v5Sdk.commissionProgress(s).routes[0]!.count===count)!;
 if(count===1)prefix=plan.states.find(s=>s.day===8&&s.phase==='workshop'&&v5Sdk.commissionProgress(s).routes[0]!.count===1)!;
 expect(prefix).toBeDefined();await h.restoreLegitimate(prefix);expect(v5Sdk.commissionProgress(prefix).complete).toBe(false);await expect(page.locator('#v4-order-routes [data-required="2"] .v4-order-socket')).toHaveCount(2);await expect(page.locator('#v4-order-routes [data-required="2"] [data-received="true"]')).toHaveCount(count);
 await h.capture(`restored-twin-${count}-before-settlement`);await h.reload();await h.activate(page.locator('#v4-continue'));expect((await h.read()).state).toEqual(prefix);
 const settled=await h.command({type:'settle'});expect(settled.phase).toBe('chapter');expect(settled.history.at(-1)).toMatchObject({day:8,met:false,baseFees:count*125,sealsAfter:2});expect(settled.coins).toBeGreaterThanOrEqual(prefix.coins);expect(settled.chapterChoices).not.toContain('warmRack');expect(settled.chapterChoices).toEqual(['windbox','wideMouth']);
 const selected=count===0?'wideMouth':'windbox';await h.command({type:'chooseModification',modification:selected});const summary=await h.record(`restored-twin-${count}-missed-summary`);expect(summary.state.modifications).toEqual(['warmRack',selected]);expect(summary.collection?.chapters).toEqual([1,2]);expect(summary.collection?.works.some(w=>w.commissionId===8)).toBe(false);await h.capture(`restored-twin-${count}-chapter-summary`);await h.command({type:'advance'});
 await h.activate(page.locator('#v4-menu'));await h.activate(page.locator('#v4-journey-open'));const detail=page.locator('.v4-journey-deliveries[data-commission="8"]');
 if(count===1){await h.activate(detail.locator('summary'));await expect(detail).toContainText('已交 1/2');await expect(detail.locator('canvas[data-blade]')).toHaveCount(1);await expect(detail).toContainText('尚未凑齐');}
 const after=(await h.read()).state;await h.activate(page.getByRole('button',{name:'回铁砧',exact:true}));expect((await h.read()).state).toEqual(after);
 await h.finish({scope:'Restored formally replayed day-eight prefix boundary; not a fresh full UI journey.',partialCount:count,commandsAfterRestore:h.accepted.length});
});

test('restored second-chapter failure keeps earned chapter one, real export and no challenge qualification',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const plan=buildJourney(v5Sdk,{runId:'T02-chapter-two-failure',seed:'v5-economy-0'},{throughDay:4});await h.restoreLegitimate(plan.state);const first=(await h.read()).collection;expect(first?.chapters).toEqual([1]);expect(first?.works).toHaveLength(4);
 await h.command({type:'advance'});for(let day=5;day<=7;day++){await h.command({type:'settle'});if(day<7)await h.command({type:'advance'});}
 const final=await h.record('legitimate-second-chapter-defeat');expect(final.state.phase).toBe('defeat');expect(final.state.day).toBe(7);expect(final.state.history.slice(0,4).every(day=>day.met)).toBe(true);expect(final.state.history.slice(4).every(day=>!day.met)).toBe(true);expect(final.collection?.chapters).toEqual([1]);expect(final.collection?.works).toEqual(first?.works);expect(final.collection?.challenge).toBe(false);await h.capture('second-chapter-defeat-first-chapter-retained');
 await h.activate(page.locator('#v4-save-open'));const pending=page.waitForEvent('download');await h.activate(page.getByRole('button',{name:'导出当前行程',exact:true}));const file=await(await pending).path();if(!file)throw Error('No real failure export');const checked=v5Sdk.validateRun(JSON.parse(await readFile(file,'utf8')));if(!checked.ok)throw Error(checked.detail);expect(checked.state).toEqual(final.state);expect((await h.read()).raw.save).toBe(final.raw.save);
 await h.activate(page.getByRole('button',{name:'回到当前页面',exact:true}));await h.reload();await h.activate(page.locator('#v4-continue'));expect((await h.read()).state).toEqual(final.state);await h.finish({scope:'Restored legitimate first-chapter summary; six actual UI commands in chapter two reach defeat, with actual downloaded journal.',exported:true,commandsAfterRestore:6});
});

test('restored chapter summaries continue their exact journal through day five and day nine',async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();
 for(const day of [4,8]){
  const input={runId:`T02-resume-summary-${day}`,seed:'v5-economy-0'},plan=buildJourney(v5Sdk,input,{throughDay:day});expect(plan.state.phase).toBe('summary');await h.restoreLegitimate(plan.state);await h.capture(`saved-day-${day}-summary`);const resumed=await h.command({type:'advance'});expect(resumed.day).toBe(day+1);expect(resumed.journal.slice(0,-1)).toEqual(plan.actions);await h.leaveIntro();await expect(page.locator('#v4-goal-name')).toContainText(v5Sdk.commissionFor(resumed).title);if(day===8)await expect(page.locator('#v4-shop')).toBeVisible();
  const replayed=replayV5(v5Sdk,input,[...plan.actions,{type:'advance'}]);expect(resumed).toEqual(replayed);await h.reload();await h.activate(page.locator('#v4-continue'));expect((await h.read()).state).toEqual(resumed);
 }
 await h.finish({scope:'Two explicitly restored, fully replayed summary boundaries. Advances preserve exact journal and do not claim new full journeys.',summaryDays:[4,8]});
});
