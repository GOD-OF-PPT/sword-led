import {expect,test} from '@playwright/test';
import type {Page,Locator} from '@playwright/test';
import {applyCommand,validateRun,TRAITS,MODIFICATIONS} from '../../src/core-v4/index.js';
import type {Action,RunState} from '../../src/core-v4/index.js';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
export const witness=JSON.parse(readFileSync('docs/evidence/T11-4-2-3i1/witness-fixed/complete.json','utf8')) as RunState;
export const chapterActions=witness.journal.slice(0,63);
export async function readV4(page:Page){const raw=await page.evaluate(()=>localStorage.getItem('sword-led.save.v4'));if(!raw)throw Error('Missing actual v4 save');const r=validateRun(JSON.parse(raw).state);if(!r.ok)throw Error(r.detail);return r.state;}
export async function confirmV4(page:Page){await page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}).click();}
export async function keyTo(page:Page,target:Locator){for(let i=0;i<100;i++){if(await target.evaluate(e=>e===document.activeElement))return;const backwards=await target.evaluate(e=>Boolean(document.activeElement&&(document.activeElement.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_PRECEDING)));await page.keyboard.press(backwards?'Shift+Tab':'Tab');}throw Error('Control not keyboard reachable');}
export async function activateV4(page:Page,target:Locator,keys=false){if(keys){await keyTo(page,target);await page.keyboard.press('Enter');}else await target.click();}
export async function startV4(page:Page,seed='lantern-witness-0',keys=false){await page.goto('/');await expect(page.locator('#v4-start')).toBeEnabled();await activateV4(page,page.locator('.v4-journey-options summary'),keys);await page.locator('#v4-seed').fill(seed);await activateV4(page,page.locator('#v4-start'),keys);await expect(page.locator('#v4-stage-title')).toContainText('第一章');return readV4(page);}
export async function exitDelivery(page:Page,keys=false){const back=page.getByRole('button',{name:'回到铁砧',exact:true});if(await back.isVisible())await activateV4(page,back,keys);}
export async function commandV4(page:Page,action:Action,keys=false){
 await exitDelivery(page,keys);const before=await readV4(page);const expected=applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});if(!expected.ok)throw Error(`Expected rejected ${action.type}: ${expected.error}`);
 const act=(loc:Locator)=>activateV4(page,loc,keys),confirm=()=>act(page.locator('#v4-dialog-actions').getByRole('button',{name:'确认',exact:true}));
 if('pieceId'in action&&action.pieceId&&action.type!=='chooseEvent'){const s=before;const loc=page.locator(`#v4-inventory button[data-piece="${action.pieceId}"]`);if(s.reserveId!==action.pieceId&&await loc.isVisible()&&await loc.getAttribute('aria-pressed')!=='true')await act(loc);}
 switch(action.type){
  case'continue':await act(page.getByRole('button',{name:'点火开炉',exact:true}));break;
  case'strike':await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');if(keys){await keyTo(page,page.locator('#v4-strike'));await page.keyboard.press('Space');}else await page.locator('#v4-hit').click({position:{x:250,y:170}});await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');break;
  case'deliver':await act(page.locator('#v4-deliver'));break;
  case'reserve':await act(before.reserveId===action.pieceId?page.locator('#v4-reserve-slot button'):page.locator('#v4-reserve'));break;
  case'scrap':await act(page.locator('#v4-scrap'));await confirm();break;
  case'settle':await act(page.locator('#v4-settle'));await confirm();break;
  case'advance':await act(page.getByRole('button',{name:'沿灯路，去下一天',exact:true}));break;
  case'claimGift':await act(page.locator('#v4-gift button'));if(action.traitId)await act(page.getByRole('button',{name:'学会'+TRAITS[action.traitId].name,exact:true}));else await confirm();break;
  case'upgrade':case'repair':await act(page.locator('#v4-shop'));await act(page.getByRole('button',{name:action.type==='upgrade'?'准备更好的铁料':'请商人修补',exact:true}));await confirm();break;
  case'buy':await act(page.locator('#v4-shop'));await act(page.locator('#v4-dialog-body article').filter({has:page.getByRole('heading',{name:TRAITS[action.traitId].name,exact:true})}).getByRole('button'));if(action.replaceId)await act(page.getByRole('button',{name:'换下'+TRAITS[action.replaceId].name,exact:true}));await confirm();break;
  case'chooseEvent':await act(page.locator('#v4-event-open'));if(action.choice==='decline')await act(page.getByRole('button',{name:'拒绝，保留眼前资源',exact:true}));else{if(action.pieceId){const b=before.blades.find(b=>b.id===action.pieceId)!;await act(page.getByRole('button',{name:new RegExp(`选这柄 .* ${b.value}$`)}));}else await act(page.getByRole('button',{name:/^接受/}));await confirm();}break;
  case'chooseModification':await act(page.getByRole('button',{name:'装上'+MODIFICATIONS[action.modification].name,exact:true}));break;
  case'setRecipe':await act(page.locator(`#v4-recipes button[data-recipe="${action.recipe}"]`));break;
 }
 await expect.poll(async()=>(await readV4(page)).revision).toBe(expected.state.revision);const actual=await readV4(page);expect(actual).toEqual(expected.state);return actual;
}
export async function saveV4(page:Page,label:string){const s=await readV4(page),dir=`tmp/v4-ui-states/${test.info().project.name}/${test.info().testId.replace(/[^\w-]/g,'_')}`;await mkdir(dir,{recursive:true});await writeFile(`${dir}/${label}.json`,JSON.stringify(s,null,2)+'\n');return s;}
export async function shotV4(page:Page,label:string){const dir=`tmp/v4-ui-states/${test.info().project.name}`;await mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/${label}.png`});}
