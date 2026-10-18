import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { openGame, readRun } from './helpers';
import { keyActivate, tabTo } from './keyboard';
import { validateRun } from '../../src/core/index.js';
import { gradeOf, HAMMERS } from '../../src/core/rules.js';

test('keyboard alone completes twelve rounds, all merchants and the victory ledger',async({page},info)=>{
  test.setTimeout(600000);
  const raw:unknown=JSON.parse(readFileSync(new URL('../../docs/evidence/T06/verify-v1.medium-victory.json',import.meta.url),'utf8'));
  if(!raw||typeof raw!=='object'||!('state'in raw))throw new Error('Missing witness');
  const checked=validateRun(raw.state);if(!checked.ok)throw new Error(checked.detail);const reference=checked.state;
  await page.addInitScript(()=>{Reflect.set(window,'keyboardPointerCount',0);window.addEventListener('pointerdown',()=>Reflect.set(window,'keyboardPointerCount',Number(Reflect.get(window,'keyboardPointerCount'))+1));});
  await openGame(page);await keyActivate(page,'#options');await tabTo(page,'#mute-setting');await page.keyboard.press('Space');await page.keyboard.press('Escape');
  await keyActivate(page,'#new-game');await page.keyboard.type(reference.seed);await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  let merchants=0;
  for(const [index,action]of reference.journal.entries()){
    if('pieceId'in action)await page.keyboard.press(action.pieceId.split(':')[1]??'1');
    if(action.type==='strike'){
      await page.keyboard.press({light:'q',standard:'w',heavy:'e'}[action.mode]);await tabTo(page,'#strike');await page.keyboard.down('Space');
      const period=HAMMERS[action.mode].periodMs;let hold=Math.round(action.timingMark*period/20000);
      while(gradeOf(Math.round(hold*20000/period),0)!==gradeOf(action.timingMark,0))hold+=Math.round(hold*20000/period)<action.timingMark?1:-1;
      await page.clock.runFor(hold);await page.keyboard.up('Space');await page.clock.runFor(500);
    }else if(action.type==='heat'){await keyActivate(page,'#heat-button');await page.clock.runFor(500);}
    else if(action.type==='deliver'||action.type==='recycle'){
      await keyActivate(page,action.type==='deliver'?'#deliver-button':'#recycle-button');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.clock.runFor(500);
    }else if(action.type==='settleRound'){
      await keyActivate(page,'#settle-button');if(action.recycleRemaining){await page.keyboard.press('Tab');await page.keyboard.press('Enter');}
    }else if(action.type==='advanceSummary'){
      await keyActivate(page,'#phase-advance');if(await page.locator('#phase-panel').getAttribute('data-kind')==='merchant')merchants++;
    }else if(action.type==='buy'){
      await keyActivate(page,`#buy-${action.productId}`);await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    }else if(action.type==='leaveMerchant'){
      await keyActivate(page,'#phase-leave');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    }
    await expect(page.locator('#app')).toHaveAttribute('data-revision',String(index+1));
  }
  const actual=await readRun(page),{runId:actualId,journal:actualJournal,...actualFields}=actual,{runId:referenceId,journal:referenceJournal,...referenceFields}=reference;
  expect(actualFields).toEqual(referenceFields);expect(actualJournal).toHaveLength(referenceJournal.length);expect(merchants).toBe(3);
  expect(await page.evaluate(()=>Reflect.get(window,'keyboardPointerCount'))).toBe(0);
  await tabTo(page,'.ending-ledger summary');await page.keyboard.press('Enter');await expect(page.locator('tbody tr')).toHaveCount(12);
  const screenshot=info.outputPath('keyboard-victory.png');await page.screenshot({path:screenshot});await info.attach('keyboard-victory',{path:screenshot,contentType:'image/png'});
  await keyActivate(page,'#phase-replay');await expect(page.locator('#seed')).toHaveValue(reference.seed);await page.keyboard.press('Escape');await expect(page.locator('#phase-replay')).toBeFocused();
  await info.attach('keyboard-complete-victory',{body:Buffer.from(JSON.stringify({method:'Tab/Enter, native mode/slot shortcuts and Space only; controlled Clock; no pointer events or state injection',pointerEvents:0,merchants,state:actual},null,2)),contentType:'application/json'});
});
