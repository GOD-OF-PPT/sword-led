import type {Action,CreateRunInput,Recipe,Trait} from '../src/core-v4/index.js';
type Kernel=Pick<typeof import('../src/core-v4/index.js'),'createRun'|'applyCommand'|'getRunView'|'eventQuote'>;
export type WitnessPlan='complete'|'return'|'defeat'|'chapter-defeat';
/** Bounded, visible-information example play. It never reads any random stream or future draw. */
export function playV4(kernel:Kernel,input:CreateRunInput,plan:WitnessPlan='complete',firstModification:'windbox'|'warmRack'='windbox'){
 const made=kernel.createRun(input);if(!made.ok)throw Error(made.error);let state=made.state,commands=0;
 const transitions:{revision:number;day:number;phase:string;action:Action}[]=[];
 const view=()=>kernel.getRunView(state);
 function send(action:Action){if(++commands>1000)throw Error('Witness exceeded finite command budget');const r=kernel.applyCommand(state,{runId:state.runId,expectedRevision:state.revision,action});if(!r.ok)throw Error(`${state.day}/${action.type}: ${r.error}`);state=r.state;transitions.push({revision:state.revision,day:state.day,phase:state.phase,action});}
 function current(id:string){return view().blades.find(p=>p.blade.id===id);}
 function ensureRecipe(id:string,desired:Recipe){const p=current(id);if(p?.canChangeRecipe&&p.blade.recipe!==desired&&view().recipes.some(r=>r.id===desired))send({type:'setRecipe',pieceId:id,recipe:desired});}
 function potentiallyFits(id:string){const p=current(id),v=view();if(!p)return false;const b=p.blade;return v.commission.routes.some(r=>(!r.recipe||b.recipe===r.recipe)&&!(r.crack==='intact'&&b.cracked)&&!(r.age==='old'&&b.suppliedDay>=v.day)&&!(r.age==='new'&&b.suppliedDay!==v.day)&&(r.maxHits===undefined||b.hits<r.maxHits));}
 function growForCommission(id:string){
  for(let n=0;n<40;n++){const p=current(id);if(!p||p.assessment.qualifies)return;if(!p.canStrike||!potentiallyFits(id))return;send({type:'strike',pieceId:id});}
 }
 function growValue(id:string,target:number){for(let n=0;n<32;n++){const p=current(id);if(!p||p.blade.value>=target||!p.canStrike)return;send({type:'strike',pieceId:id});}}
 function manageMerchant(){
  let v=view();if(!v.merchant)return;
  if(v.merchant.canRepair&&v.seals<3)send({type:'repair'});
  v=view();if(v.merchant?.canUpgrade)send({type:'upgrade'});
  v=view();if(!v.merchant||v.traits.length>=3)return;
  const preference:readonly Trait[]=['pardon','ember','echo','crackedEdge','inherit','steady'];
  const offer=preference.find(id=>v.merchant!.offers.some(o=>o.id===id&&!o.sold&&!o.owned));
  const cheap=[...v.blades].filter(p=>!p.reserved).sort((a,b)=>a.blade.value-b.blade.value);
  if(offer&&cheap.length>=3)send({type:'buy',traitId:offer,pieceId:cheap[0]!.blade.id});
 }
 function eventChoice(){
  let v=view();if(!v.event||v.event.status!=='available')return;
  let pieceId:string|undefined;
  if(v.event.piece==='active')pieceId=v.blades.find(p=>!p.reserved)?.blade.id;
  if(v.event.piece==='reserve'){
   let kept=v.blades.find(p=>p.reserved);
   if(!kept&&v.blades.length){send({type:'reserve',pieceId:v.blades[0]!.blade.id});v=view();kept=v.blades.find(p=>p.reserved);}
   pieceId=kept?.blade.id;
  }
  const q=kernel.eventQuote(state,pieceId);
  send(q.allowed?{type:'chooseEvent',choice:'accept',...(pieceId?{pieceId}:{})}:{type:'chooseEvent',choice:'decline'});
 }
 while(!['victory','return','defeat'].includes(view().phase)){
  let v=view();
  if(v.phase==='opening'){send({type:'continue'});continue;}
  if(v.phase==='chapter'){const choice=v.chapterChoices.find(m=>m.id==='wideMouth')??v.chapterChoices.find(m=>m.id===firstModification)??v.chapterChoices[0]!;send({type:'chooseModification',modification:choice.id});continue;}
  if(v.phase==='summary'){send({type:'advance'});continue;}
  if(plan==='defeat'||plan==='chapter-defeat'&&v.day>=5||plan==='return'&&v.day===12){send({type:'settle'});continue;}
  if(v.gift.canClaim&&!v.traits.some(t=>t.id==='steady'))send({type:'claimGift',traitId:'steady'});
  manageMerchant();v=view();
  const ids=[...v.blades].sort((a,b)=>Number(b.reserved)-Number(a.reserved)).map(p=>p.blade.id);
  for(const id of ids){
   v=view();if(v.commission.progress.complete)break;const p=current(id);if(!p)continue;
   const route=v.commission.routes.find(r=>(r.age!=='old'||p.blade.suppliedDay<v.day)&&(r.age!=='new'||p.blade.suppliedDay===v.day));
   if(route?.recipe)ensureRecipe(id,route.recipe);
   if(current(id)?.reserved)send({type:'reserve',pieceId:id});
   growForCommission(id);const after=current(id);if(after)send({type:'deliver',pieceId:id});
  }
  v=view();if(v.gift.canClaim){const option=(['steady','ember']as const).find(id=>!v.traits.some(t=>t.id===id));if(v.traits.length<3)send({type:'claimGift',traitId:option??null});}
  eventChoice();v=view();
  const oldNeed=v.next?.commission.routes.find(r=>r.age==='old');
  let keeper=v.blades.find(p=>p.reserved)?.blade.id;
  if(oldNeed){const candidate=v.blades.find(p=>p.reserved)??[...v.blades].sort((a,b)=>b.blade.value-a.blade.value)[0];if(candidate){const id=candidate.blade.id;if(candidate.reserved)send({type:'reserve',pieceId:id});growValue(id,oldNeed.value);if(current(id)){send({type:'reserve',pieceId:id});keeper=id;}}}
  for(const id of view().blades.filter(p=>!p.reserved&&p.blade.id!==keeper).map(p=>p.blade.id)){
   for(let n=0;n<3;n++){const p=current(id);if(!p||!p.canStrike||p.blade.hits>=3)break;send({type:'strike',pieceId:id});}
   if(current(id))send({type:'deliver',pieceId:id});
  }
  send({type:'settle'});
 }
 return{state,transitions,commands};
}
