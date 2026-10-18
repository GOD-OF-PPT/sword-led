import type { V2Session } from '../application/v2-persistence.js';
import { V2_SAVE_KEY } from '../application/v2-persistence.js';
import { SAVE_KEY } from '../platform/storage.js';
import { bindStrikeInput } from '../platform/input.js';
import { createPreferences } from '../platform/settings.js';
import { createForgeAudio } from '../platform/audio.js';
import type { Cue } from '../platform/audio.js';
import { getCollection, getRunView, getTrial, getCustomerVisits } from '../core-v2/index.js';
import type { Action, HammerMode, RunState, Workpiece } from '../core-v2/index.js';
import { HAMMERS, marketValue, MATERIALS, PATTERN_NAMES, requestBonus, SECTION_NAMES, STARTERS, STAT_NAMES, TECHNIQUES } from '../core-v2/rules.js';
import { element, enableKeyboardNavigation } from '../presentation/dom.js';
import { NODE_X, nodeY, paintBlade } from './blade.js';
import { artPath, hammerPath, portrait, portraitIndex, loadDArt } from './art.js';
import { createTutorial } from './tutorial.js';

const TEMPLATE=`<div class="forge-app">
<header class="v2-header"><button id="v2-home" class="v2-brand">锤下求生<small>行脚灯炉 · 锻脉与试剑</small></button><div class="contract-counter"><div id="v2-order"></div><progress id="v2-quota" aria-label="当轮交货与信用进度" max="150" value="0"></progress></div><div id="v2-wallet"></div><button id="v2-pause">暂停</button><button id="v2-menu-button">契约菜单</button></header>
<section id="v2-save-banner" class="save-strip" role="status"><span id="v2-save-state"></span><button id="v2-retry">重试保存</button><button id="v2-reread">读取最新契约</button><button id="v2-recover">恢复备份</button><button id="v2-keep-memory">保留进度，不保存续玩</button></section>
<main id="v2-menu" class="v2-menu paper"><p class="eyebrow">十二轮行旅 · 一炉一剑</p><h1>这一把，为谁而造？</h1><p>这一炉，是巡卫的护身剑，还是行客的远行刃？<br>选落点、连锻纹、淬火试剑。留住手艺，也留住明天的炉火。</p><span class="d-portrait portrait-0 menu-portrait" aria-hidden="true"></span><p id="v2-save-preview"></p><button id="v2-continue">继续锻造</button><form id="v2-new-form"><label>契约种子<input id="v2-seed" maxlength="64" value="行脚灯炉" required></label><button id="v2-new" type="submit">开一轮新炉</button></form><button id="v2-memory">不保存试玩</button><button id="v2-tutorial">先去练习炉</button><div class="menu-links"><button id="v2-export">导出新版契约</button><a href="/">继续旧版契约</a><button id="v2-export-legacy">导出旧版存档</button></div><p class="small">十二轮契约，每轮三坯；每三轮商人来访。配额不足扣一枚印记，三枚用尽则契约终止。</p></main>
<section id="v2-game" hidden><section id="v2-paused" class="paper" hidden><h2>炉火暂歇</h2><p>准备中的锤击已取消，已接受结果保留。</p><button id="v2-resume">继续锻造</button></section>
<section id="v2-starter-panel" class="paper decision-panel" hidden><h2 tabindex="-1">带上一门手艺</h2><p>本局免费选一门。之后可向商人购买搭配，最多装三门。</p><div id="v2-starters" class="choice-grid"></div></section>
<section id="v2-request-panel" class="paper decision-panel" hidden><h2 tabindex="-1">今天，接谁的委托？</h2><p>本轮最多接一单。合格成品额外增加交货额和金币；也可只做市场。</p><div id="v2-requests" class="choice-grid"></div><button id="v2-decline">这轮只做市场</button></section>
<section id="v2-workshop" class="v2-workshop" hidden><aside id="v2-tray" class="blank-tray" aria-label="本轮三件来料"></aside><section class="forge-board"><div class="forge-caption"><b id="v2-piece-name"></b><span id="v2-condition"></span></div><div class="blade-host"><canvas id="v2-blade" aria-label="当前剑身与五节锻造痕迹"></canvas><div id="v2-nodes" aria-label="剑身五节十个落点"></div><div id="v2-hammer-anchor" class="hammer-anchor" aria-hidden="true"><img id="v2-hammer" alt="" src="/assets/d/hammer-standard-v1.webp"><span class="impact-rays"></span></div><span id="v2-steam" class="quench-steam" aria-hidden="true"></span></div><div class="forge-stats" id="v2-piece-stats"></div><p id="v2-price-preview" class="value-line"></p><p id="v2-chain" class="chain-line"></p><p id="v2-target-hint"></p></section><aside class="commission paper"><h2><span class="paper-seal" aria-hidden="true">委</span>纸上委托</h2><div id="v2-client"></div><div id="v2-current-request"></div><div id="v2-techniques"></div><button id="v2-trial">试一试这把剑</button><button id="v2-collection">翻看作品簿</button></aside>
<section class="work-controls paper"><div id="v2-modes" class="hammer-row"></div><div class="strike-area"><div class="timing-track" aria-label="松开时机"><span>偏击</span><span>普通</span><span>精准</span><span>普通</span><span>偏击</span><i id="v2-cursor"></i></div><button id="v2-strike" class="primary">按住蓄锤 · 松开落锤</button><p id="v2-outcomes" class="small"></p><div id="v2-heat-bars" class="heat-bars"></div></div><div class="finish-actions"><button id="v2-reheat">回火 · 1煤</button><button id="v2-water">水淬</button><button id="v2-oil">油淬</button><button id="v2-deliver" class="primary">交货</button><button id="v2-scrap">回收</button><button id="v2-settle">收工</button></div></section></section>
<section id="v2-phase" class="paper phase" hidden><h1 id="v2-phase-title" tabindex="-1"></h1><div id="v2-phase-content"></div><div id="v2-phase-actions" class="phase-actions"></div></section></section>
<footer class="v2-footer"><p id="v2-note" role="status" aria-live="polite"></p><span id="v2-art-state" role="status"></span><details id="v2-settings"><summary>操作与声音</summary><div class="settings-row"><label><input id="v2-slow" type="checkbox">慢速时机</label><label><input id="v2-reduced" type="checkbox">减弱动效</label><label><input id="v2-muted" type="checkbox">静音</label><label>音量<input id="v2-volume" type="range" min="0" max="100"></label><span id="v2-settings-state"></span><span id="v2-audio-state" role="status"></span><button id="v2-settings-retry">重试设置保存</button></div></details></footer>
<dialog id="v2-dialog" aria-labelledby="v2-dialog-title"><div class="paper"><h2 id="v2-dialog-title"></h2><div id="v2-dialog-body"></div><div id="v2-dialog-actions" class="phase-actions"></div></div></dialog></div>`;
const ERRORS:Readonly<Record<string,string>>={choose_technique:'先选一门开局手艺。',choose_request:'先接受或拒绝本轮委托。',node_full:'这个落点剩余容量不够，请换点或用轻锤。',no_heat:'余热不够，请换轻锤、回火或收手。',no_coal:'本轮煤已用完，可以淬火、交货或回收。',already_hot:'已经满热且没有应力，无需回火。',already_quenched:'这把剑已淬火封存，不能再加工。',not_forged:'先敲一锤再淬火；原坯也可以直接交货。',piece_finalized:'这件来料已经处置。',readonly:'另一窗口正在保存。关闭占用窗口后重新读取。',locks_unsupported:'此环境无法取得单写锁，可选择不保存试玩。',save_conflict:'另一个窗口已改变存档，请明确读取最新契约。',confirmation_required:'替换当前进度前需要确认。',insufficient_coins:'金币不足，保留现有手艺。',insufficient_scrap:'废料不足，保留现有手艺。',repair_not_needed:'契约印记已经完整。',replacement_required:'技法槽已满，请选择换下一门。',stale_session:'契约状态已更新，请重新操作。',stale_revision:'剑的状态已更新，请重新选择。',save_unavailable:'没有可安全读取的主档，可恢复备份或不保存试玩。'};
interface Ticket { readonly runId:string; readonly revision:number; readonly generation:number }
const ticketOf=(state:RunState,generation:number):Ticket=>({runId:state.runId,revision:state.revision,generation});
// Quotes call the same core pricing/requirements functions as the accepted delivery.
const quenchQuote=(view:ReturnType<typeof getRunView>,piece:Workpiece)=>marketValue(piece)+(view.request&&view.fulfilledRequestId===null?requestBonus(piece,view.request,view.condition):0);

export function mountV2(root:HTMLElement,port:V2Session){
  root.innerHTML=TEMPLATE;enableKeyboardNavigation(root);
  const find=<T extends HTMLElement>(id:string):T=>{const node=root.querySelector<T>(`#${id}`);if(!node)throw Error(`Missing v2 view ${id}`);return node;};
  const button=(id:string)=>find<HTMLButtonElement>(id),field=(id:string)=>find<HTMLInputElement>(id);
  const text=(id:string,value:string)=>{const node=find(id);if(node.textContent!==value)node.textContent=value;};
  const show=(id:string,visible:boolean)=>{find(id).hidden=!visible;};
  const dialog=find<HTMLDialogElement>('v2-dialog'),preferences=createPreferences(()=>window.localStorage),audio=createForgeAudio();
  let prefs=preferences.getSnapshot(),snapshot=port.getSnapshot(),route:'menu'|'play'='menu',selectedId='1:1',node=0,mode:HammerMode='standard',epoch=0,paused=false,disposed=false;
  let input:ReturnType<typeof bindStrikeInput>|null=null,modal=false,phaseKey='',decisionKey='',bladeKey='',focusStage='';
  let dialogCleanup:(()=>void)|null=null,dialogOrigin='';const animations=new Set<Animation>();let effectIdentity='';
  const art=loadDArt(()=>{bladeKey='';render();},()=>text('v2-art-state','部分画稿未能加载，可刷新重试；锻造与存档仍可操作。'));
  function stopEffects(){for(const animation of animations)animation.cancel();animations.clear();find('v2-hammer-anchor').classList.remove('preparing');}
  function effect(target:HTMLElement,frames:Keyframe[],duration:number){if(motion.matches||prefs.value.reducedMotion||document.hidden)return;const animation=target.animate(frames,{duration,easing:'ease-out'});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));}
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const note=(message:string)=>text('v2-note',message);
  const error=(code:string)=>ERRORS[code]??'这次操作暂不可用，请检查当前阶段与资源。';
  const stateTicket=()=>snapshot.state?ticketOf(snapshot.state,snapshot.generation):null;
  const matches=(t:Ticket|null)=>!!t&&!!snapshot.state&&snapshot.state.runId===t.runId&&snapshot.state.revision===t.revision&&snapshot.generation===t.generation;
  const canOperate=()=>!disposed&&route==='play'&&!paused&&!modal&&snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
  function syncAudio(){audio.identify(`${snapshot.state?.runId??''}/${snapshot.generation}/${epoch}`);audio.setMode(route==='play'&&!paused&&!document.hidden?'game':'silent');}
  function closeDialog(){const origin=dialogOrigin;dialogOrigin='';dialogCleanup?.();dialogCleanup=null;if(dialog.open)dialog.close();modal=false;epoch++;input?.cancel();stopEffects();syncAudio();render();const token=epoch;queueMicrotask(()=>{if(disposed||modal||paused||epoch!==token)return;const trigger=origin?root.querySelector<HTMLElement>(`#${origin}`):null;if(trigger&&!trigger.matches(':disabled')&&trigger.getClientRects().length)trigger.focus({preventScroll:true});else if(route==='play'&&snapshot.state?.phase==='workshop'){const next=['v2-strike','v2-trial','v2-settle'].map(id=>button(id)).find(b=>!b.disabled);next?.focus({preventScroll:true});}else if(route==='play'&&snapshot.state?.phase==='merchant'){const next=root.querySelector<HTMLButtonElement>('#v2-phase .merchant-card button:not(:disabled),#v2-phase-content > button:not(:disabled),#v2-phase-actions button:not(:disabled)');(next??button('v2-menu-button')).focus({preventScroll:true});}});}
  function openDialog(title:string,body:HTMLElement|string,actions:readonly {label:string;run:()=>void}[]){
    const active=document.activeElement;dialogOrigin=active instanceof HTMLElement&&root.contains(active)?active.id:'';input?.cancel();epoch++;stopEffects();dialogCleanup?.();dialogCleanup=null;if(dialog.open)dialog.close();modal=true;syncAudio();text('v2-dialog-title',title);
    find('v2-dialog-body').replaceChildren(typeof body==='string'?element('p',body):body);
    const buttons=actions.map(action=>{const b=element('button',action.label);b.addEventListener('click',action.run);return b;});find('v2-dialog-actions').replaceChildren(...buttons);dialog.showModal();
    if(actions.length===1){const heading=find('v2-dialog-title');heading.tabIndex=-1;heading.focus({preventScroll:true});const sheet=dialog.firstElementChild;if(sheet instanceof HTMLElement)sheet.scrollTop=0;}else buttons[0]?.focus();
  }
  function cue(action:Action,before:RunState,after:RunState):Cue|null{
    if(after.phase==='victory'||after.phase==='defeat')return after.phase;
    if(action.type==='settleRound')return after.history.at(-1)?.met?'met':'missed';
    if('pieceId'in action){const a=before.pieces.find(p=>p.id===action.pieceId),b=after.pieces.find(p=>p.id===action.pieceId);if(a?.status==='active'&&b?.status==='broken')return'broken';if(action.type==='quench'&&a&&b&&b.integrity<a.integrity)return'damage';}
    if(action.type==='strike'){const a=before.pieces.find(p=>p.id===action.pieceId),b=after.pieces.find(p=>p.id===action.pieceId);return b?.status==='broken'?'broken':a&&b&&b.integrity<a.integrity?'damage':action.mode;}
    return action.type==='buy'?'purchase':action.type==='deliver'?'delivery':action.type==='scrap'?'recycle':action.type==='reheat'||action.type==='quench'?'heat':null;
  }
  function send(action:Action,ticket:Ticket|null=stateTicket()){
    if(!matches(ticket)||!ticket||!canOperate()){note(paused?'先继续锻造，再操作。':error('stale_session'));return false;}
    const before=snapshot.state;if(!before)return false;
    const result=port.dispatch({runId:ticket.runId,expectedRevision:ticket.revision,action},ticket.generation);
    if(!result.ok){note(error(result.error));return false;}
    const sound=cue(action,before,result.state);if(sound)audio.acceptedCue(sound);
    const patterns=result.events.filter(e=>e.type==='pattern').map(e=>e.pattern?PATTERN_NAMES[e.pattern]:'').filter(Boolean);
    const broken=result.events.find(e=>e.type==='broken');
    const returns=result.events.filter(e=>e.type==='return').map(e=>`${e.label??'顾客'}回访，废料+1`);
    note(broken?`铁件破碎，只回收 ${broken.scrap??1} 废料；已交货的成果保留。`:patterns.length?`锻出${patterns.join('、')}！`:
      action.type==='strike'?'落锤已结算；继续、换路线或淬火收手。':action.type==='quench'?'淬火完成，可以试剑并检查委托。':action.type==='deliver'?`交货 +${result.events.find(e=>e.type==='delivery')?.value??0}`:
      returns.length?`${returns.join('；')}，回信见作品簿。`:'已记录这次选择。');
    input?.refresh();
    if(action.type==='strike'){const anchor=find('v2-hammer-anchor');anchor.classList.remove('preparing');effect(find('v2-hammer'),[{transform:'translate(-26%,-65%) rotate(-30deg)'},{transform:'translate(-26%,-23%) rotate(0deg)',offset:.28},{transform:'translate(-26%,-75%) rotate(-12deg)',offset:.62},{transform:'translate(-26%,-65%) rotate(-8deg)'}],340);effect(anchor.querySelector<HTMLElement>('.impact-rays')!,[{opacity:1,transform:'scale(.3)'},{opacity:0,transform:'scale(1.6)'}],300);}
    if(action.type==='quench')effect(find('v2-steam'),[{opacity:0,transform:'translateY(10px) scale(.6)'},{opacity:.7,offset:.2},{opacity:0,transform:'translateY(-65px) scale(1.4)'}],650);
    return true;
  }
  function confirmAction(title:string,message:string,action:Action){
    const ticket=stateTicket();openDialog(title,message,[{label:'先等等',run:closeDialog},{label:'确认',run:()=>{const valid=matches(ticket);closeDialog();if(valid)send(action,ticket);else note(error('stale_session'));}}]);
  }
  function choice(label:string,detail:string,action:Action){const t=stateTicket(),b=element('button');if(action.type==='chooseRequest'){const r=snapshot.state?.requests.find(r=>r.id===action.requestId);if(r)b.append(portrait(portraitIndex(r.kind)));}if(action.type==='chooseTechnique'){const seal=element('i',label.slice(0,1),'tech-seal');seal.setAttribute('aria-hidden','true');b.append(seal);}b.append(element('strong',label),element('span',detail));b.disabled=!canOperate();b.addEventListener('click',()=>send(action,t));return b;}
  function describeRequest(request:RunState['requests'][number]){return request.needs.map(n=>`${STAT_NAMES[n.stat]}≥${n.minimum}`).join('，')+(request.patterns.length?`；${request.patterns.map(p=>PATTERN_NAMES[p]).join('、')}纹`:'');}
  function trial(piece:Workpiece){
    const result=getTrial(piece);if(!result){note('先完成淬火，再试剑。');return;}
    const body=element('div');body.append(swordCard(piece),element('p',`${MATERIALS[piece.material].label} · 锋${piece.ratings.edge} / 韧${piece.ratings.toughness} / 衡${piece.ratings.balance}`));
    for(const [label,level,kind]of[['切麻绳',result.cut,'cut'],['挡木桩',result.block,'block'],['绕铃桩',result.handling,'handling']]as const){
      const row=element('figure',undefined,`trial-row ${kind}`);row.append(element('figcaption',`${label} · ${level}/8档`));const stage=element('div',undefined,`trial-stage ${kind}`);stage.setAttribute('role','img');stage.setAttribute('aria-label',`${label}，实际性能${level}档`);stage.style.setProperty('--level',String(level));
      if(kind==='cut'){for(let i=0;i<8;i++){const rope=element('i',undefined,i<level?'rope cleaved':'rope');rope.style.setProperty('--delay',`${i*.07}s`);stage.append(rope);}stage.append(element('span',undefined,'trial-cutting-blade'));}
      if(kind==='block'){stage.append(element('span',undefined,'trial-log'),element('span',undefined,'trial-guard'));const ticks=element('div',undefined,'trial-block-ticks');for(let i=0;i<8;i++)ticks.append(element('i',undefined,i<level?'held':''));stage.append(ticks);}
      if(kind==='handling'){for(let i=0;i<8;i++){const bell=element('i',undefined,i<level?'bell reached':'bell'),angle=Math.PI+(i+.5)/8*Math.PI;bell.style.left=`${50+39*Math.cos(angle)}%`;bell.style.top=`${82+66*Math.sin(angle)}%`;bell.style.animationDelay=`${i*.07}s`;stage.append(bell);}stage.append(element('span',undefined,'trial-needle'));}
      row.append(stage);body.append(row);
    }
    body.append(element('p','这是当前成品的实际表现。重看不损坏、不消费、不重复领奖。','small'));openDialog('试剑',body,[{label:'收剑',run:closeDialog}]);
  }
  function swordCard(p:Workpiece){const card=element('article',undefined,'sword-record');card.append(element('h3',`${p.id} · ${MATERIALS[p.material].label} · ${p.status==='delivered'?`交货 ${p.paidValue}`:p.status==='recycled'?`回收 ${p.recoveredScrap} 废料`:p.status==='broken'?'破碎':'台上'}`));const canvas=element('canvas');canvas.setAttribute('aria-label',`${p.id}的实际剑形与锻纹`);card.append(canvas,element('p',`锋${p.ratings.edge} / 韧${p.ratings.toughness} / 衡${p.ratings.balance} · ${p.quench==='water'?'水淬':p.quench==='oil'?'油淬':'未淬火'} · ${p.patterns.map(t=>PATTERN_NAMES[t]).join('、')||'无锻纹'}`));queueMicrotask(()=>{if(!disposed&&canvas.isConnected)paintBlade(canvas,p,-1,art.texture());});return card;}
  function collection(){
    if(!snapshot.state)return;const body=element('div'),visits=getCustomerVisits(snapshot.state),works=element('div',undefined,'work-collection');
    if(visits.length){const letters=element('section',undefined,'customer-returns');letters.append(element('h3','行客回信'));for(const visit of [...visits].reverse()){const letter=element('article',undefined,'customer-return');letter.dataset.pieceId=visit.pieceId;const content=element('div');content.append(element('h4',`${visit.label} · ${visit.dueRound>12?'契约终结回访':`第${visit.receivedRound}轮回访`}`),element('p',`已带它上路：切绳${visit.trial.cut}/8 · 挡击${visit.trial.block}/8 · 绕铃${visit.trial.handling}/8。`),element('strong',`感谢：+${visit.scrap}废料（已收）`),swordCard(visit.piece));letter.append(portrait(portraitIndex(visit.kind)),content);letters.append(letter);}body.append(letters);}
    body.append(element('h3','本炉作品'),works);
    for(const p of getCollection(snapshot.state)){const card=swordCard(p),item=element('button',getTrial(p)?'试剑':p.status==='broken'?'破碎，无法试剑':'未淬火，无法试剑');item.disabled=getTrial(p)===null;item.addEventListener('click',()=>trial(p));card.append(item);works.append(card);}
    openDialog('这一炉的作品簿',body,[{label:'合上手账',run:closeDialog}]);
  }
  function renderPhase(state:RunState){
    const key=`${state.runId}/${state.revision}/${snapshot.generation}/${canOperate()}`;if(phaseKey===key)return;phaseKey=key;
    const content=find('v2-phase-content'),actions=find('v2-phase-actions');content.replaceChildren();actions.replaceChildren();
    if(state.phase==='merchant'){
      text('v2-phase-title','商人的工具摊');content.append(portrait(3,'merchant-portrait'));content.append(element('p','下一把，换一种打法。金币和废料一起支付；最多携带三门技法。'));
      const ticket=stateTicket();
      for(const id of state.merchant){const offer=TECHNIQUES[id],card=element('article',undefined,'merchant-card');card.append(element('h3',offer.label),element('p',offer.effect),element('p',`${offer.coins}金币 + ${offer.scrap}废料`));
        const bought=state.techniques.includes(id)||state.purchases.some(p=>p.afterRound===state.round&&p.productId===id);
        const buy=element('button',bought?'已持有 / 本次已购':'购买');buy.id=`v2-buy-${id}`;buy.disabled=!canOperate()||bought||state.coins<offer.coins||state.scrap<offer.scrap;
        buy.addEventListener('click',()=>{if(!matches(ticket)){note(error('stale_session'));return;}
          if(state.techniques.length>=3){const body=element('div');body.append(element('p','替换不退款；取消会保留原有手艺。'));for(const old of state.techniques){const b=element('button',`换下${TECHNIQUES[old].label}`);b.append(element('small',TECHNIQUES[old].effect));b.addEventListener('click',()=>{closeDialog();confirmAction(`换成${offer.label}`,`失去${TECHNIQUES[old].label}：${TECHNIQUES[old].effect}。换入${offer.label}：${offer.effect}；支付${offer.coins}金币/${offer.scrap}废料。`,{type:'buy',productId:id,replaceId:old});});body.append(b);}openDialog('选一门换下的手艺',body,[{label:'保留原样',run:closeDialog}]);}
          else confirmAction(`购买${offer.label}`,`${offer.effect}；支付${offer.coins}金币和${offer.scrap}废料。`,{type:'buy',productId:id});});card.append(buy);if(!bought&&(state.coins<offer.coins||state.scrap<offer.scrap))card.append(element('small',`还差 ${Math.max(0,offer.coins-state.coins)}金币 / ${Math.max(0,offer.scrap-state.scrap)}废料`));content.append(card);}
      const repair=element('button','补一枚契约印记 · 240金币 / 6废料');repair.id='v2-repair';repair.disabled=!canOperate()||state.seals>=3||state.coins<240||state.scrap<6||state.purchases.some(p=>p.afterRound===state.round&&p.productId==='repair');repair.addEventListener('click',()=>confirmAction('修补契约','支付240金币与6废料，本次来访只能修补一次。',{type:'buy',productId:'repair'}));content.append(repair);
      actions.append(choice('带上手艺，继续契约','进入下一轮；本次商人离开。',{type:'leaveMerchant'}));
    }else{
      const last=state.history.at(-1);text('v2-phase-title',state.phase==='victory'?'十二轮，炉火仍在':state.phase==='defeat'?'契约印记已经用尽':last?.met?'本轮交货完成':'本轮未达标，扣一枚印记');
      if(last)content.append(element('p',`第${last.round}轮：新交${last.delivered} + 信用${last.credit} / 配额${last.quota}；印记${last.sealsBefore}→${last.sealsAfter}，下一轮信用${last.nextCredit}。`));
      if(state.round===3&&state.phase==='roundSummary')content.append(element('p','前三轮已经走完。接下来看看商人带来的技法，想想下一把会怎么打。','milestone'));
      if(last){const receipts=element('div',undefined,'piece-receipts');for(const p of last.pieces)receipts.append(swordCard(p));content.append(receipts);}
      const table=element('table'),head=element('tr');for(const label of['轮次','新交 / 信用','配额','结果'])head.append(element('th',label));table.append(head);
      for(const h of state.history){const tr=element('tr');for(const value of[String(h.round),`${h.delivered} / ${h.credit}`,String(h.quota),h.met?'达标':'违约'])tr.append(element('td',value));table.append(tr);}content.append(table);
      if(state.phase==='roundSummary')actions.append(choice([3,6,9].includes(state.round)?'看看商人的工具':'下一轮','当前三件收据已保留。',{type:'advanceSummary'}));
      else{const restart=element('button','重新开炉');restart.addEventListener('click',()=>{route='menu';epoch++;input?.cancel();render();field('v2-seed').focus();});actions.append(restart);}
      const book=element('button','查看作品簿');book.addEventListener('click',collection);actions.append(book);
    }
  }
  function render(){
    if(disposed)return;syncAudio();input?.refresh();const state=snapshot.state;const effectKey=`${state?.runId}/${state?.revision}/${epoch}/${selectedId}/${node}/${mode}`;if(effectKey!==effectIdentity){effectIdentity=effectKey;stopEffects();}if(paused||modal||route!=='play')stopEffects();root.dataset.phase=route==='menu'?'menu':state?.phase??'';
    show('v2-menu',route==='menu');show('v2-game',route==='play'&&state!==null);show('v2-paused',paused);show('v2-recover',snapshot.load?.backup.status==='valid'&&snapshot.load.main.status!=='valid');
    button('v2-retry').disabled=!snapshot.dirty||snapshot.mode!=='writer'||snapshot.conflict;button('v2-keep-memory').disabled=!state;
    show('v2-retry',snapshot.dirty);show('v2-reread',snapshot.conflict||['readonly','unsupported','error'].includes(snapshot.mode)||snapshot.load?.main.status==='unavailable');show('v2-keep-memory',!!state&&(snapshot.dirty||snapshot.conflict||['readonly','error'].includes(snapshot.mode)));
    text('v2-save-state',snapshot.mode==='readonly'?'另一窗口正在保存，本窗只读。':snapshot.mode==='memory'?'不保存试玩；刷新或关闭会丢失本次进度。':snapshot.conflict?'存档已在其他窗口变化，请明确读取最新。':snapshot.dirty?'最新进度尚未成功保存，请重试或保留内存续玩。':snapshot.load?.main.status==='invalid'?'主档不兼容或已损坏，原档保留。':snapshot.load?.main.status==='unavailable'?'无法读取本机契约，可重新读取或不保存试玩。':snapshot.mode==='unsupported'||snapshot.mode==='error'?'此环境暂时无法单写保存，可重新读取或不保存试玩。':snapshot.mode==='inactive'?'正在准备本机契约…':!state?'可以开一份新版契约，旧版存档保留。':snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning?'主档已保存；备份未能更新，请保留导出副本。':'本机契约已保存。');
    button('v2-continue').disabled=state===null||!snapshot.active;button('v2-new').disabled=!snapshot.active||!['writer','memory'].includes(snapshot.mode)||(snapshot.mode==='writer'&&snapshot.load?.main.status==='unavailable');
    text('v2-save-preview',state?`本机：第${state.round}/12轮 · ${state.coins}金币 · ${state.seals}枚印记${snapshot.dirty?' · 未保存':''}`:'还没有新版契约。旧版存档会保留。');
    if(!state){text('v2-order','三件来料，一把自己的剑。');text('v2-wallet','');return;}
    const quota=find<HTMLProgressElement>('v2-quota');quota.max=state.history.at(-1)?.round===state.round&&state.phase!=='workshop'?state.history.at(-1)?.quota??150:getRunView(state).quota;quota.value=state.pieces.reduce((sum,p)=>sum+p.paidValue,0)+state.credit;
    const view=getRunView(state,{pieceId:selectedId,node,mode});if(view.selected)selectedId=view.selected.id;const visits=state.returns.filter(r=>r.received).length;text('v2-collection',visits?`作品簿 · 回访 ${visits}`:'翻看作品簿');
    text('v2-order',`第 ${state.round} / 12 轮 · 新交 ${view.delivered} + 信用 ${state.credit} / ${view.quota} · 还差 ${view.remaining}`);text('v2-wallet',`金币 ${state.coins}　废料 ${state.scrap}　煤 ${state.coal}　印记 ${state.seals}/3`);
    const workshop=route==='play'&&state.phase==='workshop';show('v2-starter-panel',workshop&&!state.starterChosen);show('v2-request-panel',workshop&&state.starterChosen&&!state.requestDecided);show('v2-workshop',workshop&&state.starterChosen&&state.requestDecided);show('v2-phase',route==='play'&&state.phase!=='workshop');
    const key=`${state.runId}/${state.revision}/${snapshot.generation}/${canOperate()}`;
    if(decisionKey!==key){decisionKey=key;find('v2-starters').replaceChildren(...STARTERS.map(id=>choice(TECHNIQUES[id].label,TECHNIQUES[id].effect,{type:'chooseTechnique',techniqueId:id})));
      find('v2-requests').replaceChildren(...state.requests.map(r=>choice(r.label,`${describeRequest(r)}；合格+40，两项各超3再+20。`,{type:'chooseRequest',requestId:r.id})));}
    button('v2-decline').disabled=!canOperate();
    for(const [index,p]of view.pieces.entries()){const b=button(`v2-piece-${index}`);b.disabled=paused||modal;b.setAttribute('aria-pressed',String(p.id===selectedId));b.className=`material-choice material-${p.material}`;const label=b.querySelector('span');if(label)label.textContent=`${index+1} ${p.materialName}\n${p.status==='active'?(p.quench?'已淬火':'可加工'):p.status==='broken'?'已破碎':p.status==='delivered'?'已交货':'已回收'}\n${p.value}金币 · 完整${p.integrity}/${p.maxIntegrity}`;}
    for(const n of view.selected?.nodeViews??[]){const b=button(`v2-node-${n.index}`);b.disabled=!canOperate()||view.selected?.quench!==null||view.selected?.status!=='active';b.setAttribute('aria-pressed',String(n.index===node));b.replaceChildren(element('small',`${n.used}/6`,'node-capacity'));b.title=`${n.label} · 已占${n.used}/6容量`; }
    for(const m of['light','standard','heavy']as const){const b=button(`v2-mode-${m}`);b.disabled=!canOperate();b.setAttribute('aria-pressed',String(m===mode));}
    const client=find('v2-client'),index=portraitIndex(view.request?.kind??null);if(client.dataset.portrait!==String(index)){client.dataset.portrait=String(index);client.replaceChildren(portrait(index));}
    const p=view.selected;if(p){
      const anchor=find('v2-hammer-anchor');anchor.style.left=`${(NODE_X[node%5]??160)/10}%`;anchor.style.top=`${nodeY(node)/3.4}%`;find<HTMLImageElement>('v2-hammer').src=hammerPath(mode);anchor.hidden=p.status!=='active'||p.quench!==null;
      text('v2-piece-name',p.name);text('v2-condition',view.conditionLabel);text('v2-piece-stats',`锋 ${p.ratings.edge}　韧 ${p.ratings.toughness}　衡 ${p.ratings.balance}　｜完整 ${p.integrity}/${p.maxIntegrity} · 已锻 ${p.strikes}锤`);
      const bars=find('v2-heat-bars');bars.replaceChildren();for(const[label,value,max,kind]of[['热度',p.heat,120,'heat'],['应力',p.stress,p.threshold,'stress']]as const){const box=element('label',`${label} ${value}/${max}`),meter=element('meter');meter.min=0;meter.max=max;meter.value=value;meter.className=kind;meter.setAttribute('aria-label',`${label}${value}，阈值${max}`);box.append(meter);bars.append(box);}
      text('v2-price-preview',p.quench!==null?`当前交货 ${p.value+p.requestBonus}（市价${p.value} + 委托${p.requestBonus}）`:p.strikes?`现在按原坯交 ${p.value}；${p.quenches.map(q=>`${q.medium==='water'?'水淬':'油淬'}后${q.piece.status==='broken'?'会破碎':`可交${quenchQuote(view,q.piece)}`}`).join(' / ')}`:'落锤增加性能，淬火后成为能交货的成品。');
      text('v2-chain',`锻纹：${p.patterns.length?p.patterns.map(pattern=>PATTERN_NAMES[pattern]).join(' / '):'还未形成'}　连线 ${p.chain.length}/3`);
      text('v2-target-hint',`${SECTION_NAMES[node%5]} · ${node<5?'刃':'脊'} · 本点提升${STAT_NAMES[p.nodeViews[node]?.stat??'balance']}；相邻三点连纹。方向键选点，Q/W/E换锤，1/2/3换坯。`);
      const current=find('v2-current-request');current.replaceChildren(element('h3',view.request?.label??'本轮只做市场'),element('p',view.request?describeRequest(view.request):'成品市价计入配额，回收换废料。'),element('p',view.fulfilledRequestId?'委托已完成，顾客稍后回访。':!view.request?'本轮只做市场，无委托奖励。':p.quench?`当前成品可得委托奖励 ${p.requestBonus}`:'淬火后核对；双项各超3另奖20。'));
      const chips=element('div',undefined,'tech-chips');for(const t of view.techniques){const chip=element('button',`${t.label} · ${t.short}`);chip.id=`v2-tech-${t.id}`;chip.title=`${t.effect} ${t.status}`;chip.addEventListener('click',()=>openDialog(t.label,`${t.effect} ${t.status}`,[{label:'记住了',run:closeDialog}]));chips.append(chip);}find('v2-techniques').replaceChildren(element('h3','随身手艺 · 点开查看'),chips);
      const readiness=p.outcomes[0];button('v2-strike').disabled=!canOperate()||!readiness?.allowed;
      text('v2-outcomes',p.quench!==null?'已淬火封存，可以试剑、交货或回收。':p.status!=='active'?'这件来料已处置，请换一件或收工。':p.outcomes.map(o=>`${o.grade==='precise'?'精准':o.grade==='ordinary'?'普通':'偏击'}：${o.allowed?`+${o.gained}属性 / 热−${o.heatCost} / 应力+${o.stressAdded}${o.damaged?` / 完整−${o.damaged}`:''}${o.piece.status==='broken'?'，将破碎':''}`:error(o.reason??'')}`).join('；'));
      button('v2-reheat').disabled=!canOperate()||p.status!=='active'||p.quench!==null||state.coal<=0||(p.heat>=100&&p.stress===0);
      button('v2-water').disabled=!canOperate()||!p.quenches[0]?.allowed;button('v2-oil').disabled=!canOperate()||!p.quenches[1]?.allowed;
      for(const q of p.quenches)button(`v2-${q.medium}`).querySelector('span')!.textContent=`${q.medium==='water'?'水淬':'油淬'}${q.allowed?q.piece.status==='broken'?' · 会破碎':` → ${quenchQuote(view,q.piece)}`:''}`;
      button('v2-deliver').disabled=!canOperate()||p.status!=='active';button('v2-deliver').textContent=`交货 ${p.value+p.requestBonus}`;
      button('v2-scrap').disabled=!canOperate()||p.status!=='active';button('v2-scrap').textContent=`回收 +${p.salvage}废料`;button('v2-settle').disabled=!canOperate();button('v2-trial').disabled=p.trial===null;
      const drawKey=`${state.runId}/${state.revision}/${selectedId}/${node}`;if(!find('v2-workshop').hidden&&bladeKey!==drawKey){bladeKey=drawKey;paintBlade(find<HTMLCanvasElement>('v2-blade'),p,node,art.texture());}
    }
    if(state.phase!=='workshop')renderPhase(state);
    if(route==='menu')focusStage='';
    const stage=`${state.runId}/${state.round}/${state.phase}/${state.starterChosen}/${state.requestDecided}`;
    if(route==='play'&&!paused&&!modal&&stage!==focusStage){focusStage=stage;const token=epoch,revision=state.revision;queueMicrotask(()=>{
      if(disposed||token!==epoch||snapshot.state?.revision!==revision||route!=='play'||modal||paused)return;
      const target=state.phase!=='workshop'?find('v2-phase-title'):!state.starterChosen?find('v2-starters').querySelector<HTMLButtonElement>('button'):!state.requestDecided?find('v2-requests').querySelector<HTMLButtonElement>('button'):button('v2-strike').disabled?button('v2-settle'):button('v2-strike');target?.focus({preventScroll:true});
    });}
  }

  for(let i=0;i<3;i++){const b=element('button'),stone=element('i',undefined,'material-stone');stone.setAttribute('aria-hidden','true');b.append(stone,element('span'));b.id=`v2-piece-${i}`;b.addEventListener('click',()=>{input?.cancel();epoch++;selectedId=snapshot.state?.pieces[i]?.id??selectedId;render();if(!button('v2-strike').disabled)button('v2-strike').focus({preventScroll:true});});find('v2-tray').append(b);}
  for(let i=0;i<10;i++){const b=element('button');b.id=`v2-node-${i}`;b.style.left=`${(NODE_X[i%5]??0)/10}%`;b.style.top=`${nodeY(i)/3.4}%`;b.setAttribute('aria-label',`${SECTION_NAMES[i%5]}${i<5?'刃':'脊'}落点`);b.addEventListener('click',()=>{input?.cancel();epoch++;node=i;render();if(!button('v2-strike').disabled)button('v2-strike').focus({preventScroll:true});});find('v2-nodes').append(b);}
  for(const m of['light','standard','heavy']as const){const h=HAMMERS[m],b=element('button'),img=element('img');img.src=hammerPath(m);img.alt='';b.append(img,element('span',`${h.label} · 力${h.force} / 热${h.heat}`));b.id=`v2-mode-${m}`;b.addEventListener('click',()=>{input?.cancel();epoch++;mode=m;render();if(!button('v2-strike').disabled)button('v2-strike').focus({preventScroll:true});});find('v2-modes').append(b);}
  input=bindStrikeInput(button('v2-strike'),{
    context:()=>{const s=snapshot.state;if(!s||!canOperate()||document.hidden||s.phase!=='workshop'||button('v2-strike').disabled)return null;return{rulesVersion:s.rulesVersion,runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId:selectedId,node,mode,periodMs:HAMMERS[mode].periodMs*(prefs.value.slow?1.5:1)};},
    release:attempt=>{if(send({type:'strike',pieceId:attempt.identity.pieceId,node:attempt.identity.node??0,mode:attempt.identity.mode,timingMark:attempt.timingMark},{runId:attempt.identity.runId,revision:attempt.identity.revision,generation:attempt.identity.generation})){const target=button('v2-strike').disabled?button('v2-settle'):button('v2-strike');target.focus({preventScroll:true});}},
    visual:visual=>{find('v2-cursor').style.left=`${visual.preparing?visual.mark/100:0}%`;find('v2-hammer-anchor').classList.toggle('preparing',visual.preparing);},
  });
  for(const medium of['water','oil']as const){const b=button(`v2-${medium}`),image=element('img');image.src=artPath(`${medium}-v1`);image.alt='';b.replaceChildren(image,element('span',medium==='water'?'水淬':'油淬'));}
  button('v2-tutorial').addEventListener('click',()=>{const lesson=createTutorial(art.texture,prefs.value.slow);openDialog('练习炉 · 学会第一道锻纹',lesson.body,[{label:'合上练习',run:closeDialog}]);dialogCleanup=lesson.dispose;});
  function newGame(memory=false){
    const seed=field('v2-seed').value,input={runId:crypto.randomUUID(),seed},generation=snapshot.generation;
    const start=(confirmed:boolean)=>{if(generation!==snapshot.generation){note(error('stale_session'));return;}
      const result=memory?port.useMemory(input,{generation,confirmed}):port.startNewGame(input,{generation,confirmed});
      if(!result.ok){note(error(result.error));return;}selectedId='1:1';node=0;route='play';paused=false;epoch++;phaseKey='';render();note('三件来料就位，先选一门本局手艺。');find('v2-starter-panel').querySelector<HTMLButtonElement>('button')?.focus();};
    if(snapshot.state||snapshot.load?.main.status==='invalid')openDialog('重新开炉？','新版当前契约将被替换；旧版契约不受影响。',[{label:'保留当前',run:closeDialog},{label:memory?'不保存新试玩':'确认开新炉',run:()=>{closeDialog();start(true);}}]);else start(false);
  }
  function exportSave(legacy=false){try{const raw=legacy?localStorage.getItem(SAVE_KEY):snapshot.state?JSON.stringify({schemaVersion:2,rulesVersion:'forge-v2',savedAt:new Date().toISOString(),state:snapshot.state}):localStorage.getItem(V2_SAVE_KEY);if(!raw){note('这里还没有可导出的契约。');return;}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=element('a');a.href=url;a.download=legacy?'sword-led-legacy.json':'sword-led-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{note('浏览器未允许读取或导出存档。');}}
  find<HTMLFormElement>('v2-new-form').addEventListener('submit',event=>{event.preventDefault();newGame();});button('v2-memory').addEventListener('click',()=>newGame(true));
  button('v2-continue').addEventListener('click',()=>{if(!snapshot.state)return;route='play';paused=false;epoch++;render();});
  const goMenu=()=>{input?.cancel();stopEffects();epoch++;paused=false;route='menu';if(dialog.open)closeDialog();render();};button('v2-menu-button').addEventListener('click',goMenu);button('v2-home').addEventListener('click',goMenu);
  button('v2-export').addEventListener('click',()=>exportSave());button('v2-export-legacy').addEventListener('click',()=>exportSave(true));
  button('v2-decline').addEventListener('click',()=>send({type:'chooseRequest',requestId:null}));
  button('v2-reheat').addEventListener('click',()=>confirmAction('回火','消耗1煤，热回100、应力−18；当前未完成连线会断开，已获属性/纹路和点容量保留。',{type:'reheat',pieceId:selectedId}));
  for(const medium of['water','oil']as const)button(`v2-${medium}`).addEventListener('click',()=>{
    if(!snapshot.state)return;const view=getRunView(snapshot.state,{pieceId:selectedId,node,mode}),out=view.selected?.quenches.find(q=>q.medium===medium);if(!out?.allowed)return;
    confirmAction(medium==='water'?'水淬封存':'油淬封存',`淬后：锋${out.piece.ratings.edge} / 韧${out.piece.ratings.toughness} / 衡${out.piece.ratings.balance}，应力${out.piece.stress}，完整${out.piece.integrity}/${out.piece.maxIntegrity}${out.piece.status==='broken'?'，这把剑会破碎':`，可交货${quenchQuote(view,out.piece)}`}。确认后不能再锻打。`,{type:'quench',pieceId:selectedId,medium});
  });
  button('v2-deliver').addEventListener('click',()=>{if(!snapshot.state)return;const p=getRunView(snapshot.state,{pieceId:selectedId}).selected;if(p)confirmAction('确认交货',`获得${p.value+p.requestBonus}金币并计入当轮交货；${p.quench===null?'尚未淬火，只能按原坯价交货。':'成品会保留在作品簿。'}`,{type:'deliver',pieceId:selectedId});});
  button('v2-scrap').addEventListener('click',()=>{if(!snapshot.state)return;const p=getRunView(snapshot.state,{pieceId:selectedId}).selected;if(p)confirmAction('确认回收',`获得${p.salvage}废料，不增加金币或交货额。`,{type:'scrap',pieceId:selectedId});});
  button('v2-settle').addEventListener('click',()=>{const state=snapshot.state;if(!state)return;const v=getRunView(state);confirmAction('本轮收工',`尚未处置的${state.pieces.filter(p=>p.status==='active').length}件会回收；新交${v.delivered}+信用${v.credit}/${v.quota}${v.remaining?`，不足将扣1枚印记`:'，已经达标'}。`,{type:'settleRound',recycleRemaining:true});});
  button('v2-trial').addEventListener('click',()=>{const p=snapshot.state?.pieces.find(p=>p.id===selectedId);if(p)trial(p);});button('v2-collection').addEventListener('click',collection);
  button('v2-retry').addEventListener('click',()=>{const r=port.retrySave(snapshot.generation);if(!r.ok)note(error(r.error));});
  button('v2-reread').addEventListener('click',()=>{const generation=snapshot.generation;openDialog('读取最新契约','会放弃尚未保存的内存进度，重新取得可用的写入权限并读取磁盘。',[{label:'保留当前',run:closeDialog},{label:'确认读取',run:()=>{closeDialog();if(generation!==snapshot.generation){note(error('stale_session'));return;}const token=++epoch;void port.activate().then(()=>{if(disposed||token!==epoch)return;const r=port.resume({generation:snapshot.generation,confirmed:true});if(!r.ok)note(error(r.error));});}}]);});
  button('v2-recover').addEventListener('click',()=>{const generation=snapshot.generation;openDialog('恢复备份','备份可能少了最近一步；原主档不会被自动当作合法进度。',[{label:'先保留',run:closeDialog},{label:'确认恢复',run:()=>{closeDialog();const r=port.recoverBackup({generation,confirmed:true});if(!r.ok)note(error(r.error));}}]);});
  button('v2-keep-memory').addEventListener('click',()=>{const generation=snapshot.generation;openDialog('不保存续玩','保留当前进度；刷新或关闭会失去这些尚未写入的操作。',[{label:'继续尝试保存',run:closeDialog},{label:'保留进度，不保存',run:()=>{closeDialog();const r=port.useMemory(null,{generation,confirmed:true});if(!r.ok)note(error(r.error));}}]);});
  function pause(){if(route!=='play'||!snapshot.state)return;if(dialog.open)closeDialog();paused=true;epoch++;input?.cancel();stopEffects();render();}
  button('v2-pause').addEventListener('click',pause);button('v2-resume').addEventListener('click',()=>{paused=false;epoch++;render();});
  const onKey=(event:KeyboardEvent)=>{
    if(event.key==='Enter'&&event.repeat){event.preventDefault();return;}if(event.key==='Escape'&&!dialog.open){event.preventDefault();paused?button('v2-resume').click():pause();}
    if(event.ctrlKey||event.metaKey||event.altKey||!canOperate()||snapshot.state?.phase!=='workshop'||document.activeElement?.matches('input,select,textarea,summary'))return;
    const key=event.key.toLowerCase();let changed=true;
    if(key==='arrowleft')node=Math.floor(node/5)*5+Math.max(0,node%5-1);else if(key==='arrowright')node=Math.floor(node/5)*5+Math.min(4,node%5+1);
    else if(key==='arrowup')node=node%5+5;else if(key==='arrowdown')node=node%5;
    else if(key==='q'||key==='w'||key==='e')mode=key==='q'?'light':key==='w'?'standard':'heavy';
    else if(key==='1'||key==='2'||key==='3')selectedId=snapshot.state.pieces[Number(key)-1]?.id??selectedId;else changed=false;
    if(changed){event.preventDefault();input?.cancel();epoch++;render();if(!button('v2-strike').disabled)button('v2-strike').focus({preventScroll:true});}
  };
  const onHidden=()=>{if(document.hidden)pause();},onBlur=()=>pause(),onGesture=()=>{void audio.gesture();};
  const onClick=(event:MouseEvent)=>{const t=event.target instanceof Element?event.target.closest('button'):null;if(t instanceof HTMLButtonElement&&!t.disabled)t.focus({preventScroll:true});};
  const onCancel=(event:Event)=>{event.preventDefault();closeDialog();};dialog.addEventListener('cancel',onCancel);
  for(const [id,key]of[['v2-slow','slow'],['v2-reduced','reducedMotion'],['v2-muted','muted']]as const)field(id).addEventListener('change',()=>{input?.cancel();epoch++;preferences.update({[key]:field(id).checked});});
  field('v2-volume').addEventListener('input',()=>preferences.update({volume:Number(field('v2-volume').value)}));button('v2-settings-retry').addEventListener('click',preferences.retry);
  const unsubscribePrefs=preferences.subscribe(value=>{prefs=value;field('v2-slow').checked=value.value.slow;field('v2-reduced').checked=value.value.reducedMotion;field('v2-muted').checked=value.value.muted;field('v2-volume').value=String(value.value.volume);root.classList.toggle('reduced',motion.matches||value.value.reducedMotion);audio.configure(value.value);text('v2-settings-state',value.dirty?'设置尚未保存':value.problem?'偏好无法读取，当前设置仍可用':value.persisted?'设置已保存':'正在使用默认设置');show('v2-settings-retry',value.dirty||value.problem!==null);stopEffects();render();});
  const unsubscribeAudio=audio.subscribe(status=>text('v2-audio-state',status==='ready'?'声音可用':status==='muted'?'已静音':status==='blocked'?'声音被浏览器阻止，可再次操作重试':status==='unavailable'?'此环境没有可用音频，锻造仍可继续':'操作后启用声音'));
  const onMotion=()=>{root.classList.toggle('reduced',motion.matches||prefs.value.reducedMotion);stopEffects();},onStorage=(event:StorageEvent)=>{if(event.key==='sword-led.settings.v1'||event.key===null)preferences.reload();};
  root.addEventListener('click',onClick,true);root.addEventListener('keydown',onGesture,true);root.addEventListener('pointerdown',onGesture,true);window.addEventListener('keydown',onKey);window.addEventListener('blur',onBlur);window.addEventListener('storage',onStorage);document.addEventListener('visibilitychange',onHidden);motion.addEventListener('change',onMotion);
  const resize=new ResizeObserver(()=>{bladeKey='';if(snapshot.state&&route==='play')render();});resize.observe(find('v2-blade'));
  const unsubscribe=port.subscribe(value=>{snapshot=value;render();});void port.activate();
  return{async dispose(){if(disposed)return;disposed=true;epoch++;input?.dispose();stopEffects();art.dispose();dialogCleanup?.();dialogCleanup=null;unsubscribe();unsubscribePrefs();unsubscribeAudio();resize.disconnect();dialog.removeEventListener('cancel',onCancel);if(dialog.open)dialog.close();root.removeEventListener('click',onClick,true);root.removeEventListener('keydown',onGesture,true);root.removeEventListener('pointerdown',onGesture,true);window.removeEventListener('keydown',onKey);window.removeEventListener('blur',onBlur);window.removeEventListener('storage',onStorage);document.removeEventListener('visibilitychange',onHidden);motion.removeEventListener('change',onMotion);await Promise.allSettled([audio.dispose(),port.dispose()]);}};
}
