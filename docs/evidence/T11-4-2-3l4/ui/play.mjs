import {harness,assert,expect,sdk,readFile,writeFile} from './helpers.mjs';
const out=process.argv[2]??'tmp/T11-4-2-3l4/ui/run-01',url=process.argv[3]??'http://127.0.0.1:4210/';
const full=JSON.parse(await readFile('docs/evidence/T11-4-2-3l1/journeys/victory.json','utf8')).state,guide=full.journal;
assert.equal(guide.length,142);const h=await harness(out,url),{page}=h;
try{
 await page.goto(url);await expect(page.locator('.v5-app')).toHaveAttribute('data-rules-version','forge-v5');await expect(page.locator('#v5-old-v4')).toHaveAttribute('href','/v4.html');
 await expect(page.locator('body')).toContainText('v0.8 十二灯行旅');await page.locator('.v4-journey-options summary').click();await page.locator('#v4-seed').fill('v5-economy-0');await page.locator('#v4-start').click();
 const first=await h.keep('created-from-real-title'),created=sdk.createRun({runId:first.runId,seed:'v5-economy-0',mode:'story',eligibility:{recipes:['light'],challenge:false}});assert(created.ok);assert.deepEqual(first,created.state);
 const visited=new Set();
 for(let i=0;i<guide.length;i++){
  await h.leaveIntro();const before=await h.actual();
  if(before.phase==='workshop'&&!visited.has(before.day)){
   visited.add(before.day);
   if(before.day>=5)await h.capture(`d${before.day}-paper-start`);
   const view=sdk.getRunView(before);
   if(view.event?.status==='available'&&before.day>=5)await h.unchanged(`d${before.day} inspect event no decision`,async()=>{await page.locator('#v4-event-open').click();await h.capture(`d${before.day}-event-${view.event.id}`);await h.close();});
  }
  const after=await h.ui(guide[i],i);
  if(guide[i].type==='deliver'&&[1,5,6,7,8,9,10,11,12].includes(before.day))await h.capture(`d${before.day}-${guide[i].pieceId}-paid`);
  if(guide[i].type==='chooseModification')await h.capture(`d${before.day}-chapter-receipt`);
 }
 const final=await h.keep('twelve-day-victory');assert.equal(final.phase,'victory');assert.equal(final.day,12);assert.equal(final.history.filter(x=>x.met).length,12);assert.deepEqual(final.modifications,['warmRack','windbox']);assert.equal(h.actions.length,142);await expect(page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending','victory');await h.capture('victory-ending');
 const originalRaw=await h.raw();await writeFile(`${out}/victory-raw.json`,JSON.stringify(originalRaw,null,2));
 await page.reload();await page.locator('#v4-continue').click();assert.deepEqual(await h.keep('victory-reload'),final);await expect(page.locator('#v4-stage-copy [data-ending]')).toHaveAttribute('data-ending','victory');assert.deepEqual(JSON.parse((await h.raw()).collection).state,JSON.parse(originalRaw.collection).state,'reload does not award collection again');
 await h.unchanged('ending source works inspect zero economy',async()=>{
  await page.locator('#v4-stage-actions').getByRole('button',{name:'翻开完整炉谱',exact:true}).click();await expect(page.locator('#v4-dialog-body [data-record]')).toHaveCount(12);await expect(page.locator('#v4-dialog-body [data-record][data-rules-version="forge-v5"]')).toHaveCount(12);await h.capture('victory-collection');
  await page.locator('#v4-dialog-body [data-record="11"]').getByRole('button',{name:'翻看这件作品',exact:true}).click();await expect(page.locator('.v4-work-page')).toHaveAttribute('data-rules-version','forge-v5');await expect(page.locator('.v4-work-page')).toContainText('第10天来料，作为旧剑接续这一程');await h.capture('victory-relay-work-source');await h.close();
 });
 const collection=JSON.parse(originalRaw.collection).state;assert(collection.challenge);
 await page.locator('#v4-stage-actions').getByRole('button',{name:'行脚挑战，再走一程',exact:true}).click();await h.confirm();const challenge=await h.keep('earned-challenge-created-from-real-ending');assert.notEqual(challenge.runId,final.runId);assert.equal(challenge.mode,'challenge');assert.equal(challenge.coins,0);assert.equal(challenge.revision,0);assert.equal(challenge.phase,'opening');assert.deepEqual(challenge.initialEligibility,sdk.collectionEligibility(collection));await h.capture('earned-challenge-opening');
 await h.finish({method:'Empty fresh context; fixed prior published 142-command journal; real title seed and mouse/button input; every saved state formal replay and deep equality; no injected save/economic command/coins/RNG adaptation; challenge entry is a new legal zero-resource run, not a challenge full playthrough',fullNewRunCommands:142,final:{runId:final.runId,day:final.day,phase:final.phase,revision:final.revision,coins:final.coins,seals:final.seals,history:final.history,modifications:final.modifications},challenge:{runId:challenge.runId,mode:challenge.mode,phase:challenge.phase,revision:challenge.revision,coins:challenge.coins,initialEligibility:challenge.initialEligibility}});
}catch(e){await h.fail(e);throw e;}finally{await h.dispose();}
