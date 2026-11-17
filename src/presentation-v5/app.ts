import { packageUrl } from '../security/package-url.mjs';
import { sanitizeHtml } from '../security/sanitize-html.mjs';
import {decodeV4Save,V4_SAVE_KEY} from '../application/v4-persistence.js';
import {collectionEligibility,COLLECTION_BACKUP_KEY,decodeCollection} from '../application/v5-collection.js';
import {V5_BACKUP_KEY,decodeV5Save} from '../application/v5-persistence.js';
import type {V5Session,V5NewGameInput} from '../application/v5-persistence.js';
import type {Action,Blade,RunState,Trait,Modification,EventId} from '../core-v5/index.js';
import {getRunView,RECIPES,TRAITS,MODIFICATIONS,CHAPTERS,COMMISSIONS,eventQuote,JOURNAL_SOFT_LIMIT} from '../core-v5/index.js';
import {bindDirectStrikeInput} from '../platform/direct-strike-input.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import {sameInput} from '../platform/timing.js';
import type {InputIdentity} from '../platform/timing.js';
import {createPreferences,SETTINGS_KEY} from '../platform/settings.js';
import {createForgeAudio} from '../platform/audio.js';
import type {AudioStatus} from '../platform/audio.js';
import {IMPACT_SOUNDS} from '../presentation-v3/impact.js';
import {traitArt} from '../presentation-v3/art.js';
import {enableKeyboardNavigation} from '../presentation/dom.js';
import {element,workshopText} from './copy.js';
import {V5_TEMPLATE} from './shell.js';
import {createForgeRenderer} from '../presentation-v4/forge.js';
import type {ForgeContactFrame} from '../presentation-v4/forge.js';
import {createWorkbenchFeedback} from './workbench-feedback.js';
import {createCraftMoment} from './craft-moment.js';
import {createCommissionPaper,commissionPaper} from './commission-paper.js';
import type {FeedbackRect} from './workbench-feedback.js';
import {createHandoff} from '../presentation-v4/handoff.js';
import type {HandoffToken,HandoffTarget,HandoffOrigin} from '../presentation-v4/handoff.js';
import {forgeDecisions,nextDayPlan,traitPurpose} from './decisions.js';
import {noticeFromEvents} from './story.js';
import {carryOption,cashOptions,tradeOption,tradePurpose} from './growth-options.js';
import {createMarketStall} from './market-stall.js';
import {readRawRunExport} from './raw-run-export.js';
import {journeyScreen,journeyOutcome,CAMPAIGN_GOAL,isCriticalDay} from './journey.js';
import {buildJourneyStage} from './stages.js';
import {collectionBook,collectionWorkPage} from './collection-ui.js';
import {createArtworkRecovery} from './artwork-recovery.js';
import {workshopPaymentCopy} from './payment-copy.js';
import type {ForgeNotice} from './story.js';

const fmt=(v:number)=>v.toLocaleString('zh-CN');
const AUDIO_COPY:Record<AudioStatus,string>={waiting:'声音尚未启用，可点“试听敲击声”重试；锻造仍可继续。',ready:'声音已就绪。',muted:'当前已静音或音量为零，仍可看见锻造结果。',blocked:'浏览器暂未允许声音，可点“试听敲击声”重试；锻造仍可继续。',unavailable:'当前声音不可用，可重试试听；锻造仍可继续。'};
const ERRORS:Record<string,string>={market_exhausted:'今日收购钱袋用完了，剑仍在。可留给明天、献成器换手艺，或明确回收。',blade_unworked:'献剑需等级至少3，大成可增加两级，不是必须敲三次。',legacy_changed:'旧炉谱或当前行程已变化，请重新预览后再确认。',legacy_unavailable:'这份旧炉谱暂不可读取，可查看另一份来源；原件仍保留。',readonly:'另一窗口正在保存。关闭占用页后，可在保存详情中读取最新。',not_active:'页面已停用，请重新读取最新进度。',locks_unsupported:'当前无法取得保存锁，可明确选择不保存试玩。',save_conflict:'磁盘进度已变化，请先导出，再读取最新或保留当前局不保存续玩。',save_unavailable:'主档暂不可读取，可检查备份或不保存试玩。',collection_pending:'新取得的成长尚未安全保存。请先重试本局和炉谱，或导出当前成果。',collection_unavailable:'炉谱暂未保存，请在保存详情中查看原因并重试。',insufficient_coins:'铜钱不足，这次没有扣款。',invalid_replacement:'先选择换下哪门手艺。',at_cap:'这柄剑已经成器，可以交剑或留到明天。',record_limit:'操作记录已到安全上限，仍可交剑、回收和收工。',stale_session:'页面身份已变化，请重新查看这次选择。',stale_revision:'进度已更新，请重新操作。',confirmation_required:'替换当前进度需要明确确认。',recipe_locked:'首锤后配方已经定下。',reserved_piece:'先从剑架取回，再加工或交付。',challenge_locked:'完成完整旅程后才可开启行脚挑战。',session_busy:'本次结果正在收妥，请稍后再试。'};
const SAVE_ERRORS:Record<string,string>={storage_read_failed:'读取被拒绝',storage_write_failed:'写入失败',storage_conflict:'磁盘内容已变化',unsupported_schema:'版本较新或不兼容',unsupported_rules:'使用其他规则',invalid_json:'文件内容损坏',invalid_state:'进度未通过回放校验',invalid_timestamp:'保存时间无效',save_too_large:'存档过大',serialization_failed:'无法生成存档',recovery_required:'发现旧备份，需要明确恢复',run_unsaved:'请先保存当前局，再保存新成长',run_changed:'当前局已被其他窗口更新'};
interface ModalAction {label:string;run:()=>void;disabled?:boolean;primary?:boolean;id?:string}
type SceneOverride={kind:'delivery';revision:number;commissionId:number;pieceIds:readonly string[]}|{kind:'intro';revision:number};

export interface V5PresentationOptions {presentation?:'classic'|'focus'}
export function mountV5(root:HTMLElement,port:V5Session,options:V5PresentationOptions={}){
 root.innerHTML=sanitizeHtml(V5_TEMPLATE);enableKeyboardNavigation(root);const ownRoot=root.firstElementChild;
 const focused=options.presentation==='focus';ownRoot?.setAttribute('data-forge-layout',focused?'focus':'classic');
 const find=<T extends HTMLElement>(id:string)=>{const n=root.querySelector<T>('#'+id);if(!n)throw Error('Missing '+id);return n;};
 const button=(id:string)=>find<HTMLButtonElement>(id),dialog=find<HTMLDialogElement>('v4-dialog'),stageArtwork=find<HTMLImageElement>('v4-stage-image');
 const text=(id:string,value:string)=>{const copy=workshopText(value),n=find(id);if(n.textContent!==copy)n.textContent=copy;};
 const show=(id:string,value:boolean)=>{find(id).hidden=!value;};
 if(focused){
  for(const node of root.querySelectorAll('.v4-edition,.v4-bench-mark > span'))node.textContent='炉火试作 · 三柄行囊';
  const link=find<HTMLAnchorElement>('v5-old-v4');link.href=packageUrl('/classic.html');link.textContent='回到原炉台';
 }
 const preferences=createPreferences(()=>localStorage),audio=createForgeAudio(undefined,IMPACT_SOUNDS),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let snapshot=port.getSnapshot(),collection=port.getCollectionSnapshot(),prefs=preferences.getSnapshot();
 let disposed=false,route:'title'|'game'='title',modal=false,paused=false,busy=false,epoch=0,selectedId='',stageKey='',inventoryKey='',recipeKey='',beltKey='',stageMode='title';
 let origin:HTMLElement|null=null,modalKind='',seedDraft='',notice:ForgeNotice|null=null,sceneOverride:SceneOverride|null=null;
 let renderer:ReturnType<typeof createForgeRenderer>|null=null,input:ReturnType<typeof bindDirectStrikeInput>|null=null,handoff:ReturnType<typeof createHandoff>|null=null;
 let feedback:ReturnType<typeof createWorkbenchFeedback>|null=null;
 let craftMoment:ReturnType<typeof createCraftMoment>|null=null;
 let paper:ReturnType<typeof createCommissionPaper>|null=null;
 let strikeReadout:{runId:string;revision:number;generation:number;epoch:number;pieceId:string;value:number;level:number}|null=null;
 let inlineDelivery:{runId:string;day:number;commissionId:number;pieceIds:readonly string[];amount:number;baseFee:number;bonus:number}|null=null;
 let lastPoint:StrikePoint|null=null,effectGeneration=0;
 let lastTriggers:readonly string[]=[];
 let audioStatus:AudioStatus=audio.getStatus(),artFailureSeen=false,stageAssetGeneration=0,stageExpectedSrc='',stageFailedSrc:string|null=null,stageLoading=false,stageRetries=0;
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const sceneAnimations=new Set<Animation>();
 const thumbnailBlades=new WeakMap<HTMLCanvasElement,Blade>();
 const auxiliaryArtwork=createArtworkRecovery(root,{changed:updateArtworkStatus,failed:artworkProblem});
 const reduced=()=>prefs.value.reducedMotion||motion.matches;
 const state=()=>snapshot.state,current=()=>state()?.blades.find(b=>b.id===selectedId)??null;
 const identity=()=>`${state()?.runId??''}/${snapshot.generation}/${epoch}`;
 const canAct=()=>!disposed&&route==='game'&&!modal&&!paused&&snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
 const setStatus=(value:string)=>text('v4-status',value);
 function pauseNotice():ForgeNotice{return{title:'炉火还在，已经为你暂停',copy:'刚才未完成的输入与动效已取消，已接受的成果保持。',action:'resume',label:'继续这一炉'};}
 function cancelPresentation(clearScene=true){effectGeneration++;for(const id of timers)clearTimeout(id);timers.clear();for(const a of sceneAnimations)a.cancel();sceneAnimations.clear();renderer?.cancel();input?.cancel();handoff?.cancel();feedback?.cancel();craftMoment?.cancel();const reading=strikeReadout;strikeReadout=null;busy=false;lastTriggers=[];if(reading){const b=current();text('v4-value',b?fmt(b.value):'—');text('v4-craft-record',b?`等级 ${b.level} · 已完成安全连锻 ${b.bursts}次`:'');const s=state();if(s)renderBelt(s);}if(clearScene){sceneOverride=null;inlineDelivery=null;}audio.silence();}
 function later(fn:()=>void,ms:number){const token=effectGeneration,id=setTimeout(()=>{timers.delete(id);if(!disposed&&token===effectGeneration)fn();},ms);timers.add(id);}
 function nextBlade(){const s=state();selectedId=s?.blades.find(b=>b.status==='active'&&b.id!==s.reserveId)?.id??s?.reserveId??'';}
 function action(label:string,run:()=>void,primary=false,disabled=false){const node=element('button',label,primary?'v4-primary':'v4-secondary');node.type='button';node.disabled=disabled;node.onkeydown=e=>{if(e.repeat&&(e.key==='Enter'||e.code==='Space'))e.preventDefault();};node.onclick=run;return node;}
 function commandAction(label:string,command:Action,primary=true){const ticket={runId:state()?.runId,revision:state()?.revision,generation:snapshot.generation};const node=action(label,()=>{if(disposed)return;if(ticket.runId!==state()?.runId||ticket.revision!==state()?.revision||ticket.generation!==snapshot.generation){resultError('stale_session');return;}send(command);},primary);node.dataset.economic='true';return node;}
 function prop(id:Modification|EventId){const c=element('canvas',undefined,'v4-card-art');c.width=220;c.height=170;c.dataset.prop=id;c.setAttribute('aria-hidden','true');renderer?.paintProp(c,id);return c;}
 function thumb(b:Blade){const c=element('canvas',undefined,'v4-blade-thumb');c.width=240;c.height=88;c.dataset.blade=b.id;thumbnailBlades.set(c,b);c.setAttribute('aria-hidden','true');renderer?.paintThumb(c,b);return c;}
 function repaintProps(){for(const node of root.querySelectorAll<HTMLCanvasElement>('canvas[data-prop]'))renderer?.paintProp(node,node.dataset.prop as Modification|EventId);for(const node of root.querySelectorAll<HTMLCanvasElement>('canvas[data-blade]')){const b=thumbnailBlades.get(node);if(b)renderer?.paintThumb(node,b);}}
 function syncAudio(){audio.identify(identity());audio.configure(prefs.value);audio.setMode(route==='game'&&!paused&&!modal&&!document.hidden&&snapshot.active?'game':'silent');}
 function closeModal(resume=true){const kind=modalKind;if(kind==='legacy-import')port.cancelLegacyImport();if(dialog.open)dialog.close();modal=false;modalKind='';epoch++;cancelPresentation(false);if(kind==='pause'&&resume)paused=false;render();const target=origin;origin=null;queueMicrotask(()=>{if(disposed||modal)return;const visible=(node:HTMLElement|null):node is HTMLElement=>!!node&&node.isConnected&&!node.matches(':disabled')&&!node.closest('[hidden]')&&node.getClientRects().length>0;const fallback=route==='title'?button('v4-start'):stageMode==='workshop'?button('v4-strike'):find('v4-stage-actions').querySelector<HTMLButtonElement>('button:not(:disabled)')??find('v4-stage-title');if(visible(target))target.focus({preventScroll:true});else if(visible(fallback))fallback.focus({preventScroll:true});else button('v4-save-open').focus({preventScroll:true});});}
 function openModal(title:string,body:HTMLElement|string,choices:ModalAction[],kind='choice'){
  if(modal)closeModal();origin=document.activeElement instanceof HTMLElement?document.activeElement:null;cancelPresentation();epoch++;modal=true;modalKind=kind;syncAudio();dialog.dataset.kind=kind;text('v4-dialog-title',title);find('v4-dialog-body').replaceChildren(typeof body==='string'?element('p',body):body);find('v4-dialog-actions').replaceChildren(...choices.map(c=>{const node=action(c.label,c.run,!!c.primary,!!c.disabled);if(c.id)node.id=c.id;return node;}));dialog.showModal();find('v4-dialog-body').scrollTop=0;find<HTMLButtonElement>('v4-dialog-actions').querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});repaintProps();
 }
 function confirm(title:string,copy:HTMLElement|string,run:()=>void){const ticket={generation:snapshot.generation,runId:state()?.runId,revision:state()?.revision};openModal(title,copy,[{label:'再想想',run:()=>closeModal()},{label:'确认',primary:true,run:()=>{const valid=ticket.generation===snapshot.generation&&ticket.runId===state()?.runId&&ticket.revision===state()?.revision;closeModal();if(valid)run();else setStatus(ERRORS.stale_session!);}}],'confirm');}
 function resultError(error:string){setStatus(ERRORS[error]??'这次选择没有成立，请查看当前目标与保存状态。');}
 function download(value:string,name:string){const blob=new Blob([value],{type:'application/json'}),url=URL.createObjectURL(blob),a=element('a');a.href=packageUrl(url);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportRun(){const value=port.exportRun();if(value)download(value,`灯炉行程-${state()!.runId}.json`);else setStatus('尚未启程，没有当前局可导出。');}
 function exportCollection(){download(port.exportCollection(),'灯炉炉谱.json');}
 function exportRawRun(){
  const bundle=readRawRunExport(()=>localStorage),failed=Object.values(bundle.slots).filter(slot=>!slot.ok).length;
  download(JSON.stringify(bundle,null,2),'灯炉磁盘局档原文.json');
  const message=failed?`已生成原文文件，但有${failed}个位置读取失败；文件中已分别标记，允许读取后可重试。`:'已生成主档与备份的原文文件；这是留存原文，不是可直接续玩的行程。';
  setStatus(message);const output=root.querySelector('#v5-raw-export-status');if(output)output.textContent=message;
 }

 function transferOrigin(pieceId:string):FeedbackRect|null{
  const node=pieceId===selectedId?find('v4-blade'):state()?.reserveId===pieceId?find('v4-reserve-slot').querySelector('canvas'):root.querySelector(`#v4-inventory button[data-piece="${pieceId}"] canvas`);
  const box=node?.getBoundingClientRect();return box&&box.width>0&&box.height>0?{left:box.left,top:box.top,width:box.width,height:box.height}:null;
 }
 function send(command:Action,sourceOverride:FeedbackRect|null=null){
  if(!canAct()||busy){setStatus('先回到炉前，再作这次选择。');return false;}
  const before=state();if(!before)return false;
  const moved='pieceId'in command?before.blades.find(b=>b.id===command.pieceId):undefined,source=moved?(sourceOverride??transferOrigin(moved.id)):null;
  feedback?.cancel();strikeReadout=command.type==='strike'&&moved?{runId:before.runId,revision:before.revision+1,generation:snapshot.generation,epoch,pieceId:moved.id,value:moved.value,level:moved.level}:null;
  const r=port.dispatch({runId:before.runId,expectedRevision:before.revision,action:command},snapshot.generation);
  if(!r.ok){strikeReadout=null;resultError(r.error);render();return false;}
  const n=noticeFromEvents(r.events,r.state,before);notice=n?.subject?{...n,subject:{...n.subject,generation:snapshot.generation}}:n;
  if(r.events.some(e=>e.type==='Opened'))notice={title:'炉火点着了',copy:'左键点剑身落锤。纸单下会写出实际收款，合格后再交给来客。',action:'none',label:''};
  if(r.events.some(e=>e.type==='Advanced')){const v=getRunView(r.state);notice=v.merchant?{title:'行脚商人到了',copy:'可以用一柄余剑换手艺，或为后续来料作准备。先看清今天要交什么。',action:'shop',label:'看看炉边摊'}:{title:'新的一天，新的约定',copy:v.commission.request,action:'none',label:''};}
  const strike=r.events.find(e=>e.type==='Strike');
  if(strike?.type==='Strike'){
   lastTriggers=[];
   const wasReady=getRunView(before).blades.find(p=>p.blade.id===strike.pieceId)?.willCommission;
   if(!n&&!wasReady&&getRunView(r.state).blades.find(p=>p.blade.id===strike.pieceId)?.willCommission){const view=getRunView(r.state),progress=view.commission.progress,multi=view.commission.routes.some(route=>route.count>1),oneMore=progress.routes.some(route=>route.required>1&&route.count===route.required-1);notice={title:'这柄剑，已经合格了',copy:multi?(view.commission.id===11?'这柄剑符合接力的一条路线；旧剑一柄或新剑两柄分别计数。':oneMore?'交出这一柄，双驿需要的两柄就齐了。':'先交出这一柄，再准备另一柄。两柄各自合格，才算完成。'):'现在交给来客，就能保住这一站。也可以继续锻，承担下一锤的风险。',action:'deliver',label:`交给${view.commission.name}`,subject:{runId:r.state.runId,day:r.state.day,revision:r.state.revision,pieceId:strike.pieceId,generation:snapshot.generation}};}
   busy=true;const token=++effectGeneration,b=r.state.blades.find(b=>b.id===strike.pieceId)!;renderer?.draw(b);
   craftMoment?.begin(strike.pieceId,strike.hits,strike.burst);
   renderer?.play(strike,lastPoint,()=>{if(disposed||token!==effectGeneration)return;craftMoment?.settled();busy=false;strikeReadout=null;if(current()?.status!=='active')nextBlade();render();},before.blades.find(piece=>piece.id===strike.pieceId));
   const h=strike.hits.at(-1);if(h&&!focused)setStatus(`${strike.burst?'安全连锻 ×'+strike.hits.length:'落锤'} · ${h.result==='great'?'大成':h.result==='crack'?'出现裂纹':h.result==='broken'?'断剑回收':'锻成'} · 这一记后估值 ${fmt(h.after)}`);
  }else{
   cancelPresentation();if(command.type==='advance'||current()?.status!=='active'||command.type==='reserve'&&r.state.reserveId===selectedId)nextBlade();
   if(command.type==='reserve'&&before.reserveId===command.pieceId&&r.state.reserveId!==command.pieceId)selectedId=command.pieceId;
   const met=r.events.find(e=>e.type==='MainCompleted'),delivered=r.events.find(e=>e.type==='Delivered');
   if(met?.type==='MainCompleted'&&delivered?.type==='Delivered'){
    inlineDelivery={runId:r.state.runId,day:r.state.day,commissionId:met.commissionId,pieceIds:met.pieceIds,amount:delivered.amount,baseFee:delivered.baseFeeDelta,bonus:delivered.qualityBonus};notice=null;audio.acceptedCue('met');
   }else if(delivered?.type==='Delivered'){if(delivered.matched){const outcome=journeyOutcome(r.state,getRunView(r.state).commission.id);notice={title:'先送到了一柄',copy:`这柄实收${fmt(delivered.amount)}铜钱（酬劳${fmt(delivered.baseFeeDelta)}＋品质加赏${fmt(delivered.qualityBonus)}）。已交${outcome.progressText}，再安排余下的合格剑。`,action:'journey',label:'看看已交的剑'};}audio.acceptedCue('delivery');}
   else if(r.events.some(e=>e.type==='Disposed'))audio.acceptedCue('recycle');
   else if(r.events.some(e=>['Trait','Upgraded','Repaired','Modification'].includes(e.type)))audio.acceptedCue('purchase');
   else if(r.events.some(e=>e.type==='Settled'))audio.acceptedCue(r.state.history.at(-1)?.met?'met':'missed');
   if(command.type==='advance'){
    const kept=before.blades.find(b=>b.id===before.reserveId),warmed=r.state.blades.find(b=>b.id===before.reserveId);
    if(kept&&warmed&&warmed.value>kept.value&&r.state.modifications.includes('warmRack')){lastTriggers=['warmRack'];notice={title:'旧剑还温着',copy:`余温架让留剑从${fmt(kept.value)}变成${fmt(warmed.value)}；裂纹与锤势保持。取回后再决定交给谁。`,action:'journey',label:'看看这一程'};}
    if(r.state.day===3)notice={title:'商人在炉边等你',copy:'等级至少3的成器可换手艺；铜钱可备来料或补契印。今天还有一封炉边来信。',action:'shop',label:'看看商人的摊子'};
    if(r.state.day===7)notice={title:'阿禾的雪中来信',copy:CHAPTERS[1]!.letter,action:'journey',label:'展开灯路回顾'};
    if(r.state.day===11)notice={title:'山口送来的最后一封信',copy:CHAPTERS[2]!.letter,action:'journey',label:'展开灯路回顾'};
    if((before.day===4&&r.state.day===5)||(before.day===8&&r.state.day===9))presentScene({kind:'intro',revision:r.state.revision});
   }
  }
  render();highlightGrowth(before,r.state,r.events);
  if(moved&&r.events.some(event=>event.type==='Delivered')){const delivered=r.events.find(event=>event.type==='Delivered');if(delivered?.type==='Delivered')feedback?.transfer({blade:moved,source,target:delivered.matched?'customer':'shop',copy:delivered.matched?`交到${getRunView(r.state).commission.name}手中 · +${fmt(delivered.amount)}铜钱`:`行会收下 · +${fmt(delivered.amount)}铜钱`});}
  else if(moved&&command.type==='reserve'&&r.state.reserveId===moved.id)feedback?.transfer({blade:moved,source,target:'rack',copy:r.state.day===12?'暂放本局剑架，不带入新局':'这柄留给明天'});
  else if(moved&&command.type==='buy')feedback?.transfer({blade:moved,source,target:'shop',copy:`换得${TRAITS[command.traitId].name}`});
  return true;
 }
 function highlightGrowth(before:RunState,after:RunState,events:readonly import('../core-v5/index.js').DomainEvent[]){
  if(reduced()||document.hidden)return;
  const nodes:HTMLElement[]=[];
  if(before.coins!==after.coins)nodes.push(find('v4-coins'));
  if(before.seals!==after.seals)nodes.push(find('v4-seals'));
  for(const event of events)if(event.type==='Trait'&&event.traitId&&!before.traits.includes(event.traitId)&&after.traits.includes(event.traitId)){const node=root.querySelector<HTMLElement>(`[data-trait="${event.traitId}"]`);if(node)nodes.push(node);}
  if(before.upgradeCount!==after.upgradeCount||before.crackGuard!==after.crackGuard||JSON.stringify(before.pending)!==JSON.stringify(after.pending))nodes.push(find('v4-modifications'));
  for(const node of nodes)try{const animation=node.animate([{filter:'brightness(1)'},{filter:'brightness(1.8)',offset:.3},{filter:'brightness(1)'}],{duration:700,easing:'ease-out'});sceneAnimations.add(animation);void animation.finished.then(()=>sceneAnimations.delete(animation),()=>sceneAnimations.delete(animation));}catch{/* Factual receipts remain available. */}
 }
 function choose(id:string){if(busy||modal||handoff?.isDragging())return;input?.cancel();renderer?.cancel();feedback?.cancel();craftMoment?.cancel();if(notice?.subject&&notice.subject.pieceId!==id)notice=null;epoch++;selectedId=id;render();button('v4-strike').focus({preventScroll:true});}
 function contactReadout(frame:ForgeContactFrame){
  const s=state(),reading=strikeReadout;if(!s||!reading||!busy||reading.runId!==s.runId||reading.revision!==s.revision||reading.generation!==snapshot.generation||reading.epoch!==epoch||reading.pieceId!==frame.pieceId)return;
  strikeReadout={...reading,value:frame.hit.after,level:frame.hit.level};lastTriggers=[...new Set(frame.hit.triggers)];
  text('v4-float',find('v4-float').textContent??'');
  text('v4-value',fmt(frame.hit.after));text('v4-craft-record',`等级 ${frame.hit.level} · 已完成安全连锻 ${frame.after.bursts}次`);renderBelt(s);
  if(focused){craftMoment?.contact(frame);setStatus(`${frame.burst?'安全连锻 '+(frame.index+1)+'/'+frame.total:'落锤'} · ${frame.hit.result==='great'?'大成':frame.hit.result==='crack'?'出现裂纹':frame.hit.result==='broken'?'断剑回收':'锻成'} · 估值 ${fmt(frame.hit.after)}`);}else feedback?.contact(frame);
 }
 function leaveScene(){cancelPresentation();epoch++;stageKey='';if(current()?.status!=='active')nextBlade();render();}
 function updateAudioStatus(next:AudioStatus=audio.getStatus()){
  if(disposed)return;const changed=next!==audioStatus;audioStatus=next;
  const node=root.querySelector<HTMLElement>('#v4-audio-status');if(node){node.dataset.state=next;node.textContent=AUDIO_COPY[next];}
  if(changed&&(next==='blocked'||next==='unavailable')&&modalKind!=='settings')setStatus(AUDIO_COPY[next]);
 }
 function artworkStatus(){const forge=renderer?.assetStatus(),auxiliary=auxiliaryArtwork.status();return{loading:!!forge?.loading||stageLoading||auxiliary.loading,failed:[...(forge?.failed??[]),...(stageFailedSrc?[stageFailedSrc]:[]),...auxiliary.failed]};}
 function updateArtworkStatus(){
  if(disposed)return;const status=artworkStatus();if(status.failed.length)artFailureSeen=true;
  const region=root.querySelector<HTMLElement>('#v4-art-status');
  if(region){
   if(artFailureSeen)region.dataset.hadProblem='true';
   const value=status.loading?'loading':status.failed.length?'failed':'ready';region.dataset.state=value;region.hidden=region.dataset.hadProblem!=='true';
   const copy=region.querySelector<HTMLElement>('#v4-art-copy'),retry=region.querySelector<HTMLButtonElement>('#v4-art-retry');
   if(copy)copy.textContent=value==='loading'?'正在重新装入画稿，锻造仍可继续。':value==='failed'?'部分画稿尚未装入，可以重试；锻造结果和进度保持。':'画稿已重新点亮，可以回炉边继续。';
   if(retry){const returnFocus=value==='ready'&&document.activeElement===retry;retry.disabled=status.loading;retry.hidden=value==='ready';if(returnFocus&&modalKind==='settings')find('v4-dialog-actions').querySelector<HTMLButtonElement>('.v4-primary')?.focus({preventScroll:true});}
  }
  if(artFailureSeen&&!status.loading&&!status.failed.length){artFailureSeen=false;setStatus('画稿已重新点亮。');}
 }
 function artworkProblem(){if(disposed)return;artFailureSeen=true;setStatus('部分画稿尚未装入，可在设置里重试；文字、数值与锻造仍可使用。');updateArtworkStatus();}
 function loadStageImage(src:string,retry=false){
  if(disposed)return;const token=++stageAssetGeneration;stageLoading=true;stageFailedSrc=null;
  const url=retry?`${src}${src.includes('?')?'&':'?'}retry=${++stageRetries}`:src;
  const ready=()=>{if(disposed||token!==stageAssetGeneration||!stageLoading)return;stageLoading=false;stageFailedSrc=null;updateArtworkStatus();};
  stageArtwork.onload=ready;stageArtwork.onerror=()=>{if(disposed||token!==stageAssetGeneration)return;stageLoading=false;stageFailedSrc=src;stageArtwork.onload=null;stageArtwork.onerror=null;stageArtwork.src=packageUrl('/assets/d/forge-backdrop-v2.webp');artworkProblem();};
  stageArtwork.src=packageUrl(url);if(stageArtwork.complete&&stageArtwork.naturalWidth>0)ready();updateArtworkStatus();
 }
 function stageImage(src:string){if(stageExpectedSrc===src)return;stageExpectedSrc=src;loadStageImage(src);}
 function retryArtwork(){const status=artworkStatus();if(disposed||status.loading)return;const failedStage=stageFailedSrc;if(failedStage&&failedStage===stageExpectedSrc)loadStageImage(failedStage,true);renderer?.retryAssets();auxiliaryArtwork.retry();updateArtworkStatus();}

 function presentScene(value:SceneOverride){sceneOverride=value;epoch++;syncAudio();if(value.kind==='intro'&&!reduced())later(()=>{sceneOverride=null;epoch++;stageKey='';render();},4200);}
 function renderStage(s:RunState){
  const key=JSON.stringify([s.runId,s.revision,snapshot.generation,snapshot.active,snapshot.mode,snapshot.conflict,sceneOverride,collection.pending,collection.problem,collection.data]);
  if(stageKey===key)return;stageKey=key;
  const presentation=buildJourneyStage(s,{throughDay:12,temporary:snapshot.mode==='memory',...(sceneOverride?.kind==='delivery'?{delivery:{commissionId:sceneOverride.commissionId,pieceIds:sceneOverride.pieceIds}}:{}),...(sceneOverride?.kind==='intro'?{chapterIntro:true}:{}),collection:{data:collection.data,pending:collection.pending,problem:collection.problem??null},action,commandAction,thumb,prop,leaveScene,book,toTitle,exportRun,...(snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory')?{startChallenge:()=>startNew('challenge')}:{})});
  const copy=find('v4-stage-copy'),pageIdentity=JSON.stringify([s.runId,s.revision,snapshot.generation,presentation.mode]),scrollTop=copy.dataset.journeyPage===pageIdentity?copy.scrollTop:0;
  text('v4-stage-title',presentation.title);copy.replaceChildren(presentation.body);copy.dataset.journeyPage=pageIdentity;copy.scrollTop=scrollTop;find('v4-stage-actions').replaceChildren(...presentation.actions);stageImage(presentation.image);find('v4-stage').dataset.scene=presentation.mode;find('v4-stage').dataset.chapter=String(getRunView(s).chapter.id);repaintProps();
  if((presentation.mode==='delivery'||presentation.mode==='intro')&&!reduced()&&!document.hidden){try{const a=find('v4-stage-image').animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'ease-out'});sceneAnimations.add(a);void a.finished.then(()=>sceneAnimations.delete(a),()=>sceneAnimations.delete(a));}catch{/* The factual outcome remains visible without animation support. */}}
  queueMicrotask(()=>{if(!disposed&&!modal&&stageKey===key){const heading=find('v4-stage-title');heading.tabIndex=-1;heading.focus({preventScroll:true});}});
 }
 function renderInlineDelivery(s:RunState){
  const receipt=inlineDelivery,visible=receipt?.runId===s.runId&&receipt.day===s.day&&s.phase==='workshop';show('v4-inline-delivery',!!visible);
  if(!visible||!receipt)return;const outcome=journeyOutcome(s,receipt.commissionId),image=find<HTMLImageElement>('v4-inline-image');
  text('v4-inline-title',outcome.complete?`${outcome.commission.name}接过了剑`:'先送到了一柄');
  text('v4-inline-copy',outcome.complete?outcome.commission.success:`已经交付${outcome.progressText}，再安排下一柄合格的剑。`);
  if(image.dataset.source!==outcome.image){image.dataset.source=outcome.image;auxiliaryArtwork.image(image,outcome.image,'/assets/d/forge-backdrop-v2.webp');}image.alt=outcome.commission.title+'的实际交付';
  text('v5-inline-payment',`实收 ${fmt(receipt.amount)} 铜钱 · 酬劳${fmt(receipt.baseFee)}＋品质加赏${fmt(receipt.bonus)}`);
  text('v4-inline-review',s.gift==='available'?'收下第一门手艺':'看看灯路');
 }
 function handoffBlade(token:HandoffToken){
  const s=state();if(!s||!canAct()||busy||stageMode!=='workshop'||s.phase!=='workshop'||token.runId!==s.runId||token.revision!==s.revision||token.generation!==snapshot.generation||token.epoch!==epoch)return null;
  const b=s.blades.find(blade=>blade.id===token.pieceId);return b?.status==='active'&&b.id!==s.reserveId?b:null;
 }
 function handoffPreview(token:HandoffToken,target:HandoffTarget){
  const b=handoffBlade(token),s=state();if(!b||!s)return{allowed:false,label:'这次选择已变化，请重新拿起眼前的剑。'};
  const v=getRunView(s),piece=v.blades.find(p=>p.blade.id===b.id);
  if(target==='rack')return{allowed:true,label:!v.next?'暂放本局剑架，不带入新局':s.reserveId?'换这柄留剑：明日一旧两新，不补第四柄':'留给明天：一旧两新，占一柄新坯位'};
  if(piece?.willCommission)return{allowed:true,label:`交给${v.commission.name} · 实收${fmt(piece.quote.amount)}铜钱`};
  return{allowed:false,label:v.commission.progress.complete?'今天的约定已经完成。想换旅费，可点“卖给行会”。':piece?.assessment.routes.map(r=>r.missing.join('、')).filter(Boolean).join('；')||'这柄还不合纸单，再锻一锤或换柄剑。'};
 }
 function commitHandoff(token:HandoffToken,target:HandoffTarget,origin?:HandoffOrigin){
  const b=handoffBlade(token),s=state();if(!b||!s)return;const preview=handoffPreview(token,target);
  if(!preview.allowed){notice={title:'再看一眼纸单',copy:preview.label,action:'none',label:'',subject:{runId:s.runId,day:s.day,revision:s.revision,pieceId:b.id,generation:snapshot.generation}};setStatus(preview.label);renderNotice();return;}
  if(target==='customer'){send({type:'deliver',pieceId:b.id},origin);return;}
  reserveBlade(b.id,origin);
 }
 function reserveBlade(pieceId:string,origin?:FeedbackRect){
  const s=state(),b=s?.blades.find(piece=>piece.id===pieceId);if(!s||!b||b.status!=='active')return;
  const old=s.blades.find(piece=>piece.id===s.reserveId);
  if(s.day===12&&s.reserveId!==b.id){confirm('暂放在本局剑架？','这是最后一炉，没有次日新坯。挂架只保留在本局行程，不会带入新局；收工时也不会自动回收这柄。可以先返回安排交付、出售或回收。',()=>send({type:'reserve',pieceId:b.id},origin));return;}
  if(old&&old.id!==b.id)confirm('换一柄留剑？',`架上的${RECIPES[old.recipe].name}（${fmt(old.value)}）回到炉边，改留这柄${RECIPES[b.recipe].name}（${fmt(b.value)}）。两柄不会同时留到明天；留一柄就只发两柄新坯。`,()=>send({type:'reserve',pieceId:b.id},origin));
  else send({type:'reserve',pieceId:b.id},origin);
 }
 function renderInventory(s:RunState){
  const available=s.blades.filter(b=>b.status==='active'&&b.id!==s.reserveId),key=JSON.stringify([s.runId,snapshot.generation,selectedId,s.reserveId,available.map(b=>[b.id,b.recipe,b.value,b.level,b.cracked])]);
  if(key!==inventoryKey){inventoryKey=key;const fragment=document.createDocumentFragment();for(const b of available){const n=action(`${RECIPES[b.recipe].name} · ${fmt(b.value)}`,()=>choose(b.id));n.dataset.piece=b.id;n.setAttribute('aria-pressed',String(b.id===selectedId));n.prepend(thumb(b));if(b.cracked)n.append(element('small','已有裂纹'));fragment.append(n);}find('v4-inventory').replaceChildren(fragment);const reserve=s.blades.find(b=>b.id===s.reserveId);const slot=find('v4-reserve-slot');if(reserve){const n=action(`取回 ${RECIPES[reserve.recipe].name} · ${fmt(reserve.value)}`,()=>send({type:'reserve',pieceId:reserve.id}));n.prepend(thumb(reserve));slot.replaceChildren(n);}else slot.replaceChildren(element('span',s.day===12?'最后一炉，不跨局留剑':'留一柄，给明天'));}
  for(const n of root.querySelectorAll<HTMLButtonElement>('#v4-inventory button,#v4-reserve-slot button'))n.disabled=!canAct()||busy;
 }
 function renderWorkshop(s:RunState){
  const v=getRunView(s),b=current(),active=v.blades.find(p=>p.blade.id===b?.id),strikeReady=!!active?.canStrike&&canAct()&&!busy;
  const reading=strikeReadout?.runId===s.runId&&strikeReadout.revision===s.revision&&strikeReadout.generation===snapshot.generation&&strikeReadout.epoch===epoch&&strikeReadout.pieceId===b?.id?strikeReadout:null;
  const decision=forgeDecisions(v,b?.id??null),tomorrow=nextDayPlan(v);text('v4-plan-line',decision.headline);text('v4-plan-copy',decision.copy);find('v4-plan-line').parentElement!.dataset.tone=decision.tone;
  text('v4-next-plan',tomorrow.reserve?.tone==='ready'?'明日已有合用的剑':v.next?'明日打算':'最后一炉的打算');button('v4-next-plan').disabled=busy;
  text('v4-shop-help',v.merchant?'成器可换手艺 · 等级至少3':'');
  text('v5-rack-title',v.next?'留一把，待明日':'本局暂放的剑');find('v4-reserve-zone').setAttribute('aria-label',v.next?'留给明天的剑':'本局暂放的剑');
  text('v5-slot-plan',v.next?(v.next.oldCount?'明日：旧剑1 ＋ 新坯2':'明日：新坯3'):'最后一炉，没有次日来料');
  find('v5-slot-plan').title=v.next?'明日共三柄；留一柄旧剑会少一柄新坯，取下后不补发。':'这是最后一炉，剑架上的剑不会带入新局。';
  text('v4-day',`${s.mode==='challenge'?'行脚挑战 · ':''}第${s.day}天 · ${v.chapter.title.split(' · ')[1]??v.chapter.title}${isCriticalDay(s.day)?' · 关键约定':''}`);text('v4-goal-name',v.commission.title);paper?.render(v,b?.id??null,`${s.runId}/${snapshot.generation}`);
  text('v4-seals',`${s.seals}/3`);text('v4-coins',fmt(s.coins));text('v4-value',b?fmt(reading?.value??b.value):'—');text('v4-condition',b?`${RECIPES[b.recipe].name} · ${b.status==='broken'?'断裂':b.cracked?'已有裂纹':'无裂纹'}`:'铁砧已空，安排这一炉收工');
  text('v4-craft-record',b?`等级 ${reading?.level??b.level} · 已完成安全连锻 ${b.bursts}次`:'');
  const firstCrack=s.traits.includes('steady')||s.crackGuard?' · 首裂保价，仍留裂纹':' · 首裂会掉价';
  text('v4-risk',active?(active.odds.burst?'下一锤安全连锻，不会裂':`下一锤裂损 ${active.odds.crack/10}%${b?.cracked?' · 再裂会断':firstCrack}`):s.reserveId===b?.id?'这柄在剑架上，先取回再加工':'余剑已安排，可收工');
  const charge=find('v4-charge');charge.replaceChildren(element('span',active?.odds.burst?'锤势已满':`锤势 ${b?.charge??0}/6`),...Array.from({length:6},(_,i)=>{const n=element('i');n.classList.toggle('filled',i<(b?.charge??0));return n;}));
  button('v4-hit').disabled=!canAct();button('v4-hit').setAttribute('aria-busy',String(busy));button('v4-strike').disabled=!canAct();
  const strikeLabel=active?.canStrike?(active.odds.burst?'安全连锻':'落锤'):active?.reserved?'先取回剑':'收工';
  const strikeButton=button('v4-strike');if(strikeButton.dataset.label!==strikeLabel){strikeButton.dataset.label=strikeLabel;strikeButton.replaceChildren(document.createTextNode(strikeLabel),element('span',active?.canStrike?'左键剑身 / 空格':active?.reserved?'到左侧剑架取回':'这一炉已安排好'));}strikeButton.setAttribute('aria-busy',String(busy));
  const quote=active?.quote,payment=workshopPaymentCopy(v,b?.id??null);text('v5-value-meaning',payment.valueHint);text('v5-order-pay',payment.orderPay);find('v5-order-pay').title=payment.orderExplanation;
  text('v4-deliver',payment.quote.buttonText);
  const quoteNode=button('v5-delivery-quote');if(quoteNode.dataset.copy!==payment.quote.breakdown){quoteNode.dataset.copy=payment.quote.breakdown;quoteNode.replaceChildren(element('span',payment.quote.breakdown),element('small','看报价说明 ›'));}quoteNode.title=payment.quote.explanation;
  button('v4-deliver').disabled=!canAct()||busy||!quote?.allowed;
  button('v4-deliver').setAttribute('aria-describedby','v5-delivery-quote');show('v5-arrange',quote?.error==='market_exhausted');button('v5-arrange').disabled=!canAct()||busy;
  text('v4-reserve',s.reserveId===b?.id?'取回留剑':v.next?'留给明天':'暂放本局剑架');button('v4-reserve').disabled=!canAct()||busy||b?.status!=='active';button('v4-scrap').disabled=!canAct()||busy||!active||active.reserved;button('v4-settle').disabled=!canAct()||busy;
  text('v4-customer-name',v.commission.name);text('v4-talk',v.commission.progress.complete?v.commission.success:v.commission.request);find('v4-customer-figure').dataset.customer=v.commission.customer;find('v4-customer-figure').dataset.pose=v.commission.progress.complete?'receiving':'waiting';
  show('v4-shop',!!v.merchant);button('v4-shop').disabled=!canAct()||busy;show('v4-event-open',v.event?.status==='available');if(v.event)text('v4-event-open',`炉边来事 · ${v.event.name}`);button('v4-event-open').disabled=!canAct()||busy;
  const rkey=JSON.stringify([s.runId,b?.id,b?.hits,b?.recipe,v.recipes.map(r=>r.id),canAct(),busy]);if(rkey!==recipeKey){recipeKey=rkey;const list=find('v4-recipes');if(active?.canChangeRecipe&&v.recipes.length>1){list.replaceChildren(...v.recipes.map(r=>{const n=action(r.name,()=>send({type:'setRecipe',pieceId:b!.id,recipe:r.id}),false,!canAct()||busy||r.id===b!.recipe);n.dataset.recipe=r.id;n.setAttribute('aria-pressed',String(r.id===b!.recipe));return n;}));}else list.replaceChildren();}
  find('v4-workshop').dataset.mainComplete=String(v.commission.progress.complete);
  const meter=find('v4-ember-meter');meter.dataset.ready=String(!!active?.odds.burst);meter.dataset.charge=String(b?.charge??0);meter.setAttribute('aria-valuenow',String(b?.charge??0));meter.setAttribute('aria-valuetext',active?.odds.burst?'下一锤安全连锻':`锤势${b?.charge??0}，满六格后连锻`);for(const slot of meter.querySelectorAll<HTMLElement>('[data-ember-index]'))slot.dataset.lit=String(Number(slot.dataset.emberIndex)<(b?.charge??0));
  text('v4-settle',v.commission.progress.complete?(s.day===12?'收炉，提灯归家':'收炉，准备启程'):'收工，封炉');
  renderInventory(s);renderBelt(s);renderInlineDelivery(s);feedback?.syncHeld(s);renderer?.draw(b);input?.refresh();
  if(!strikeReady&&b?.status==='broken')button('v4-hit').disabled=true;
 }
 function renderBelt(s:RunState){
  const v=getRunView(s),key=JSON.stringify([s.runId,s.traits,s.gift,s.pardonUsed,s.modifications,s.upgradeCount,s.day,s.pending,s.dayBuffs,s.crackGuard,s.blades.filter(b=>b.suppliedDay===s.day&&b.slot===1).map(b=>[b.hits,b.status]),lastTriggers,canAct(),busy]);if(key===beltKey)return;beltKey=key;
  find('v4-traits').replaceChildren(...v.traits.map(t=>{const triggered=lastTriggers.includes(t.id),n=action(t.name,()=>{const purpose=traitPurpose(t.id,getRunView(state()!)),body=element('div');body.append(element('p',t.text),element('h3',purpose.headline),element('p',purpose.copy));if(triggered)body.append(element('p','这门手艺在上一记中实际生效。'));openModal(t.name,body,[{label:'回铁砧',run:()=>closeModal()}]);});n.dataset.trait=t.id;n.dataset.used=String(t.used);if(t.used)n.append(element('small','本局已用'));n.dataset.triggered=String(triggered);n.title=workshopText(t.text);n.prepend(traitArt(t.id));if(triggered)n.append(element('small','本锤生效'));return n;}));
  const gift=find('v4-gift');gift.replaceChildren();if(v.gift.status==='available')gift.append(action('首赠 · 选手艺',giftModal,true,!canAct()||busy));
  find('v4-modifications').replaceChildren(...v.modifications.map(m=>{const n=action(m.name,()=>openModal(m.name,m.text,[{label:'收好',run:()=>closeModal()}]));n.dataset.modification=m.id;n.dataset.triggered=String(lastTriggers.includes(m.id));n.prepend(prop(m.id));return n;}));
  const effects:{id:EventId;label:string;copy:string;pending:boolean}[]=[];
  const first=s.blades.find(b=>b.suppliedDay===s.day&&b.slot===1),firstName=first?`${RECIPES[first.recipe].name}（第${first.suppliedDay}天来料）`:'本日首柄新坯';
  if(s.upgradeCount)effects.push({id:'donation',label:`备料${s.upgradeCount}次`,copy:`来料升级已累计${s.upgradeCount}次，眼前剑不变。${v.next?`明日普通新坯底价${fmt(v.next.normalBase)}，第一新坯含余温为${fmt(v.next.firstBase)}。`:'已是最后一炉，没有下一批来料。'}`,pending:false});
  if(s.crackGuard)effects.push({id:'credit',label:'保价待用',copy:'下一次完好剑首裂保住估值，仍会留下裂纹；再次裂损仍会断。首裂时正式消耗。',pending:false});
  else if(lastTriggers.includes('credit'))effects.push({id:'credit',label:'保价已用',copy:'这记首裂实际用掉保价，保住了本次估值；裂纹仍在，再裂仍会断。这不是一份新的待用资格。',pending:false});
  for(const pending of[false,true]){
   const buffs=pending?s.pending:s.dayBuffs,prefix=pending?'明日':'此炉';
   if(buffs.supplyPct===120)effects.push({id:'donation',label:`${prefix}加料`,copy:pending?'护送加料待明日发坯：新坯底价＋20%，留剑则两柄，否则三柄；不作用于旧剑。':'今日新坯已按20%加料发出，底价已包含这份加成；同行旧剑没有额外增值。',pending});
   if(buffs.loan)effects.push({id:'loan',label:pending?'借锤待明日':first&&first.hits>=3?'借锤已用完':'此炉借锤',copy:pending?'明日第一柄新坯前三记普通锤正收益＋10%，同行旧剑不受益。':`${firstName}的前三记普通锤正收益＋10%。${first?.status!=='active'?'这柄已离开铁砧。':`已经敲了${Math.min(first.hits,3)}/3记；安全连锻不消耗普通锤次数。`}`,pending});
   if(buffs.shelter)effects.push({id:'shelter',label:`${prefix}炉棚`,copy:pending?'明日第一柄新坯当天裂损率降低3个百分点，同行旧剑不受益。':`${firstName}当天裂损率降低3个百分点，已计入该柄新坯的风险报价。${first?.status!=='active'?'这柄已离开铁砧。':''}`,pending});
  }
  for(const effect of effects){const node=action(effect.label,()=>openModal(effect.label,effect.copy,[{label:'回铁砧',run:()=>closeModal()}]));node.dataset.effect=effect.id;node.dataset.pending=String(effect.pending);node.dataset.triggered=String(lastTriggers.includes(effect.id));node.prepend(prop(effect.id));find('v4-modifications').append(node);}

 }
 function noticeSubjectCurrent(){const s=state(),subject=notice?.subject;return !subject||!!s&&subject.runId===s.runId&&subject.day===s.day&&subject.revision===s.revision&&(subject.generation===undefined||subject.generation===snapshot.generation);}
 function renderNotice(){
  if(!noticeSubjectCurrent())notice=null;
  if(notice?.action==='deliver'){const piece=state()?getRunView(state()!).blades.find(p=>p.blade.id===notice?.subject?.pieceId):null;if(!piece?.willCommission||piece.reserved)notice=null;}
  const hasResult=focused&&!find('v5-craft-moment').hidden;
  const visible=!!notice&&route==='game'&&(stageMode==='workshop'||paused)&&(!focused||!busy&&!hasResult);show('v4-notice',visible);root.firstElementChild?.setAttribute('data-has-notice',String(visible));if(!notice)return;button('v4-notice-action').disabled=!['book','journey','inspect','resume','none'].includes(notice.action)&&(!canAct()||busy);text('v4-notice-title',notice.title);text('v4-notice-copy',notice.copy);text('v4-notice-action',notice.label);button('v4-notice-action').hidden=notice.action==='none';
 }
 function saveSummary(){
  const problems:string[]=[];if(snapshot.mode==='memory')problems.push('本次不保存，关闭页面会失去当前试玩');else if(snapshot.mode==='readonly')problems.push('另一窗口正在保存，本页只读');else if(snapshot.mode==='unsupported')problems.push('未取得保存锁，可不保存试玩');else if(snapshot.mode==='error')problems.push('保存权获取失败，可重试读取最新，或明确不保存试玩');else if(snapshot.conflict)problems.push('磁盘进度已更新，请先导出');else if(snapshot.dirty)problems.push('当前行程尚未保存');else if(snapshot.load?.main.status==='invalid'||snapshot.load?.main.status==='unavailable')problems.push('主档'+(SAVE_ERRORS[snapshot.load.main.error]??'不可读取'));else if(snapshot.load?.main.status==='empty'&&snapshot.load.backup.status==='valid')problems.push('发现可恢复的局备份');
  if(collection.pending||collection.problem)problems.push('炉谱'+(collection.problem?SAVE_ERRORS[collection.problem]??'待保存':'待保存'));
  if(snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning)problems.push('本局已存，备份未更新');if(collection.lastSave?.ok&&collection.lastSave.backupWarning)problems.push('炉谱已存，备份未更新');if(prefs.problem)problems.push('声音与动效设置尚未保存');return problems;
 }
 function render(){
  if(disposed)return;
  const oldLink=find<HTMLAnchorElement>('v5-old-v4');
  if(!focused)try{const old=decodeV4Save(localStorage.getItem(V4_SAVE_KEY));oldLink.textContent=old.status==='valid'?`继续旧版十二灯 · 第${old.state.day}天`:'旧版十二灯行程';}catch{oldLink.textContent='旧版十二灯行程';}const previousMode=stageMode,s=state(),work=route==='game'&&s&&journeyScreen(s,12)==='workshop'&&!sceneOverride;stageMode=route==='title'?'title':work?'workshop':'stage';root.firstElementChild?.setAttribute('data-screen',stageMode);root.firstElementChild?.setAttribute('data-chapter',s?String(getRunView(s).chapter.id):'1');
  show('v4-title',route==='title');show('v4-workshop',!!work);show('v4-stage',route==='game'&&!work&&!!s);show('v4-tools',true);show('v4-menu',route==='game');show('v4-book',route==='game');show('v4-settings',route==='game');
  button('v4-continue').hidden=!s;button('v4-continue').disabled=!snapshot.active;button('v4-start').disabled=!snapshot.active||snapshot.conflict||!['writer','memory'].includes(snapshot.mode)||snapshot.mode!=='memory'&&collection.pending||snapshot.mode!=='memory'&&snapshot.load?.main.status==='unavailable';text('v4-start',s?'另启一程':'启程');
  show('v4-title-challenge',collection.data.challenge);button('v4-title-challenge').disabled=button('v4-start').disabled||collection.pending||!!collection.problem;
  const problems=saveSummary();show('v4-save-banner',problems.length>0);text('v4-save-summary',problems.join(' · '));text('v4-save-open',problems.length?'保存详情 !':s?'进度已收好':'本机存档');
  if(work&&s){const selected=current();if(!selected||selected.finalizedDay!==null&&selected.finalizedDay<s.day)nextBlade();renderWorkshop(s);}else if(route==='game'&&s)renderStage(s);for(const node of root.querySelectorAll<HTMLButtonElement>('#v4-stage [data-economic]'))node.disabled=!canAct()||busy;if(route==='game'&&!modal&&!document.hidden){if(paused)notice=pauseNotice();else if(notice?.action==='resume')notice=null;}renderNotice();syncAudio();repaintProps();
  if(work&&previousMode!=='workshop')queueMicrotask(()=>{if(!disposed&&!modal&&!paused&&stageMode==='workshop'&&route==='game')button('v4-strike').focus({preventScroll:true});});
 }
 function toTitle(){cancelPresentation();epoch++;route='title';paused=false;stageKey='';if(modal)closeModal();render();button('v4-start').focus({preventScroll:true});}
 function continueGame(){if(!state())return;cancelPresentation();epoch++;route='game';paused=false;stageKey='';nextBlade();render();void audio.gesture();}
 function newInput(mode:V5NewGameInput['mode']='story'):V5NewGameInput{return{runId:crypto.randomUUID(),seed:seedDraft.trim()||`灯路-${crypto.randomUUID().slice(0,8)}`,mode};}
 function startNew(mode:V5NewGameInput['mode']='story'){
  if(disposed)return;
  if(mode==='challenge'&&(!collection.data.challenge||collection.pending||collection.problem)){resultError(collection.pending?'collection_pending':'challenge_locked');if(collection.pending||collection.problem)saveDetails();return;}
  const input=newInput(mode);const execute=(confirmed=false)=>{const r=port.startNewGame(input,{generation:snapshot.generation,confirmed});if(!r.ok){resultError(r.error);if(r.error==='collection_pending')saveDetails();return;}notice=null;continueGame();};
  const main=snapshot.load?.main;if(state()||main?.status==='invalid'||snapshot.load?.backup.status==='valid')confirm(mode==='challenge'?'带着炉谱，开启行脚挑战？':'另启一程？',`${mode==='challenge'?'挑战会重排章内委托，沿用相同锻造规则。':''}当前新经营行程会被替换，合法旧主档会保留为备份。旧版十二灯行程保持原样，可从旧入口续玩；先导出想保留的进度。${main?.status==='invalid'?' 当前损坏或较新版主档不会自动保留到备份，请先到保存详情导出磁盘局档原文。':''}`,()=>execute(true));else execute();
 }
 function settle(){
  const s=state();if(!s)return;const p=getRunView(s).settlement,body=element('div');
  body.append(element('p',p.complete?'今日主委托已完成。':p.protected?'护炉契这次只保住契印，不补回未完成的约定；本局护印机会随后用尽。':`尚未完成主委托，收工后契印为${p.sealsAfter}/3。`));
  if(isCriticalDay(s.day)&&!p.complete)body.append(element('p','今天是关键约定。现在收工会留下失约的缺口；之后补回契印或完成其他单，也补不上这一站，无法达成“十二灯复明”。'));
  if(p.sealsAfter===0)body.append(element('p','契印将归零，本局在这里停下；真实交付和成长留在这次行程，结束后可查看或导出。'));
  else if(s.day===12)body.append(element('p','这是最后一站；收工后按沿途关键约定、至少10项完成和剩余契印判定这次结局。'));
  else if(!p.complete)body.append(element('p',`仍可带着${p.sealsAfter}枚契印去下一天；这次失约会保留在灯路回顾里。`));
  body.append(element('p',`余下${p.remaining.length}柄共回收${fmt(p.recovered)}铜钱；今日收购剩余${fmt(getRunView(s).market.remaining)}。`));
  for(const row of p.recoveries){const blade=s.blades.find(b=>b.id===row.pieceId)!;body.append(element('p',`${RECIPES[blade.recipe].name} · 估值${fmt(blade.value)} → 回收${fmt(row.amount)}${row.amount===0?'（钱袋已空，仍会交出）':''}`));}
  const tomorrow=getRunView(s).next;if(tomorrow)body.append(element('h3',`明日：${tomorrow.commission.title}`),element('p',tomorrow.reserve?`留这柄${RECIPES[tomorrow.reserve.recipe].name}，明日一旧剑＋两新坯；${tomorrow.reserve.assessment.qualifies?'已合一柄要求':'还不合这张纸单，可返回调整'}。`:'没有留剑，明日三柄新坯。'),element('p','取下或处置旧剑后，不会额外补发第四柄。'));
  confirm('收好这一炉',body,()=>send({type:'settle'}));
 }
 function replaceTrait(trait:Trait,command:(old:Trait)=>Action,intro:HTMLElement|string,cancelLabel:string,costCopy='首赠免费，不交剑、不花铜钱。'){
  const s=state();if(!s)return;const body=element('div');body.append(typeof intro==='string'?element('p',intro):intro,element('h3',`新手艺 · ${TRAITS[trait].name}`),traitArt(trait),element('p',TRAITS[trait].text));
  const grid=element('div',undefined,'v4-choice-grid');for(const old of s.traits){const card=element('article',undefined,'v4-card');card.append(traitArt(old),element('h3',TRAITS[old].name),element('p',TRAITS[old].text),action(`换下${TRAITS[old].name}`,()=>confirm('确定换手艺？',`${costCopy} ${TRAITS[old].name}将离开行囊，换成${TRAITS[trait].name}。已经使用的本局护印不会恢复。`,()=>send(command(old)))));grid.append(card);}body.append(grid);openModal('行囊已满，换下哪一门？',body,[{label:cancelLabel,run:()=>closeModal()}],'replacement');
 }
 function giftModal(){
  const s=state();if(!s||!getRunView(s).gift.canClaim)return;
  const options=(['steady','ember']as const).filter(id=>!s.traits.includes(id));
  if(!options.length){confirm('赠礼折成旅费','两门赠礼手艺都已学会，领取40铜钱。',()=>send({type:'claimGift',traitId:null}));return;}
  const claim=(id:Trait)=>{const now=state();if(!now)return;if(now.traits.length===3)replaceTrait(id,old=>({type:'claimGift',traitId:id,replaceId:old}),'这是一份未领的首赠，换槽不交剑、不花铜钱，也不会重置本局已用护印。','稍后再领');else{closeModal();send({type:'claimGift',traitId:id});}};
  const body=element('div',undefined,'v4-choice-grid'),view=getRunView(s);for(const id of options){const purpose=traitPurpose(id,view),card=element('article',undefined,'v4-card');card.append(traitArt(id),element('h3',TRAITS[id].name),element('p',TRAITS[id].text),element('b',purpose.headline),element('p',purpose.copy),action(`学会${TRAITS[id].name}`,()=>claim(id),true));body.append(card);}openModal('第一门手艺，自己挑',body,[{label:'稍后再领',run:()=>closeModal()}],'gift');
 }
 function commissionDetails(pieceId=selectedId){
  const s=state();if(!s)return;const v=getRunView(s),model=commissionPaper(v,pieceId),piece=v.blades.find(p=>p.blade.id===pieceId),body=element('div');
  body.append(element('p',v.commission.progress.complete?v.commission.success:v.commission.request),element('p',model.summary));
  for(const route of model.routes){const row=element('section',undefined,'v4-commission-detail');row.append(element('h3',route.label),element('p',route.requirement),element('p',`${route.deliveredIds.length}/${route.required} 已交${route.inactive?' · 另一条已完成，无需再交':''}`));
   for(const id of route.deliveredIds){const b=s.blades.find(value=>value.id===id);if(b)row.append(thumb(b));}
   if(route.selected&&!model.complete)row.append(element('p',route.selected.matches?route.selected.copy:route.selected.missing.join('、')));body.append(row);
  }
  body.append(element('p',`今日酬劳${fmt(v.market.baseFee)}，已收${fmt(v.market.baseFeesPaid)}；行会收购钱袋还余${fmt(v.market.remaining)}。`));
  if(piece)body.append(element('h3','当前查看的这柄'),thumb(piece.blade),element('p',`${RECIPES[piece.blade.recipe].name} · 估值${fmt(piece.blade.value)}${piece.reserved?' · 挂在留剑架上':''}`));
  const choices:ModalAction[]=[{label:'回铁砧',run:()=>closeModal()}];
  if(piece?.willCommission&&!piece.reserved){const ticket={runId:s.runId,revision:s.revision,generation:snapshot.generation};choices.push({label:`交给${v.commission.name} · 实收${fmt(piece.quote.amount)}铜钱`,primary:true,disabled:!snapshot.active||snapshot.conflict||!['writer','memory'].includes(snapshot.mode)||paused,run:()=>{const valid=ticket.runId===state()?.runId&&ticket.revision===state()?.revision&&ticket.generation===snapshot.generation;closeModal();const now=state(),currentPiece=now?getRunView(now).blades.find(p=>p.blade.id===pieceId):null;if(valid&&currentPiece?.willCommission&&!currentPiece.reserved)send({type:'deliver',pieceId});else resultError('stale_session');}});}
  else body.append(element('p',piece?.reserved?'先从剑架取回，才能交付。':'不合委托的剑仍可明确卖给行会，出售不会点亮今天这一站。'));
  openModal(v.commission.name+'的心愿',body,choices,'commission');
 }
 function buyTrait(trait:Trait,pieceId=selectedId){
  const s=state(),b=s?.blades.find(piece=>piece.id===pieceId);if(!s||!b||b.status!=='active'||s.reserveId===b.id){setStatus('先从剑架选一柄未保留的剑。');return;}
  const eligibility=getRunView(s).blades.find(piece=>piece.blade.id===b.id)?.barter;if(!eligibility?.allowed){resultError(eligibility?.error??'blade_unworked');return;}
  const pay=b.id,purpose=tradePurpose(trait,getRunView(s),b.id),body=element('div');body.append(...tradeOption(getRunView(s),b.id).opportunity.map(copy=>element('p',copy)),thumb(b),element('p',`用这柄${RECIPES[b.recipe].name}（估值${fmt(b.value)}）换${TRAITS[trait].name}，不再兼作交付或留剑。`),element('b',purpose.headline),element('p',purpose.copy));
  if(s.traits.length===3)replaceTrait(trait,old=>({type:'buy',pieceId:pay,traitId:trait,replaceId:old}),body,'不换，保留剑',`交出这柄${RECIPES[b.recipe].name}（估值${fmt(b.value)}），不能再交差、卖钱或留给明日。`);else confirm('用剑换手艺',body,()=>send({type:'buy',pieceId:pay,traitId:trait}));
 }
 function journeyPanel(){
  const s=state();if(!s)return;const v=getRunView(s),partialRelay=v.commission.id===11&&!v.commission.progress.complete&&v.commission.progress.routes.some(r=>r.count>0),destination=partialRelay?11:s.day>=9?12:s.day>=5?8:4,outcome=journeyOutcome(s,destination),body=element('div',undefined,'v4-journey-review');
  body.append(element('p',CAMPAIGN_GOAL));
  const figure=element('figure'),image=element('img');auxiliaryArtwork.image(image,outcome.image,'/assets/d/forge-backdrop-v2.webp');image.alt=outcome.commission.title+' · '+(outcome.complete?'委托已完成':`实际交付 ${outcome.progressText}`);image.dataset.journeyScene='true';image.className='v4-partial-journey-image';figure.append(image,element('figcaption',`${outcome.commission.title} · ${outcome.complete?'已完成':outcome.progressText}`));body.append(figure);
  const works=element('div',undefined,'v4-journey-works');for(const b of outcome.matchedBlades){const card=element('div',undefined,'v4-journey-work');card.append(thumb(b),element('p',`${RECIPES[b.recipe].name} · 估值${fmt(b.value)} · 已交付`));works.append(card);}body.append(works);
  const lamps=element('ol',undefined,'v4-journey-lamps');
  for(let day=1;day<=12;day++){
   const c=COMMISSIONS[s.commissionOrder[day-1]!-1]!,record=s.history.find(h=>h.day===day),today=day===s.day,line=element('li');
   line.dataset.day=String(day);line.dataset.result=record?record.met?'met':'missed':today?'current':'future';
   line.append(element('b',`第${day}天 · ${c.title}`),element('span',record?record.met?'已经履约':'留下遗憾':today?v.commission.progress.complete?'今日委托已完成':v.commission.progress.routes.map(r=>`${r.count}/${r.required}`).join(' 或 '):'尚未抵达'));
   if(day<=s.day){const result=journeyOutcome(s,c.id),detail=element('details',undefined,'v4-journey-deliveries');detail.dataset.commission=String(c.id);detail.append(element('summary','查看这一站的交剑'),...result.routes.map(r=>element('p',`${r.description} · 已交 ${r.count}/${r.required}`)));for(const b of result.matchedBlades){const work=element('div',undefined,'v4-journey-work');work.dataset.piece=b.id;work.append(thumb(b),element('p',`${RECIPES[b.recipe].name} · ${fmt(b.value)} · ${result.pieceIds.includes(b.id)?'本次完成收据':result.complete?'此前另有匹配交付':'已经交付，尚未凑齐'}`));detail.append(work);}if(!result.matchedBlades.length)detail.append(element('p','没有计入这站委托的交付。'));line.append(detail);}
   lamps.append(line);
  }
  body.append(lamps);
  if(s.day>=3)body.append(element('h3','阿禾捎来的第一封信'),element('p',CHAPTERS[0]!.letter));
  if(s.day>=7)body.append(element('h3','阿禾的雪中来信'),element('p',CHAPTERS[1]!.letter));
  if(s.day>=11)body.append(element('h3','山口送来的最后一封信'),element('p',CHAPTERS[2]!.letter));
  if(v.next&&s.day<12){body.append(element('h3',`下一天 · ${v.next.commission.title}`),element('p',v.next.commission.request),element('p',`明日${v.next.oldCount}柄旧剑＋${v.next.newCount}柄新坯，共${v.next.totalCount}柄；新坯底价${fmt(v.next.normalBase)}，首柄实际${fmt(v.next.firstBase)}。取下旧剑不补发。`));if(v.next.reserve){const b=s.blades.find(b=>b.id===v.next!.reserve!.id);if(b)body.append(thumb(b),element('p',`留剑届时估值${fmt(v.next.reserve.value)} · ${v.next.reserve.cracked?'仍带裂纹':'无裂纹'} · 锤势${v.next.reserve.charge}/6`));}}
  if(s.modifications.length)body.append(element('h3','已经装好的炉具'),...s.modifications.map(id=>element('p',`${MODIFICATIONS[id].name} · ${MODIFICATIONS[id].text}`)));
  openModal(`灯路回顾 · ${v.chapter.title}`,body,[{label:'回铁砧',primary:true,run:()=>closeModal()}],'journey');
 }
 function tomorrowPlan(preferredPieceId=state()?.reserveId??selectedId){
  const s=state();if(!s)return;const view=getRunView(s),plan=nextDayPlan(view),body=element('div',undefined,'v5-carry-plan');
  body.append(element('p',plan.headline));
  if(!view.next){body.append(element('p',plan.copy));openModal('最后一炉的打算',body,[{label:'回炉边，自己拿主意',primary:true,run:()=>closeModal()}],'tomorrow');return;}
  const next=view.next,requirements=element('details');requirements.append(element('summary',`第${next.day}天 · ${next.commission.title} · 查看完整纸单`),element('p',next.commission.request),...plan.routes.map(route=>element('p',route.description)));body.append(requirements);
  const tray=element('div',undefined,'v5-carry-choices'),preview=element('div',undefined,'v5-carry-preview'),ticket={runId:s.runId,revision:s.revision,generation:snapshot.generation};
  let picked=view.blades.some(item=>item.blade.id===preferredPieceId)?preferredPieceId:null;
  const selectors=new Map<string,HTMLButtonElement>();
  const valid=()=>ticket.runId===state()?.runId&&ticket.revision===state()?.revision&&ticket.generation===snapshot.generation;
  const draw=()=>{
   tray.querySelector('[data-carry-none]')?.setAttribute('aria-pressed',String(picked===null));
   for(const[id,node]of selectors)node.setAttribute('aria-pressed',String(id===picked));
   preview.replaceChildren();const carry=picked?carryOption(view,picked,s.journal.length>=JOURNAL_SOFT_LIMIT):null;
   const slots=element('div',undefined,'v5-packing-slots');
   if(carry){const kept=element('div');kept.append(thumb(carry.blade),element('b',`${RECIPES[carry.blade.recipe].name} · 旧剑`),element('span',`${fmt(carry.valueNow)} → ${fmt(carry.valueNext)}`));slots.append(kept);}
   for(let i=0;i<(carry?2:3);i++){const fresh=element('div',undefined,'v5-new-blank');fresh.append(element('b','新坯'),element('span',`底价 ${fmt(i===0?next.firstBase:next.normalBase)}`));slots.append(fresh);}
   preview.append(element('h3',carry?'一柄旧剑 ＋ 两柄新坯':'三柄新坯'),slots,element('p',carry?carry.copy:'不挂留剑，明日领三柄新坯。取下或处置旧剑后也不会补第四柄。'));
   if(carry)preview.append(element('p',carry.matching?'按确定的次日估值，已经合一柄要求；启程后仍需实际交剑。':`明日尚缺：${carry.missing.join('；')}`));
   const commit=root.querySelector<HTMLButtonElement>('#v5-pack-confirm');
   if(commit){commit.hidden=carry?carry.id===s.reserveId:!s.reserveId;commit.textContent=carry?(s.reserveId?'换这柄装箱':'把这柄装箱'):'取下旧剑，改领三新坯';commit.disabled=!!carry&&!carry.canReserve||!snapshot.active||snapshot.conflict||!['writer','memory'].includes(snapshot.mode);}
   if(carry?.id===s.reserveId)preview.append(element('p','这柄已挂架。返回炉边可取回，明日新坯仍共两柄。'));
   repaintProps();
  };
  const none=action('不带旧剑',()=>{picked=null;draw();});none.dataset.carryNone='true';tray.append(none);
  for(const item of view.blades){const b=item.blade,node=action(`${RECIPES[b.recipe].name} · ${fmt(b.value)}${item.reserved?' · 已挂架':''}`,()=>{picked=b.id;draw();});node.dataset.carryPiece=b.id;node.prepend(thumb(b));selectors.set(b.id,node);tray.append(node);}
  if(!view.blades.length)body.append(element('p','今日兵器已安排完，明日领三柄新坯。'));
  body.append(tray,preview);openModal(`明日装箱 · 第${plan.day}天`,body,[{label:'回炉边，自己拿主意',run:()=>closeModal()},{label:'把这柄装箱',id:'v5-pack-confirm',primary:true,run:()=>{if(!valid()){closeModal();resultError('stale_session');return;}const carry=picked?carryOption(view,picked,s.journal.length>=JOURNAL_SOFT_LIMIT):null;closeModal();if(carry?.canReserve)reserveBlade(carry.id);else if(!carry&&s.reserveId)send({type:'reserve',pieceId:s.reserveId});}}],'tomorrow');draw();
 }
 function shop(preferredPieceId=selectedId){
  const s=state();if(!s)return;const view=getRunView(s);if(!view.merchant)return;
  const controls={upgraded:s.upgraded,repaired:s.repaired,recordLimited:s.journal.length>=JOURNAL_SOFT_LIMIT};
  const ticket={runId:s.runId,revision:s.revision,generation:snapshot.generation};
  const valid=()=>ticket.runId===state()?.runId&&ticket.revision===state()?.revision&&ticket.generation===snapshot.generation;
  const body=createMarketStall(view,{selectedPieceId:preferredPieceId,thumb,action,growthControls:controls,
   buy:(traitId,pieceId)=>{if(!valid()){resultError('stale_session');return;}buyTrait(traitId,pieceId);},
   upgrade:()=>{if(!valid()){resultError('stale_session');return;}const quote=cashOptions(view,controls).upgrade;confirm('为下一炉备料',`${quote.currentBase} → ${quote.afterBase}。${quote.copy}`,()=>send({type:'upgrade'}));},
   repair:()=>{if(!valid()){resultError('stale_session');return;}const quote=cashOptions(view,controls).repair;confirm('修补契印',`${quote.sealsBefore}/3 → ${quote.sealsAfter}/3。${quote.copy}`,()=>send({type:'repair'}));},
  });openModal('行脚商人的炉边摊',body,[{label:'回铁砧',run:()=>closeModal()}],'shop');
 }
 function arrangeBlade(){
  const s=state(),b=current();if(!s||!b)return;const v=getRunView(s),item=v.blades.find(p=>p.blade.id===b.id);if(!item)return;
  const body=element('div',undefined,'v5-arrange');body.append(thumb(b),element('h3',`${RECIPES[b.recipe].name} · 估值${fmt(b.value)}`),element('p',`今日收购钱袋${fmt(v.market.remaining)}/${fmt(v.market.budget)}铜钱。作品再贵，也只按剩余钱袋付款；主委托基础酬劳独立。`));
  const options:ModalAction[]=[{label:'先留在铁砧',run:()=>closeModal()}],ticket={runId:s.runId,revision:s.revision,generation:snapshot.generation};
  const use=(run:()=>void)=>{const valid=ticket.runId===state()?.runId&&ticket.revision===state()?.revision&&ticket.generation===snapshot.generation;closeModal();if(valid)run();else resultError('stale_session');};
  if(v.next&&!item.reserved){const carry=carryOption(v,b.id,s.journal.length>=JOURNAL_SOFT_LIMIT);if(carry)body.append(element('p',carry.copy));options.push({label:'看看明日装箱',run:()=>use(()=>tomorrowPlan(b.id))});}
  if(v.merchant){body.append(element('p',item.barter.allowed?'这柄已成器，可以献剑换手艺；不消耗收购钱袋。':'献剑换手艺需等级至少3；挂架的剑要先取回。'));options.push({label:'去炉边摊比较',run:()=>use(()=>shop(b.id))});}
  if(!item.reserved)options.push({label:`回收这柄 · 实得${fmt(item.recovery)}`,run:()=>use(()=>recycleBlade(b.id))});
  body.append(element('p','收工也会回收未挂架的余剑。回收为0时仍会交出剑；取消后仍可继续打造。'));
  openModal('钱袋封口了，安排这柄剑',body,options,'arrange');
 }
 function recycleBlade(pieceId=selectedId){
  const s=state(),b=s?.blades.find(piece=>piece.id===pieceId);if(!s||!b)return;const item=getRunView(s).blades.find(piece=>piece.blade.id===b.id);if(!item||item.reserved)return;
  confirm('回收这柄剑？',`这柄当前回收实得${fmt(item.recovery)}铜钱，受今日收购钱袋限制；回收后交出兵器，不计主委托，也不能再锻。`,()=>send({type:'scrap',pieceId:b.id}));
 }
 function eventModal(){
  const s=state();if(!s)return;const view=getRunView(s),sourceEvent=view.event;if(!sourceEvent||sourceEvent.status!=='available')return;
  const newBlankText=(copy:string)=>(sourceEvent.id==='loan'||sourceEvent.id==='shelter')?copy.replace(/(明天|明日)第一柄(?!新坯)/g,'$1第一柄新坯'):copy;
  const v={...sourceEvent,request:newBlankText(sourceEvent.request),result:newBlankText(sourceEvent.result)};
  const body=element('div');body.append(prop(v.id),element('p',v.request),element('p',`接受后：${v.result}`));
  const choices:ModalAction[]=[{label:'暂不决定',run:()=>closeModal()},{label:'拒绝，保留眼前资源',run:()=>{closeModal();send({type:'chooseEvent',choice:'decline'});}}];
  const accept=(pieceId?:string)=>{
   const q=eventQuote(s,pieceId);if(!q.allowed){setStatus('当前对象或铜钱不满足这次选择。');return;}
   const b=pieceId?s.blades.find(blade=>blade.id===pieceId):null,copy=element('div');
   if(b)copy.append(thumb(b),element('p',`所选${RECIPES[b.recipe].name}估值${fmt(b.value)}。交出后不再兼作交付或留剑。`));
   copy.append(element('p',v.result+(q.cost?` 支付${fmt(q.cost)}铜钱。`:'')));
   if(v.id==='salvage'&&view.next?.commission.routes.some(route=>route.age==='old'))copy.append(element('p','明天的纸单含旧剑路线；换出后需另备留剑，或采用纸单上的其他路线。'));
   confirm(v.name,copy,()=>send({type:'chooseEvent',choice:'accept',...(pieceId?{pieceId}:{})}));
  };
  if(v.piece!=='none'){
   const grid=element('div',undefined,'v4-choice-grid'),candidates=s.blades.filter(b=>b.status==='active'&&(v.piece==='reserve'?s.reserveId===b.id:s.reserveId!==b.id));
   for(const b of candidates){const card=element('div',undefined,'v4-card');card.dataset.eventPiece=b.id;card.append(thumb(b),element('p',`${b.suppliedDay<s.day?'此前留下':'今日来料'} · ${b.cracked?'已有裂纹':'完好'} · 锤势${b.charge}/6`),action(`选这柄 · ${RECIPES[b.recipe].name} ${fmt(b.value)}`,()=>accept(b.id)));grid.append(card);}
   if(!candidates.length){
    const spare=s.blades.some(b=>b.status==='active'&&b.id!==s.reserveId);
    if(v.piece==='reserve'&&spare){
     grid.append(element('p','剑架上还没有剑。可以先回铁砧选一柄愿意换出的余剑，点“留给明天”挂上剑架，再回来交换；今日铁坯也可以挂上。不想换时可拒绝。'));
     choices.unshift({label:'回铁砧选剑挂上',primary:true,run:()=>{
      closeModal();queueMicrotask(()=>{if(disposed||modal||route!=='game'||state()?.phase!=='workshop'||!canAct())return;
       const target=current()?.status==='active'&&!button('v4-reserve').disabled?button('v4-reserve'):find('v4-inventory').querySelector<HTMLButtonElement>('button:not(:disabled)');
       target?.focus({preventScroll:true});setStatus('选一柄余剑，点“留给明天”挂上剑架，再回旧刃回收确认交换。');
      });
     }});
    }else grid.append(element('p',v.piece==='reserve'?'剑架和铁砧上都没有可换出的剑，可以拒绝这次交换。':'没有可交出的余剑，可以拒绝这次邀请。'));
   }
   body.append(grid);
  }else{
   const q=eventQuote(s);body.append(action(q.cost?`接受 · ${fmt(q.cost)}铜钱`:'接受这次选择',()=>accept(),true,!q.allowed));
   if(!q.allowed)body.append(element('p',q.error==='already_owned'?'已有尚未消耗的保价资格。':'铜钱不足，可以保留当前资源。'));
  }
  openModal(v.name,body,choices,'event');
 }
 function book(){const body=collectionBook(collection.data,{pending:collection.pending,problem:!!collection.problem,canStart:!button('v4-start').disabled,thumb,action,viewWork,challenge:()=>startNew('challenge')});openModal('炉谱 · 带得走的手艺',body,[{label:'收好炉谱',run:()=>closeModal()},{label:'旧炉谱主册导入',run:()=>legacyImport('main')},{label:'查看旧备份炉谱',run:()=>legacyImport('backup')},{label:'导出炉谱',run:exportCollection}],'collection');}
 function legacyImport(source:'main'|'backup'){
  if(modal)closeModal();
  const result=port.previewLegacyImport(source);
  if(!result.ok){resultError(result.error);openModal('这份旧炉谱暂未读到','旧原件仍保留，可以选择另一份来源。',[{label:'回炉谱',run:book},{label:source==='main'?'查看旧备份':'查看旧主册',run:()=>legacyImport(source==='main'?'backup':'main')}],'legacy-unavailable');return;}
  const shown=result.preview,body=element('div',undefined,'v5-import-preview');
  body.append(element('p',`来源：旧炉谱${shown.source==='main'?'主册':'备份'} · ${new Date(shown.savedAt).toLocaleString('zh-CN')}`),element('h3',`将带回${shown.collection.chapters.length}章见闻、${shown.collection.works.length}件作品`),element('p',`合并后炉谱保留${shown.merged.works.length}/12件最佳作品${shown.merged.challenge?'，行脚挑战已解锁':''}。同一委托只留较高估值，旧作品仍标记旧行程来源。`),element('p','这里只合并解锁与作品，不带入旧铜钱、契印、来料升级或局内兵器；当前行程的开局资格保持，下一次启程才使用已保存的新资格。'));
  const sourceEligibility=collectionEligibility(shown.collection),mergedEligibility=collectionEligibility(shown.merged),unlocks=element('section',undefined,'v5-import-unlocks');
  unlocks.append(element('h3','这份旧册的具体解锁'),element('p','章节：'+(shown.collection.chapters.map(id=>CHAPTERS[id-1]!.title).join('；')||'尚无')),element('p','按此册可用配方：'+sourceEligibility.recipes.map(id=>RECIPES[id].name).join('、')),element('p','配方熟练：'+(shown.collection.mastery.map(id=>RECIPES[id].name).join('、')||'尚无')),element('p','手艺见闻：'+(shown.collection.traits.map(id=>TRAITS[id].name).join('、')||'尚无')),element('p',`这份旧册的行脚挑战：${shown.collection.challenge?'已解锁':'未解锁'}`),element('p',`合并后可用配方：${mergedEligibility.recipes.map(id=>RECIPES[id].name).join('、')}；行脚挑战${mergedEligibility.challenge?'已解锁':'未解锁'}。`));body.append(unlocks);
  const works=element('details');works.append(element('summary','逐件看看将导入的作品'));
  for(const work of shown.collection.works){const row=element('section',undefined,'v4-commission-detail');row.append(element('h3',`${work.commissionId}. ${COMMISSIONS[work.commissionId-1]!.title}`),element('p','旧行程作品 · '+work.blades.map(b=>`${RECIPES[b.recipe].name} 估值${fmt(b.value)}`).join(' / ')));for(const b of work.blades)row.append(thumb(b));works.append(row);}body.append(works);
  const choices:ModalAction[]=[{label:'暂不导入',run:()=>closeModal()},{label:'确认导入这份炉谱',primary:true,disabled:!collection.writable,run:()=>{
   const accepted=port.importLegacyCollection({generation:shown.generation,confirmed:true,previewId:shown.id});
   closeModal();
   if(accepted.ok){setStatus('这份旧炉谱已合入。当前局保持原样，下次启程使用新资格。');book();}
   else if(accepted.error==='legacy_changed'||accepted.error==='stale_session'){setStatus(ERRORS.legacy_changed!);openModal('旧炉谱已更新，请再看一次','刚才显示的来源或当前行程已变化，没有导入未展示的新内容。',[{label:'回炉谱',run:book},{label:'重新预览',primary:true,run:()=>legacyImport(source)}],'legacy-changed');}
   else{resultError(accepted.error);saveDetails();}
  }}];
  if(!collection.writable)body.append(element('p',snapshot.dirty?'请先保存当前行程，再确认导入。':'当前不能持久导入，可在保存详情中取得保存权；不保存模式仍可查看。','v4-collection-warning'));
  openModal('把旧炉谱带上路',body,choices,'legacy-import');
 }
 function viewWork(id:number){const work=collection.data.works.find(w=>w.commissionId===id);if(!work){book();return;}openModal(COMMISSIONS[id-1]!.title+' · 留名作品',collectionWorkPage(work,thumb,auxiliaryArtwork.image),[{label:'回到炉谱',run:book},{label:'收好作品',run:()=>closeModal()}],'collection-work');}
 function paymentDetails(){
  const s=state();if(!s)return;const copy=workshopPaymentCopy(getRunView(s),current()?.id??null),body=element('div',undefined,'v5-payment-detail');
  body.append(element('h3',copy.quote.breakdown),element('p',copy.quote.explanation),element('p',copy.orderPay),element('p',copy.orderExplanation));
  for(const line of copy.quote.details)body.append(element('p',line));
  openModal('估值与这次收款',body,[{label:'明白了，回炉边',run:()=>closeModal()}],'payment');
 }
 function settings(){
  const body=element('div'),muted=element('input'),volume=element('input'),less=element('input');
  muted.type='checkbox';muted.checked=prefs.value.muted;volume.type='range';volume.min='0';volume.max='100';volume.value=String(prefs.value.volume);less.type='checkbox';less.checked=prefs.value.reducedMotion;
  for(const [label,control]of [['静音',muted],['敲击音量',volume],['减弱动效',less]]as const){const row=element('label',undefined,'v4-setting-row');row.append(element('span',label),control);body.append(row);}
  muted.onchange=()=>preferences.update({muted:muted.checked});volume.oninput=()=>preferences.update({volume:Number(volume.value)});less.onchange=()=>preferences.update({reducedMotion:less.checked});
  const status=element('p');status.id='v4-preference-status';
  const sound=element('p');sound.id='v4-audio-status';sound.setAttribute('role','status');
  const art=element('section');art.id='v4-art-status';art.hidden=true;
  const artCopy=element('p');artCopy.id='v4-art-copy';artCopy.setAttribute('role','status');const retry=action('重试画稿',retryArtwork);retry.id='v4-art-retry';art.append(artCopy,retry);
  body.append(status,sound,action('试听敲击声',()=>{audio.silence();audio.setMode('preview');void audio.preview();}),art);
  openModal('声音与动效',body,[{label:'保存失败时重试',run:()=>{preferences.retry();updatePreferenceStatus();}},{label:'收好',primary:true,run:()=>closeModal()}],'settings');
  updatePreferenceStatus();updateAudioStatus();updateArtworkStatus();
 }
 function updatePreferenceStatus(){const node=root.querySelector('#v4-preference-status');if(node)node.textContent=prefs.problem?'设置尚未保存，可重试；不会回滚游戏进度。':`设置已保留${motion.matches?' · 系统减弱动效已启用':''}`;}
 function saveDetails(message?:string){const body=element('div',undefined,'v4-summary-list'),s=state(),run=snapshot.load,c=collection.load;
  if(message){const warning=element('p',message);warning.id='v5-recovery-status';warning.setAttribute('role','alert');body.append(warning);}
  // Recovery confirms the exact disk source displayed here, including backup-only changes.
  const readSource=(key:string)=>{try{return{ok:true as const,raw:localStorage.getItem(key)};}catch{return{ok:false as const};}};
  const runSource=readSource(V5_BACKUP_KEY),bookSource=readSource(COLLECTION_BACKUP_KEY);
  const runBackup=runSource.ok?decodeV5Save(runSource.raw):null,bookBackup=bookSource.ok?decodeCollection(bookSource.raw):null;
  const sourceUnchanged=(key:string,shown:string|null)=>{const latest=readSource(key);if(latest.ok&&latest.raw===shown)return true;saveDetails('备份已变化或暂不可读取。请核对现有来源后，再决定恢复。');return false;};
  body.append(element('h3','当前行程'),element('p',saveSummary().join(' · ')||'这里可以查看本机行程与炉谱。'));if(run?.main.status==='valid')body.append(element('p',`主档：第${run.main.state.day}天 · ${fmt(run.main.state.coins)}铜钱 · ${new Date(run.main.savedAt).toLocaleString('zh-CN')}`));
  const writer=snapshot.active&&snapshot.mode==='writer';
  body.append(action('重试保存本局',()=>{const r=port.retrySave(snapshot.generation);if(!r.ok)resultError(r.error);else setStatus('本局已保存。');closeModal();saveDetails();},false,!writer||snapshot.conflict||!s),action('重试保存炉谱',()=>{const r=port.retryCollection(snapshot.generation);if(!r.ok)resultError(r.error);else setStatus('炉谱已保存。');closeModal();saveDetails();},false,!writer));
  body.append(action('重新取得保存权 / 读取最新',()=>confirm('读取磁盘上的最新行程',snapshot.dirty?'尚未保存的本局会被磁盘进度替换，请先导出。':'将重新取得保存权并读取磁盘的最新行程。',()=>{void (async()=>{await port.activate();if(disposed)return;const snap=port.getSnapshot();if(snap.mode==='writer'&&snap.load?.main.status==='valid'){const r=port.resume({generation:snap.generation,confirmed:true});if(!r.ok)resultError(r.error);}render();})();})),action('导出当前行程',exportRun,false,!s),action('导出炉谱和原文',exportCollection));
  const rawStatus=element('p','主档损坏或暂不识别时，也可先导出磁盘上的主档与备份原文，再决定恢复或重开。');rawStatus.id='v5-raw-export-status';rawStatus.setAttribute('role','status');
  const rawButton=action('导出磁盘局档原文（主档与备份）',exportRawRun);rawButton.id='v5-export-raw-run';body.append(rawButton,rawStatus);
  if(runBackup?.status==='valid'&&runSource.ok){const b=runBackup,shown=runSource.raw;body.append(element('p',`局备份：第${b.state.day}天 · ${fmt(b.state.coins)}铜钱 · 保存于${new Date(b.savedAt).toLocaleString('zh-CN')}`),action('恢复这份局备份',()=>confirm('恢复局备份',`将用第${b.state.day}天、保存于${new Date(b.savedAt).toLocaleString('zh-CN')}的备份替换当前主档（损坏或本版暂不识别）；原主档原文不会自动备份，可先取消并导出磁盘局档原文。`,()=>{if(!sourceUnchanged(V5_BACKUP_KEY,shown))return;const r=port.recoverBackup({generation:snapshot.generation,confirmed:true});if(!r.ok)resultError(r.error);else continueGame();}),false,!writer||run?.main.status==='valid'));}
  if(bookBackup?.status==='valid'&&bookSource.ok){const b=bookBackup,shown=bookSource.raw;body.append(element('p',`炉谱备份：${b.state.works.length}件作品 · 保存于${new Date(b.savedAt).toLocaleString('zh-CN')}`),action('恢复这份炉谱备份',()=>confirm('恢复炉谱备份',`用${b.state.works.length}件作品的合法备份替换当前损坏或不兼容炉谱，并合并已知合法成果。建议先导出原文。`,()=>{if(!sourceUnchanged(COLLECTION_BACKUP_KEY,shown))return;const r=port.recoverCollectionBackup({generation:snapshot.generation,confirmed:true});if(!r.ok)resultError(r.error);else setStatus('炉谱备份已恢复。');}),false,!writer||c?.main.status==='valid'||snapshot.dirty||snapshot.conflict));}
  body.append(element('h3','不保存试玩'),element('p','当前磁盘进度保持原样。明确转为不保存后，关闭/刷新会失去本次内存试玩，请先导出。'),action(s?'保留当前局，不保存续玩':'不保存，开一炉试玩',()=>confirm('本次不保存',s?'保留当前局继续，之后关闭页面会失去未写入磁盘的部分。':'开始临时主线，不写正式局档或炉谱。',()=>{const r=port.useMemory(s?null:newInput(),{generation:snapshot.generation,confirmed:true});if(!r.ok)resultError(r.error);else continueGame();})),action('不保存，另开一炉',()=>confirm('另开临时旅程','当前内存进度会被临时新局替换，磁盘原档仍保留；请先导出。',()=>{const r=port.useMemory(newInput(),{generation:snapshot.generation,confirmed:true});if(!r.ok)resultError(r.error);else continueGame();})));
  openModal('把行程收好',body,[{label:'回到当前页面',primary:true,run:()=>closeModal()}],'save');
 }
 function pause(){paused=true;cancelPresentation();openModal('炉火为你留着','暂停时不会落锤或消耗资源。',[{label:'继续锻造',primary:true,run:()=>closeModal()},{label:'灯路回顾',run:journeyPanel,id:'v4-journey-open'},{label:'回标题',run:toTitle},{label:'看看保存状态',run:()=>saveDetails()}],'pause');}
 function forgeIdentity():InputIdentity|null {const s=state(),b=current();if(!s||!b||!canAct()||busy||handoff?.isDragging()||stageMode!=='workshop'||!getRunView(s).blades.find(p=>p.blade.id===b.id)?.canStrike)return null;return{runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId:b.id,mode:'standard',periodMs:1,rulesVersion:s.rulesVersion};}
 function navigationIdentity():InputIdentity|null {const s=state();if(!s||!canAct()||busy||handoff?.isDragging()||stageMode!=='workshop'||forgeIdentity())return null;return{runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId:'navigation',mode:'standard',periodMs:1,rulesVersion:s.rulesVersion};}
 renderer=createForgeRenderer(root,{reduced,valueLabel:'估值',cue:cue=>audio.acceptedCue(cue),ready:()=>{render();repaintProps();updateArtworkStatus();},problem:artworkProblem,contact:contactReadout});
 if(focused)craftMoment=createCraftMoment(root,reduced);
 feedback=createWorkbenchFeedback(root,{reduced,paintBlade:(canvas,blade)=>renderer?.paintThumb(canvas,blade)});
 paper=createCommissionPaper(root,{thumb:id=>{const b=state()?.blades.find(piece=>piece.id===id);return b?thumb(b):null;}});
 handoff=createHandoff(root,{capture:pieceId=>{const s=state();if(!s)return null;const token={runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId};return handoffBlade(token)?token:null;},preview:handoffPreview,commit:commitHandoff});
 input=bindDirectStrikeInput([button('v4-hit'),button('v4-strike')],{context:forgeIdentity,navigationContext:navigationIdentity,navigate:()=>{const b=current();if(b&&state()?.reserveId===b.id){setStatus(state()?.day===12?'先从剑架取回安排交付、出售或回收；本局剑架不会带入新局。':'先从剑架取回，或选择收工把它留给明天。');button('v4-reserve').focus({preventScroll:true});}else settle();},commit:(captured,point)=>{if(!sameInput(captured,forgeIdentity()))return;lastPoint=point;void audio.gesture();send({type:'strike',pieceId:captured.pieceId});},aim:p=>{if(canAct()&&!busy&&!handoff?.isDragging())renderer?.aim(p);},preparing:v=>renderer?.preparing(v)});
 button('v4-start').onclick=()=>startNew();button('v4-title-challenge').onclick=()=>startNew('challenge');button('v4-continue').onclick=continueGame;find<HTMLInputElement>('v4-seed').value=seedDraft;find<HTMLInputElement>('v4-seed').oninput=e=>{seedDraft=(e.currentTarget as HTMLInputElement).value;};
 for(const id of['v4-title-collection','v4-book'])button(id).onclick=book;for(const id of['v4-title-settings','v4-settings'])button(id).onclick=settings;button('v5-delivery-quote').onclick=paymentDetails;
 for(const id of['v4-save-open','v4-save-details'])button(id).onclick=()=>saveDetails();button('v4-menu').onclick=()=>route==='title'?continueGame():pause();button('v4-shop').onclick=()=>shop();button('v4-event-open').onclick=eventModal;
 button('v4-customer-open').onclick=()=>commissionDetails();
 button('v4-deliver').onclick=()=>{const b=current();if(b)send({type:'deliver',pieceId:b.id});};button('v4-reserve').onclick=()=>{const b=current();if(b)reserveBlade(b.id);};button('v4-scrap').onclick=()=>recycleBlade();button('v4-settle').onclick=settle;button('v4-next-plan').onclick=()=>tomorrowPlan();button('v5-arrange').onclick=arrangeBlade;
 button('v4-inline-review').onclick=()=>{const s=state(),receipt=inlineDelivery;if(!s||!receipt)return;if(s.gift==='available'){giftModal();return;}presentScene({kind:'delivery',revision:s.revision,commissionId:receipt.commissionId,pieceIds:receipt.pieceIds});render();};
 button('v4-inline-dismiss').onclick=()=>{inlineDelivery=null;show('v4-inline-delivery',false);};
 button('v4-notice-dismiss').onclick=()=>{notice=null;renderNotice();};button('v4-notice-action').onclick=()=>{
  const message=notice;if(!message||!noticeSubjectCurrent()){notice=null;renderNotice();return;}
  if(message.action==='resume'){paused=false;notice=null;render();}
  else if(message.action==='gift')giftModal();else if(message.action==='settle')settle();
  else if(message.action==='next'){if(!canAct()||busy)return;cancelPresentation(false);epoch++;notice=null;nextBlade();render();button('v4-strike').focus({preventScroll:true});}
  else if(message.action==='deliver'){const s=state(),pieceId=message.subject?.pieceId,piece=s?getRunView(s).blades.find(p=>p.blade.id===pieceId):null;if(pieceId&&piece?.willCommission&&!piece.reserved)send({type:'deliver',pieceId});else{notice=null;renderNotice();setStatus('这柄的状态已变化，请重新查看纸单。');}}
  else if(message.action==='inspect')commissionDetails(message.subject?.pieceId);
  else if(message.action==='book')book();else if(message.action==='shop')shop();else if(message.action==='journey')journeyPanel();
 };
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
 const onVisibility=()=>{if(document.hidden){cancelPresentation();epoch++;paused=route==='game';if(modal)closeModal(false);audio.setMode('silent');}else{if(paused)notice=pauseNotice();render();}};
 const onKey=(e:KeyboardEvent)=>{if(e.repeat&&(e.key==='Enter'||e.code==='Space')){e.preventDefault();return;}if(e.key==='Escape'&&!modal&&route==='game'){e.preventDefault();pause();}};
 const onGesture=(event:Event)=>{root.firstElementChild?.setAttribute('data-input-mode',event.type==='pointerdown'?'pointer':'keyboard');if(route==='game'&&!modal)void audio.gesture();};
 const onSettingsStorage=(e:StorageEvent)=>{if(e.key===SETTINGS_KEY||e.key===null)preferences.reload();};
 const onMotion=()=>{cancelPresentation(false);epoch++;render();updatePreferenceStatus();};
 const onBlur=()=>{cancelPresentation(false);epoch++;if(modalKind==='legacy-import'){port.cancelLegacyImport();closeModal(false);setStatus('旧炉谱预览已收起，导入前请重新查看。');}render();};
 document.addEventListener('visibilitychange',onVisibility);root.addEventListener('keydown',onKey);root.addEventListener('pointerdown',onGesture,{capture:true});root.addEventListener('keydown',onGesture,{capture:true});window.addEventListener('storage',onSettingsStorage);window.addEventListener('blur',onBlur);motion.addEventListener('change',onMotion);
 const stopPrefs=preferences.subscribe(value=>{const changed=value.value.reducedMotion!==prefs.value.reducedMotion;prefs=value;if(changed){cancelPresentation(false);epoch++;}render();updatePreferenceStatus();});
 const stopRun=port.subscribe(value=>{const changed=value.generation!==snapshot.generation||value.state?.runId!==snapshot.state?.runId;snapshot=value;if(changed){cancelPresentation();notice=null;epoch++;stageKey='';inventoryKey='';recipeKey='';beltKey='';if(modal)closeModal();if(!current())nextBlade();}collection=port.getCollectionSnapshot();render();});
 const stopBook=port.subscribeCollection(value=>{collection=value;render();});
 const stopAudio=audio.subscribe(updateAudioStatus);
 render();void port.activate();
 return{async dispose(){if(disposed)return;disposed=true;cancelPresentation();stopRun();stopBook();stopPrefs();stopAudio();auxiliaryArtwork.dispose();stageAssetGeneration++;stageArtwork.onload=null;stageArtwork.onerror=null;input?.dispose();handoff?.dispose();feedback?.dispose();craftMoment?.dispose();paper?.dispose();renderer?.dispose();motion.removeEventListener('change',onMotion);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('storage',onSettingsStorage);window.removeEventListener('blur',onBlur);root.removeEventListener('keydown',onKey);root.removeEventListener('pointerdown',onGesture,{capture:true});root.removeEventListener('keydown',onGesture,{capture:true});await Promise.allSettled([port.dispose(),audio.dispose()]);if(root.firstElementChild===ownRoot)root.replaceChildren();}};
}
