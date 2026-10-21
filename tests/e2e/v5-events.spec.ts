import {test,expect} from '@playwright/test';
import type {EventId} from '../../src/core-v5/index.js';
import {KeyboardV5,v5Sdk} from './v5-helpers.js';
import {eventBoundaryV5,lastStrikeV5,reloadExactV5} from './v5-interaction-helpers.js';
const IDS:readonly EventId[]=['donation','loan','salvage','credit','shelter','rest'];

for(const id of IDS)for(const choice of ['accept','decline'] as const)test(`v5 restored boundary: explicit ${id} ${choice}, reload and real next-day consequence`,async({page},info)=>{
 const h=new KeyboardV5(page,info,'mouse');await h.install();const boundary=eventBoundaryV5(id);await h.restoreLegitimate(boundary);expect(boundary.day).toBe(3);expect(boundary.eventId).toBe(id);expect(boundary.reserveId).toBe('d3-1');
 const before=(await h.read()).state;
 await h.same('inspect then cancel does not choose event',async()=>{await h.activate(page.locator('#v4-event-open'));await expect(page.locator(`#v4-dialog-body canvas[data-prop="${id}"]`)).toBeVisible();if(choice==='accept')await h.capture(`${id}-event-offer`);await h.activate(page.getByRole('button',{name:'暂不决定',exact:true}));});
 if(id==='salvage'&&choice==='accept'){
  const raw=(await h.read()).raw;await h.same('cancel selected old-sword event confirmation',async()=>{await h.activate(page.locator('#v4-event-open'));await h.activate(page.locator('[data-event-piece="d3-1"] button'));await expect(page.locator('#v4-dialog-title')).toBeVisible();await h.activate(page.getByRole('button',{name:'再想想',exact:true}));});expect((await h.read()).raw).toEqual(raw);
 }
 const pieceId=id==='donation'?'d3-2':id==='salvage'?'d3-1':undefined;
 const action={type:'chooseEvent' as const,choice,...(choice==='accept'&&pieceId?{pieceId}:{})};const quote=v5Sdk.eventQuote(before,pieceId);const chosen=await h.command(action),record=chosen.eventHistory.at(-1)!;
 expect(record).toMatchObject({day:3,id,choice});expect(chosen.eventHistory.filter(e=>e.day===3)).toHaveLength(1);expect(chosen.eventStatus).toBe(choice==='accept'?'accepted':'declined');expect(chosen.coins-before.coins).toBe(choice==='decline'?0:id==='salvage'?160:quote.cost===0?0:-quote.cost);expect(chosen.marketSpent).toBe(before.marketSpent);
 if(choice==='decline'){expect(chosen.blades).toEqual(before.blades);expect(chosen.pending).toEqual(before.pending);expect(chosen.reserveId).toBe(before.reserveId);}
 else if(id==='donation'){expect(chosen.blades.find(b=>b.id==='d3-2')?.status).toBe('donated');expect(chosen.pending.supplyPct).toBe(120);}
 else if(id==='salvage'){expect(chosen.reserveId).toBeNull();expect(chosen.blades.find(b=>b.id==='d3-1')?.status).toBe('bartered');expect(record.pieceId).toBe('d3-1');}
 else if(id==='credit')expect(chosen.crackGuard).toBe(true);
 else if(id==='loan')expect(chosen.pending.loan).toBe(true);
 else if(id==='shelter')expect(chosen.pending.shelter).toBe(true);
 else{expect(chosen.blades).toEqual(before.blades);expect(chosen.pending).toEqual(before.pending);}
 await expect(page.locator('#v4-event-open')).toBeHidden();await reloadExactV5(h);await expect(page.locator('#v4-event-open')).toBeHidden();
 const settlement=v5Sdk.getRunView(chosen).settlement;await h.command({type:'settle'});const next=await h.command({type:'advance'}),fresh=next.blades.filter(b=>b.suppliedDay===4),kept=next.blades.find(b=>b.id==='d3-1');
 expect(next.day).toBe(4);expect(next.eventHistory).toHaveLength(1);expect(next.pending).toEqual({supplyPct:100,loan:false,shelter:false});expect(next.marketSpent).toBe(0);expect(next.coins).toBe(chosen.coins+settlement.recovered);
 expect(fresh).toHaveLength(id==='salvage'&&choice==='accept'?3:2);const base=choice==='accept'&&id==='donation'?48:40;expect(fresh.map(b=>b.base)).toEqual(fresh.map(()=>base));if(kept?.status==='active')expect(kept.value).toBe(40);
 expect(next.dayBuffs).toEqual({supplyPct:base===48?120:100,loan:choice==='accept'&&id==='loan',shelter:choice==='accept'&&id==='shelter'});await reloadExactV5(h);
 if(choice==='accept'&&id==='loan'){
  await h.command({type:'reserve',pieceId:'d3-1'});await h.command({type:'strike',pieceId:'d3-1'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);
  for(let n=0;n<3;n++){await h.command({type:'strike',pieceId:'d4-1'});expect(lastStrikeV5(h).hits.every(hit=>hit.triggers.includes('loan'))).toBe(true);}
  await h.command({type:'strike',pieceId:'d4-1'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);await h.command({type:'strike',pieceId:'d4-2'});expect(lastStrikeV5(h).hits.every(hit=>!hit.triggers.includes('loan'))).toBe(true);
 }
 if(choice==='accept'&&id==='shelter'){
  await h.command({type:'reserve',pieceId:'d3-1'});
  for(const pieceId of ['d3-1','d4-1','d4-2'])for(let n=0;n<3;n++){await h.command({type:'strike',pieceId});expect(lastStrikeV5(h).hits.every(hit=>hit.triggers.includes('shelter'))).toBe(pieceId==='d4-1');}
  const view=v5Sdk.getRunView((await h.read()).state),a=view.blades.find(p=>p.blade.id==='d4-1')!,b=view.blades.find(p=>p.blade.id==='d4-2')!;expect(a.odds.crack).toBe(Math.max(0,b.odds.crack-30));
 }
 if(choice==='accept'&&id==='credit'){
  let consumed=false,broken=false;for(let n=0;n<30;n++){const s=(await h.read()).state,piece=v5Sdk.getRunView(s).blades.find(p=>p.blade.id==='d4-1');if(!piece?.canStrike)break;await h.command({type:'strike',pieceId:'d4-1'});for(const hit of lastStrikeV5(h).hits){if(hit.result==='crack'){expect(hit.triggers).toContain('credit');expect(hit.after).toBe(hit.before);consumed=true;await reloadExactV5(h);}if(hit.result==='broken'){expect(hit.triggers).not.toContain('credit');broken=true;}}if(broken)break;}expect(consumed).toBe(true);expect(broken).toBe(true);expect((await h.read()).state.crackGuard).toBe(false);
 }
 if(choice==='accept')await h.capture(`${id}-actual-next-day`);await reloadExactV5(h);expect((await h.read()).state.eventHistory.filter(e=>e.id===id)).toHaveLength(1);await h.finish({scope:'Explicit event accept/decline from fully replayed restored boundary, with actual UI refresh/advance/effects; not a new complete game',event:id,choice});
});
