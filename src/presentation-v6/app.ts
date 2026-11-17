import { packageUrl } from '../security/package-url.mjs';
import { sanitizeHtml } from '../security/sanitize-html.mjs';
import {getRunView} from '../core-v6/index.js';
import type {Action,DomainEvent,RunState,RunView,School} from '../core-v6/index.js';
import {decodeV6Save,V6_SAVE_KEY,V6_BACKUP_KEY} from '../application/v6-persistence.js';
import type {V6Session} from '../application/v6-persistence.js';
import {bindDirectStrikeInput} from '../platform/direct-strike-input.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import {sameInput} from '../platform/timing.js';
import type {InputIdentity} from '../platform/timing.js';
import {createPreferences} from '../platform/settings.js';
import {createForgeAudio} from '../platform/audio.js';
import {IMPACT_SOUNDS} from '../presentation-v3/impact.js';
import {V6_TEMPLATE} from './shell.js';
import {createExpeditionScene} from './scene.js';
import {stageCopy,forgeCopy,resultCopy,recapCopy,errorCopy} from './copy.js';

interface Choice {label:string;run():void;primary?:boolean;disabled?:boolean}
interface Armed {runId:string;revision:number;generation:number;pieceId:string;school:School;epoch:number}
const fmt=(value:number)=>value.toLocaleString('zh-CN');
const schoolName=(school:School|null)=>school==='steady'?'定线':school==='fissure'?'崩纹':'手艺';
const toolName=(tool:RunView['tool'])=>tool==='rebound'?'回锋齿':'崩炉钉';
const toolImage=(tool:RunView['tool'])=>`/assets/d/v09/${tool==='rebound'?'rebound-tooth':'furnace-nail'}-v1.webp`;
const forging=(phase:string)=>phase==='main-forge'||phase==='echo-forge'||phase==='echo-recharge';

/** Intent and disposable presentation only; all accepted facts belong to the v6 session. */
export function mountV6(root:HTMLElement,port:V6Session){
 root.innerHTML=sanitizeHtml(V6_TEMPLATE);
 const game=root.firstElementChild as HTMLElement;
 const node=<T extends HTMLElement>(id:string)=>{const found=root.querySelector<T>('#'+id);if(!found)throw Error('Missing '+id);return found;};
 const button=(id:string)=>node<HTMLButtonElement>(id),dialog=node<HTMLDialogElement>('x6-dialog');
 const text=(id:string,value:string)=>{const target=node(id);if(target.textContent!==value)target.textContent=value;};
 const show=(id:string,visible:boolean)=>{node(id).hidden=!visible;};
 const el=(tag:string,value?:string)=>{const target=document.createElement(tag);if(value!==undefined)target.textContent=value;return target;};
 const preferences=createPreferences(()=>localStorage),audio=createForgeAudio(undefined,IMPACT_SOUNDS),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let snapshot=port.getSnapshot(),prefs=preferences.getSnapshot(),route:'title'|'play'='title';
 let disposed=false,busy=false,paused=false,modal=false,ending=false,epoch=0,sequence=0,lastScreen='',lastPhase='';
 let display:RunState|null=null,armed:Armed|null=null,hasResult=false,origin:HTMLElement|null=null;
 let input:ReturnType<typeof bindDirectStrikeInput>|null=null;
 const decisionInputs:ReturnType<typeof bindDirectStrikeInput>[]=[];
 let scene:ReturnType<typeof createExpeditionScene>|null=null;
 const reduced=()=>prefs.value.reducedMotion||motion.matches;
 const current=()=>snapshot.state;
 const savedCurrent=()=>!!current()&&!snapshot.dirty&&!snapshot.conflict&&snapshot.lastSave?.ok===true;
 const view=()=>current()?getRunView(current()!):null;
 const writable=()=>snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
 const canAct=()=>!disposed&&route==='play'&&!busy&&!paused&&!modal&&!document.hidden&&writable();
 const message=(copy:string)=>text('x6-status',copy);
 function armedNow(){const state=current(),blade=view()?.activePiece;return!!armed&&!!state&&!!blade&&armed.runId===state.runId&&armed.revision===state.revision&&armed.generation===snapshot.generation&&armed.pieceId===blade.id&&armed.school===blade.school&&armed.epoch===epoch;}
 function cancelVisuals(){sequence++;epoch++;armed=null;busy=false;ending=false;display=null;input?.cancel();for(const binding of decisionInputs)binding.cancel();scene?.cancel();audio.silence();}
 function clearResult(){hasResult=false;show('x6-result',false);}
 function present(events:readonly DomainEvent[]){
  if(events.some(event=>event.type==='Sealed')){clearResult();return;}
  const copy=resultCopy(events);hasResult=copy!==null;show('x6-result',hasResult);if(!copy)return;
  text('x6-result-kicker',copy.kicker);text('x6-result-title',copy.title);text('x6-result-copy',copy.copy);
  const forged=events.find(event=>event.type==='Forged');game.dataset.result=forged?.type==='Forged'?forged.result:events.some(event=>event.type==='GateCleared')?'gate':'action';
 }
 function acceptedSound(events:readonly DomainEvent[]){
  if(events.some(event=>event.type==='GateCleared'))audio.acceptedCue('met');
  else if(events.some(event=>event.type==='Forged')){const hit=events.find(event=>event.type==='Forged');if(hit?.type==='Forged')audio.acceptedCue(hit.result==='broken'?'broken':hit.result==='crack'?'damage':hit.technique?'heavy':'standard');}
  else if(events.some(event=>event.type==='Struck'||event.type==='FollowUpUsed'))audio.acceptedCue('heavy');
  else if(events.some(event=>event.type==='CacheTaken'||event.type==='ChargeRestored'))audio.acceptedCue('purchase');
 }
 function send(action:Action,point:StrikePoint|null=null){
  const before=current();if(!before||!canAct())return false;
  const beforeView=getRunView(before),generation=snapshot.generation;
  cancelVisuals();clearResult();message('');busy=true;display=before;
  const own=++sequence;
  const result=port.dispatch({runId:before.runId,expectedRevision:before.revision,action},generation);
  if(!result.ok){busy=false;display=null;message(errorCopy(result.error));render();return false;}
  const afterView=getRunView(result.state),valid=()=>!disposed&&own===sequence&&snapshot.generation===generation&&current()?.runId===result.state.runId&&current()?.revision===result.state.revision;
  render();scene?.aim(point);void audio.gesture();
  scene?.play(result.events,beforeView,afterView,{
   // The Accepted result is already saved. Keep its physical stage visible until
   // the terminal contact finishes, especially the last returned technique.
   contact:()=>{if(!valid()||document.hidden||paused||modal)return;ending=afterView.ended;display=ending?before:null;present(result.events);acceptedSound(result.events);render();},
   done:()=>{if(!valid())return;busy=false;ending=false;display=null;render();queueMicrotask(focusAction);},
  });
  return true;
 }
 function closeModal(){
  if(dialog.open)dialog.close();modal=false;paused=false;cancelVisuals();render();
  const previous=origin;origin=null;
  queueMicrotask(()=>{if(disposed||modal)return;if(previous?.isConnected&&!previous.closest('[hidden]')&&!previous.matches(':disabled'))previous.focus({preventScroll:true});else focusAction();});
 }
 function openModal(title:string,body:HTMLElement|string,choices:readonly Choice[]){
  origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
  cancelVisuals();modal=true;clearResult();text('x6-dialog-title',title);
  node('x6-dialog-body').replaceChildren(typeof body==='string'?el('p',body):body);
  node('x6-dialog-actions').replaceChildren(...choices.map(choice=>{const target=document.createElement('button');target.type='button';target.textContent=choice.label;target.disabled=!!choice.disabled;target.classList.toggle('x6-primary',!!choice.primary);target.onclick=choice.run;return target;}));
  render();if(!dialog.open)dialog.showModal();node<HTMLButtonElement>('x6-dialog-actions').querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
 }
 function confirm(title:string,copy:string,run:()=>void){
  const ticket={generation:snapshot.generation,runId:current()?.runId,revision:current()?.revision};
  openModal(title,copy,[{label:'再想想',run:closeModal},{label:'确认',primary:true,run:()=>{
   const valid=ticket.generation===snapshot.generation&&ticket.runId===current()?.runId&&ticket.revision===current()?.revision;
   closeModal();if(valid)run();else message(errorCopy('stale_session'));
  }}]);
 }
 function freshInput(){return{runId:crypto.randomUUID(),seed:node<HTMLInputElement>('x6-seed').value.trim()||`开路-${crypto.randomUUID().slice(0,12)}`};}
 function start(){
  const execute=()=>{const result=port.startNewGame(freshInput(),{generation:snapshot.generation,confirmed:true});if(!result.ok){message(errorCopy(result.error));saveDetails();return;}route='play';paused=false;clearResult();message('');render();void audio.gesture();};
  const state=current(),main=snapshot.load?.main,backup=snapshot.load?.backup;
  if(state||!savedCurrent()&&(main?.status==='invalid'||main?.status==='empty'&&backup?.status==='valid'))confirm('另起一炉？','这会替换当前开路行程。想保留的进度可先在“行程”导出；旧版十二灯行旅另有自己的保存。磁盘原文损坏或来自较新版时，请先导出原文，替换不会自动保留它。',execute);
  else execute();
 }
 function continueRun(){if(!current())return;cancelVisuals();clearResult();route='play';paused=false;message('');render();void audio.gesture();}
 function toggleTechnique(){
  const value=view(),blade=value?.activePiece;if(!canAct()||!value?.forge||!blade||!blade.school)return;
  if(!value.forge.technique.allowed){message(errorCopy(value.forge.technique.reason??'unavailable'));return;}
  const wasArmed=armedNow();input?.cancel();epoch++;
  armed=wasArmed?null:{runId:current()!.runId,revision:current()!.revision,generation:snapshot.generation,pieceId:blade.id,school:blade.school,epoch};
  clearResult();message(wasArmed?'这一锤照常锻。':`下一记用${schoolName(blade.school)}，落锤时才会用掉这炉手艺。`);render();if(!wasArmed)queueMicrotask(focusAction);
 }
 function forgeIdentity():InputIdentity|null{
  const value=view(),blade=value?.activePiece,preview=value?.forge;
  if(!canAct()||!blade||!preview||!(armedNow()?preview.technique.allowed:preview.ordinary.allowed))return null;
  return{runId:current()!.runId,revision:current()!.revision,generation:snapshot.generation,epoch,pieceId:blade.id,mode:'standard',periodMs:1,rulesVersion:'forge-v6',node:armedNow()?1:0};
 }
 function discard(){const value=view(),blade=value?.activePiece;if(!blade||!canAct())return;confirm('换一柄新坯？','这柄会留下记录，不能再回炉或提交同一门。只换尚未用过的新坯，这炉已用的手艺次数不会回来。',()=>send({type:'discard',pieceId:blade.id}));}
 function cache(target:'rope'|'latch'){
  const value=view(),quote=value?.caches.find(item=>item.target===target);if(!quote||!canAct())return;
  if(!quote.allowed){message(value?.trial?.turnsLeft===0?'余火已尽，可以带着开路钱启程。':target==='rope'?`切绳要完整的强度${quote.required}剑；这柄${quote.intact?'完整':'有裂纹'}，强度${fmt(quote.actual)}。`:`破闩要实际打出${quote.required}伤害；这柄现在能打${fmt(quote.actual)}。`);return;}
  send({type:'takeCache',target});
 }
 function focusAction(){
  if(disposed||modal||busy||route!=='play')return;
  const value=view();if(!value)return;
  let target:HTMLButtonElement|null=null;
  if(value.ended)target=button('x6-again');
  else if(forging(value.phase)){
   if(!value.activePiece?.school)target=root.querySelector<HTMLButtonElement>('[data-school]');
   else if(armedNow()&&value.forge?.technique.allowed)target=button('x6-forge');
   else if(value.phase==='echo-recharge'&&value.forge?.technique.allowed)target=button('x6-technique');
   else if(value.forge?.ordinary.allowed)target=button('x6-forge');
   else if(value.forge?.seal.allowed)target=button('x6-seal');
   else if(value.forge?.discard.allowed)target=button('x6-discard');
  }else if(value.phase==='cache'){
   const available=value.caches.find(cache=>cache.allowed);target=available?button(available.target==='rope'?'x6-rope':'x6-latch'):button('x6-leave');
  }else target=value.followUp.allowed?button('x6-secondary'):button('x6-primary');
  if(target&&!target.hidden&&!target.closest('[hidden]')&&!target.disabled)target.focus({preventScroll:true});
 }
 function saveProblems(){
  if(snapshot.mode==='memory')return'这趟不保存 · 关闭或刷新会失去当前进度';
  if(snapshot.mode==='readonly')return'另一开路页面正在保存 · 本页只读';
  if(snapshot.mode==='unsupported'||snapshot.mode==='error')return'暂未取得保存权 · 点“行程”选择继续方式';
  if(snapshot.conflict)return'磁盘进度有变化 · 先导出，再读取最新';
  if(snapshot.dirty)return'刚才的成果还没存好 · 可在“行程”重试或导出';
  if(!savedCurrent()&&(snapshot.load?.main.status==='invalid'||snapshot.load?.main.status==='unavailable'))return'本机行程暂不可续读 · 原文保留，请查看“行程”';
  if(!savedCurrent()&&snapshot.load?.main.status==='empty'&&snapshot.load.backup.status==='valid')return'发现可恢复的备份 · 在“行程”核对后继续';
  if(snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning)return'本局已存好，备份没有更新';
  return'';
 }
 function render(){
  if(disposed)return;
  const state=display??current(),value=state?getRunView(state):null,isForge=!!value&&forging(value.phase);
  const screen=route==='title'?'title':value?.ended?'recap':'play',changed=screen!==lastScreen||value?.phase!==lastPhase;
  lastScreen=screen;lastPhase=value?.phase??'';
  game.dataset.screen=screen;game.dataset.phase=value?.phase??'main-forge';game.dataset.forge=String(isForge);game.dataset.busy=String(busy);game.dataset.ending=String(ending);game.dataset.paused=String(paused);game.dataset.armed=String(armedNow());game.dataset.gate=String(!!value?.gateCleared);
  show('x6-title',screen==='title');show('x6-play',screen==='play');show('x6-recap',screen==='recap');show('x6-menu',route==='play');show('x6-wallet',route==='play'&&!!value);
  text('x6-coins',fmt(value?.coins??0));show('x6-continue',!!current());button('x6-continue').disabled=!snapshot.active;
  button('x6-start').disabled=!writable();text('x6-start',current()?'另起炉火':'点火，铸第一剑');
  const warning=saveProblems();show('x6-save-warning',!!warning);text('x6-save-warning',warning);text('x6-save',warning?'行程 !':'行程');
  if(value){
   const copy=stageCopy(value),forge=forgeCopy(value,armedNow()),blade=value.activePiece,allowed=canAct();
   text('x6-stage',copy.eyebrow);text('x6-goal',copy.title);text('x6-purpose',copy.purpose);show('x6-purpose',!hasResult&&(!isForge||!blade?.hits));
   show('x6-supply',isForge);show('x6-schools',isForge);show('x6-readout',screen==='play');
   node('x6-schools').dataset.locked=String(!!blade?.hits);game.dataset.school=blade?.school??'none';
   for(const target of root.querySelectorAll<HTMLButtonElement>('[data-school]')){const school=target.dataset.school;target.setAttribute('aria-pressed',String(school===blade?.school));target.hidden=!!blade?.hits&&school!==blade.school;target.disabled=!allowed||!!blade?.hits||school===blade?.school;}
   const supplies=value.blades.filter(piece=>piece.stage===value.batch.stage);
   node('x6-blanks').replaceChildren(...supplies.map((piece,index)=>{const mark=el('span');mark.dataset.status=piece.status;mark.dataset.current=String(piece.id===blade?.id);mark.setAttribute('aria-label',`第${index+1}柄，${piece.id===blade?.id?'手中':piece.status==='blank'?'尚未用过':piece.status==='broken'?'已断':'已经用过'}`);mark.title=mark.getAttribute('aria-label')!;mark.append(el('i'),el('small',piece.id===blade?.id?'手中':piece.status==='blank'?'待锻':piece.status==='broken'?'已断':'已用'));return mark;}));
   button('x6-discard').disabled=!allowed||!value.forge?.discard.allowed;show('x6-discard',isForge&&value.phase!=='echo-recharge');
   text('x6-strength',fmt(blade?.strength??0));text('x6-condition',forge.condition);text('x6-risk',isForge?forge.risk:copy.uses);text('x6-uses',copy.uses);show('x6-uses',isForge);
   node('x6-hit-count').replaceChildren(...Array.from({length:6},(_,index)=>{const mark=el('i');mark.dataset.used=String(index<(blade?.hits??0));mark.setAttribute('aria-hidden','true');return mark;}));node('x6-hit-count').setAttribute('aria-label',`已锻${blade?.hits??0}/6记`);show('x6-hit-count',isForge);
   const armedValue=armedNow(),canForge=isForge&&!!value.forge&&(armedValue?value.forge.technique.allowed:value.forge.ordinary.allowed);
   button('x6-hit').disabled=!allowed||!canForge;button('x6-hit').setAttribute('aria-busy',String(busy));
   for(const id of ['x6-forge','x6-technique','x6-seal'])show(id,isForge);
   button('x6-forge').disabled=!allowed||!canForge;button('x6-forge').setAttribute('aria-busy',String(busy));const forgeLabel=armedValue?`落下${schoolName(blade?.school??null)}`:'落锤';if(button('x6-forge').dataset.label!==forgeLabel){button('x6-forge').dataset.label=forgeLabel;button('x6-forge').replaceChildren(document.createTextNode(forgeLabel),el('small',armedValue?'仅这一记用手艺':'左键剑身 / 空格'));}
   button('x6-technique').disabled=!allowed||!value.forge?.technique.allowed;text('x6-technique',forge.technique);button('x6-technique').setAttribute('aria-pressed',String(armedValue));
   button('x6-seal').disabled=!allowed||!value.forge?.seal.allowed;text('x6-seal',forge.seal);button('x6-seal').classList.toggle('is-ready',!!value.bladeUses?.mainPlan.clearable&&value.phase==='main-forge');show('x6-seal',isForge&&value.phase!=='echo-recharge');
   const trial=value.trial,trialPhase=value.phase==='main-trial'||value.phase==='echo-trial',cachePhase=value.phase==='cache';
   show('x6-targets',!isForge&&screen==='play');show('x6-primary',trialPhase||cachePhase);show('x6-secondary',trialPhase&&!!trial?.secondary);show('x6-rope',cachePhase);show('x6-latch',cachePhase);
   button('x6-primary').disabled=!allowed||!value.strike.allowed;button('x6-primary').dataset.defeated=String(trial?.primary.health===0);button('x6-primary').dataset.opening=String(!!trial?.opening);
   show('x6-primary-caption',!cachePhase&&trial?.primary.health!==0);
   text('x6-primary-name',cachePhase?'木卫已倒，路通了':value.phase==='echo-trial'?'带甲的试锋主靶':'拦路木卫');text('x6-primary-health',trial?`耐久${trial.primary.health} · ${trial.opening?'破绽已开':`护甲${trial.primary.armor}`}`:'');
   text('x6-primary-preview',value.strike.allowed&&value.strike.preview?`点此出剑 · 可打${value.strike.preview.damage}${value.strike.preview.wear?`，剑磨损${value.strike.preview.wear}`:''}`:'');
   button('x6-primary').setAttribute('aria-label',`斩向${value.phase==='echo-trial'?'主靶':'木卫'}${value.strike.preview?`，预计造成${value.strike.preview.damage}伤害`:''}`);
   button('x6-secondary').disabled=!allowed;button('x6-secondary').dataset.ready=String(value.followUp.allowed);text('x6-secondary-health',trial?.secondary?`耐久${trial.secondary.health}${value.followUp.allowed?` · 可追斩${value.followUp.damage}`:''}`:'');
   for(const quote of value.caches){const id=quote.target==='rope'?'x6-rope':'x6-latch';button(id).disabled=!allowed;button(id).dataset.available=String(quote.allowed);text(id+'-need',quote.target==='rope'?`要完好强度${quote.required} · 当前${quote.actual}${quote.intact?'，完好':'，有裂纹'}`:`要直击伤害${quote.required} · 当前${quote.actual}`);}
   show('x6-guard',trialPhase&&!value.followUp.allowed);button('x6-guard').disabled=!allowed||!value.guard.allowed;text('x6-guard',trial?.opening?'已经探隙 · 再架仍用一回合':'架剑探隙 · 下一斩穿甲＋2');
   show('x6-leave',cachePhase);button('x6-leave').disabled=!allowed||!value.leaveCache.allowed;
   show('x6-turns',trialPhase||cachePhase);node('x6-turns').replaceChildren(...Array.from({length:3},(_,index)=>{const ember=el('i');ember.dataset.lit=String(index<(trial?.turnsLeft??0));return ember;}),el('span',`余火 ${trial?.turnsLeft??0}/3`));
   node('x6-turns').setAttribute('aria-label',`试锋余火${trial?.turnsLeft??0}/3，每次斩击或探隙用一回合`);
   show('x6-tool',!!value.tool&&screen==='play');if(value.tool){
    node<HTMLImageElement>('x6-tool-art').src=packageUrl(toolImage(value.tool));text('x6-tool-name',toolName(value.tool));
    const stored=value.tool==='rebound'&&value.followUp.allowed,recharged=value.tool==='furnace'&&value.phase==='echo-recharge'&&!!value.echo.rechargeGained,full=value.tool==='furnace'&&value.phase==='echo-recharge'&&!value.echo.rechargeGained;
    node('x6-tool').dataset.state=stored?'stored':recharged?'recharged':full?'full':'idle';
    text('x6-tool-pulse',stored?`已存 ${fmt(value.followUp.damage)} 追斩 · 点远靶`:recharged?'手艺 0 → 1 · 接到新坯':full?'次数已满 · 没有多得':'' );show('x6-tool-pulse',stored||recharged||full);
    text('x6-tool-copy',value.tool==='rebound'?stored?'余力已留下，亲手选择远靶追斩。':'探隙斩留下的余力，可以亲手追向另一个目标。':value.echo.rechargeGained?'刚回的一次手艺，还要在另一柄上用出。':value.phase==='echo-recharge'?'用现有的这次手艺，不能再回去试锋。':'先用手艺，再击破甲靶，试着把炉火接回来。');
   }
   if(screen==='recap'){const recap=recapCopy(value);text('x6-recap-title',recap.title);text('x6-recap-copy',recap.copy);node('x6-recap-facts').replaceChildren(...recap.facts.map(copy=>el('p',copy)));show('x6-recap-tool',!!value.tool);if(value.tool)node<HTMLImageElement>('x6-recap-tool').src=packageUrl(toolImage(value.tool));button('x6-again').disabled=!writable();}
   scene?.render(value);
  }
  audio.identify(`${current()?.runId??''}/${snapshot.generation}/${epoch}`);audio.configure(prefs.value);audio.setMode(route==='play'&&!paused&&!modal&&!document.hidden&&snapshot.active?'game':'silent');input?.refresh();for(const binding of decisionInputs)binding.refresh();
  if(changed&&route==='play'&&!busy&&!modal)queueMicrotask(focusAction);
 }
 function download(raw:string,name:string){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=packageUrl(url);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportCurrent(){const raw=port.exportRun();if(raw)download(raw,'一剑开路-当前成果.json');else message('尚未开炉，没有当前成果可导出。');}
 function rawSlot(key:string){try{return{ok:true as const,raw:localStorage.getItem(key)};}catch{return{ok:false as const,error:'读取被拒绝'};}}
 function exportRaw(){const slots={main:rawSlot(V6_SAVE_KEY),backup:rawSlot(V6_BACKUP_KEY)};download(JSON.stringify({kind:'sword-led-v6-raw-sources',slots},null,2),'一剑开路-磁盘主备原文.json');message(slots.main.ok&&slots.backup.ok?'两份磁盘原文已导出；这不是当前手中成果。':'已导出可读取的原文；读取失败的位置已明确标记。');}
 function saveDetails(note?:string){
  const body=el('div'),source=rawSlot(V6_BACKUP_KEY),backup=source.ok?decodeV6Save(source.raw):null,mainSource=rawSlot(V6_SAVE_KEY),mainNow=mainSource.ok?decodeV6Save(mainSource.raw):null;
  body.append(el('p',note??(saveProblems()||(current()?'这趟成果已收好，可继续走。':'还没有开路行程。'))));
  body.append(el('p','“当前成果”包含刚才已做成但可能未写入磁盘的动作；“磁盘原文”分别保主档和备份，损坏或较新版也可先留原件。'));
  const add=(label:string,run:()=>void,disabled=false)=>{const target=document.createElement('button');target.type='button';target.textContent=label;target.disabled=disabled;target.onclick=run;body.append(target);};
  add('导出手中行程',exportCurrent,!current());add('导出磁盘原文（主档与备份）',exportRaw);
  add('重试保存这趟成果',()=>{const result=port.retrySave(snapshot.generation);message(result.ok?'这趟成果已存好。':errorCopy(result.error));closeModal();saveDetails();},snapshot.mode!=='writer'||!snapshot.active||!current()||snapshot.conflict);
  add('重新取得保存权，读取最新',()=>{
   const perform=()=>{closeModal();void(async()=>{await port.activate();if(disposed)return;const latest=port.getSnapshot();if(latest.mode==='writer'&&latest.load?.main.status==='valid'){const result=port.resume({generation:latest.generation,confirmed:true});if(!result.ok)message(errorCopy(result.error));}render();saveDetails();})();};
   if(snapshot.dirty)confirm('读取最新的磁盘行程？','尚未写入的手中成果会被替换，可先取消并导出。',perform);else perform();
  },snapshot.mode==='memory');
  if(snapshot.mode==='memory')body.append(el('p','本次是不保存行程；想重新读取磁盘，请先导出手中成果，再重新打开本页。'));
  if(backup?.status==='valid'&&source.ok){
   const shown=source.raw,copy=backup;
   body.append(el('p',`备份：${new Date(copy.savedAt).toLocaleString('zh-CN')}，${copy.state.gateCleared?'已经开路':'尚未开路'}，${copy.state.coins}铜钱。`));
   add('恢复眼前这份备份',()=>confirm('恢复这份备份？',`将用刚展示的备份继续。${snapshot.dirty?'尚未写入的手中成果也会被替换，可先取消并导出。':''}当前磁盘主档若损坏或版本不识别，请先导出原文；恢复不会自动替你留存它。`,()=>{
    const latest=rawSlot(V6_BACKUP_KEY);if(!latest.ok||latest.raw!==shown){saveDetails('备份已变化，请重新核对眼前来源。');return;}
    const result=port.recoverBackup({generation:snapshot.generation,confirmed:true});if(result.ok){route='play';clearResult();render();}else saveDetails(errorCopy(result.error));
   }),snapshot.mode!=='writer'||!snapshot.active||!mainSource.ok||mainNow?.status==='valid');
  }
  body.append(el('p','不保存试玩会保留磁盘原文；关闭或刷新会失去这次未写入的行程。'));
  add(current()?'保留手中行程，不保存继续':'不保存，开一炉试玩',()=>{const result=port.useMemory(current()?null:freshInput(),{generation:snapshot.generation,confirmed:true});if(result.ok){closeModal();route='play';clearResult();render();}else message(errorCopy(result.error));});
  openModal('把这趟行程收好',body,[{label:'收好，回到眼前',primary:true,run:closeModal}]);
 }
 function history(){
  const state=current();if(!state)return;const body=el('div');
  for(const blade of state.blades.filter(blade=>blade.hits>0)){const title=el('h3',`${blade.stage==='main'?'开路':'试器'}第${blade.id.split('-')[1]}柄 · ${schoolName(blade.school)}`);body.append(title,el('p',`${blade.hits}记，收锻强度${blade.sealedStrength??blade.strength}，当前强度${blade.strength}，${blade.fissureMarked?'实际刻入崩纹':blade.cracked?'意外裂纹':'完整'}。`));}
  for(const trial of [...state.trials,...(state.trial?[state.trial]:[])]){body.append(el('h3',trial.kind==='main'?'开路试锋':'工具试锋'));for(const step of trial.steps)body.append(el('p',step.action==='guard'?`第${step.turn}火：架剑探隙。`:step.action==='rope'?'切下吊索，取走回锋齿。':step.action==='latch'?`直击${step.damage}，破闩取得崩炉钉。`:`第${step.turn}火：${step.action==='followUp'?'追斩':'出剑'}${step.damage}，目标耐久${step.targetBefore}→${step.targetAfter}。`));}
  openModal('刚才的剑，刚才的走法',body,[{label:'收好',primary:true,run:closeModal}]);
 }
 function help(){openModal('炉边，只记这几件事','先选稳锋或裂炉，左键点剑身落锤。手艺按钮只备下一记，真正落锤才花这炉的一次；三柄共用，不会换坯就补。收锻后，用这柄剑亲自开路：斩击与架剑各用一火，共三火。工具不是必拿，完好强度5可切绳，崩纹穿甲直击7可破闩；取得后会当场试着用一次。',[{label:'明白了，回炉边',primary:true,run:closeModal}]);}
 function settings(){const body=el('div');for(const kind of ['muted','volume','reducedMotion'] as const){const row=el('label'),control=document.createElement('input');control.type=kind==='volume'?'range':'checkbox';if(kind==='volume'){control.min='0';control.max='100';control.value=String(prefs.value.volume);control.oninput=()=>preferences.update({volume:Number(control.value)});}else{control.checked=prefs.value[kind];control.onchange=()=>preferences.update({[kind]:control.checked});}row.append(el('span',kind==='muted'?'静音':kind==='volume'?'敲击音量':'减弱动效'),control);body.append(row);}openModal('炉火与声音',body,[{label:'收好',primary:true,run:closeModal}]);}
 function pause(){if(route!=='play')return;paused=true;openModal('炉火为你留着','停一停，再想想这柄剑怎么出手。刚才做成的结果已经保留。',[{label:'继续这一剑',primary:true,run:closeModal},{label:'回看这趟走法',run:history},{label:'声音与动效',run:settings},{label:'把行程收好',run:()=>saveDetails()},{label:'回到开炉处',run:()=>{closeModal();route='title';clearResult();render();}}]);}
 scene=createExpeditionScene(root,{reduced,cancelled:()=>{if(disposed)return;sequence++;epoch++;armed=null;busy=false;ending=false;display=null;input?.cancel();for(const binding of decisionInputs)binding.cancel();audio.silence();render();}});
 input=bindDirectStrikeInput([button('x6-hit'),button('x6-forge')],{context:forgeIdentity,navigationContext:()=>null,navigate:()=>{},commit:(identity,point)=>{if(!sameInput(identity,forgeIdentity()))return;scene?.aim(point);void audio.gesture();const blade=view()?.activePiece;if(blade)send({type:'forge',pieceId:blade.id,useTechnique:armedNow()},point);},aim:point=>{if(canAct())scene?.aim(point);},preparing:value=>scene?.preparing(value)});
 function bindDecision(id:string,index:number,read:()=>Action|null,inspect?:()=>void){
  const target=button(id);
  const identity=(inspection=false):InputIdentity|null=>{
   const state=current(),active=view()?.activePiece,visible=!target.hidden&&!target.closest('[hidden]')&&target.getClientRects().length>0;
   if(!canAct()||!state||!active||!visible||target.disabled||(!inspection&&!read())||(inspection&&(!inspect||read())))return null;
   return{runId:state.runId,revision:state.revision,generation:snapshot.generation,epoch,pieceId:active.id,mode:'standard',periodMs:1,rulesVersion:'forge-v6',node:index*2+(inspection?1:0)};
  };
  decisionInputs.push(bindDirectStrikeInput([target],{context:()=>identity(),navigationContext:()=>identity(true),navigate:()=>inspect?.(),commit:captured=>{const action=read();if(action&&sameInput(captured,identity()))send(action);},aim:()=>{},preparing:value=>{target.dataset.preparing=String(value);}}));
 }
 bindDecision('x6-primary',1,()=>{const value=view();return value?.strike.allowed?{type:'strike',targetId:value.strike.targetId}:null;});
 bindDecision('x6-guard',2,()=>view()?.guard.allowed?{type:'guard'}:null);
 bindDecision('x6-secondary',3,()=>view()?.followUp.allowed?{type:'followUp',targetId:'echo-secondary'}:null,()=>message('先让探隙斩留下余力，再把追斩指向远靶。'));
 for(const [index,target]of (['rope','latch'] as const).entries())bindDecision('x6-'+target,4+index,()=>view()?.phase==='cache'&&view()?.caches.find(quote=>quote.target===target)?.allowed?{type:'takeCache',target}:null,()=>cache(target));
 bindDecision('x6-leave',6,()=>view()?.leaveCache.allowed?{type:'leaveCache'}:null);
 bindDecision('x6-seal',7,()=>{const value=view(),blade=value?.activePiece;return blade&&value?.forge?.seal.allowed?{type:'seal',pieceId:blade.id}:null;});
 for(const [index,school]of (['steady','fissure'] as const).entries())bindDecision('x6-school-'+school,8+index,()=>{const value=view(),blade=value?.activePiece;return blade&&value?.forge?.chooseSchool.allowed&&blade.school!==school?{type:'chooseSchool',pieceId:blade.id,school}:null;});
 bindDecision('x6-technique',10,()=>null,toggleTechnique);bindDecision('x6-discard',11,()=>null,discard);
 button('x6-start').onclick=start;button('x6-again').onclick=start;button('x6-continue').onclick=continueRun;
 button('x6-menu').onclick=pause;button('x6-help').onclick=help;button('x6-save').onclick=()=>saveDetails();button('x6-history').onclick=history;
 const onCancel=(event:Event)=>{event.preventDefault();closeModal();};dialog.addEventListener('cancel',onCancel);
 const onKey=(event:KeyboardEvent)=>{if(event.repeat&&(event.code==='Space'||event.key==='Enter')){event.preventDefault();return;}if(event.key==='Escape'&&!modal&&route==='play'){event.preventDefault();pause();}};
 const onInput=(event:Event)=>{game.dataset.input=event.type==='pointerdown'?'pointer':'keyboard';if(route==='play'&&!modal)void audio.gesture();};
 const onHidden=()=>{if(document.hidden){cancelVisuals();paused=route==='play';render();}else if(paused&&!modal)pause();};
 const onBlur=()=>{cancelVisuals();render();};const onMotion=()=>{cancelVisuals();render();};
 root.addEventListener('keydown',onKey);root.addEventListener('pointerdown',onInput,{capture:true});root.addEventListener('keydown',onInput,{capture:true});document.addEventListener('visibilitychange',onHidden);window.addEventListener('blur',onBlur);motion.addEventListener('change',onMotion);
 const stopPrefs=preferences.subscribe(value=>{const changed=value.value.reducedMotion!==prefs.value.reducedMotion;prefs=value;if(changed)cancelVisuals();render();});
 const stop=port.subscribe(value=>{const changed=value.generation!==snapshot.generation||value.state?.runId!==snapshot.state?.runId;snapshot=value;if(changed){cancelVisuals();clearResult();}render();});
 render();void port.activate();
 return{async dispose(){if(disposed)return;disposed=true;cancelVisuals();stop();stopPrefs();input?.dispose();for(const binding of decisionInputs)binding.dispose();scene?.dispose();dialog.removeEventListener('cancel',onCancel);root.removeEventListener('keydown',onKey);root.removeEventListener('pointerdown',onInput,{capture:true});root.removeEventListener('keydown',onInput,{capture:true});document.removeEventListener('visibilitychange',onHidden);window.removeEventListener('blur',onBlur);motion.removeEventListener('change',onMotion);await Promise.allSettled([port.dispose(),audio.dispose()]);if(root.firstElementChild===game)root.replaceChildren();}};
}
