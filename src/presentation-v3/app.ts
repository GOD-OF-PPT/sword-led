import { packageUrl } from '../security/package-url.mjs';
import { sanitizeHtml } from '../security/sanitize-html.mjs';
import type {V3Session} from '../application/v3-persistence.js';
import type {Action,DomainEvent,Trait,RunState} from '../core-v3/index.js';
import {TRAITS,quotaFor,strikeOdds,atCap,recovery,settlementPreview,merchantPresent,upgradePrice} from '../core-v3/index.js';
import {bindDirectStrikeInput} from '../platform/direct-strike-input.js';
import type {StrikePoint} from '../platform/direct-strike-input.js';
import type {InputIdentity} from '../platform/timing.js';
import {createPreferences,SETTINGS_KEY} from '../platform/settings.js';
import {createForgeAudio} from '../platform/audio.js';
import {element,enableKeyboardNavigation} from '../presentation/dom.js';
import {loadV3Art,traitArt} from './art.js';
import {bladeAppearance} from './appearance.js';
import {bladeContact} from './surface.js';
import {paintBlade} from './blade.js';
import {createImpactFeedback,IMPACT_SOUNDS} from './impact.js';
import {campaignTotals,contractName,traitStatus} from './campaign.js';
import type {ContractLength} from './campaign.js';
import {journey,roundStory,endStory,helpStory} from './scene.js';
import {createSceneFeedback} from './scene-feedback.js';
import {createWorkshopGuide} from './workshop-guide.js';
import {createForgeNotices,forgeNotice,forgeJourney} from './forge-notices.js';
import {createNotebookScene,notebookPages,notebookSummary,paintNotebook,customerStory} from './notebook-ui.js';

const TEMPLATE=`<div class="v3-app">
<header class="v3-top"><div class="v3-brand">锤下求生<small id="v3-edition">v0.6 炉前 · 十二轮契约</small></div><div class="v3-contract"><b id="v3-round"></b><span id="v3-target"></span><progress id="v3-progress" aria-label="本轮交差进度"></progress><div id="v3-journey"></div></div><div id="v3-wallet"></div><button id="v3-pause">暂停</button><button id="v3-menu">契约</button></header>
<section id="v3-save" class="v3-save" aria-label="保存状态"><span id="v3-save-text" role="status"></span><button id="v3-retry">重试保存</button><button id="v3-reread">读取最新</button><button id="v3-recover">恢复备份</button><button id="v3-memory">保留进度，不保存续玩</button><button id="v3-export">导出进度</button></section>
<main id="v3-workshop" class="v3-workshop"><aside class="v3-rack"><h2>今日三柄</h2><div id="v3-inventory"></div><section class="v3-reserve"><h3 id="v3-reserve-title">留给明天</h3><div id="v3-reserve-slot"></div></section></aside>
<section class="v3-anvil"><div class="v3-focus"><span id="v3-blade-name"></span><strong id="v3-value"></strong><span id="v3-value-hint">当前身价 · 收手即可交差</span></div><div id="v3-scene" class="v3-scene"><canvas id="v3-blade" role="img" aria-label="当前剑的造型与裂纹"></canvas><button id="v3-hit" type="button" aria-label="铁砧 · 鼠标左键直接落锤，无需瞄准或卡时机"><span class="hit-hint">鼠标左键 · 直接敲击剑身</span></button><div class="v3-tool-layer" aria-hidden="true"><div id="v3-hammer"><img src="/assets/d/hammer-forge-v2.webp" alt=""></div></div><div id="v3-impact-glow" aria-hidden="true"></div><div id="v3-impact-ring" aria-hidden="true"></div><div id="v3-reticle" aria-hidden="true"></div><div id="v3-sparks" aria-hidden="true"></div><div id="v3-steam" aria-hidden="true"></div><div id="v3-float" aria-live="off"></div><div id="v3-impact-badge" aria-hidden="true"></div></div><div id="v3-result" class="v3-result" role="status" aria-live="polite"></div><div class="v3-risk"><b id="v3-risk"></b><span id="v3-risk-after"></span></div><div class="v3-charge"><span>锤势</span><div id="v3-pips"></div><span id="v3-charge-text"></span></div>
<div id="v3-coach" class="v3-coach"><b></b><span></span></div><div class="v3-actions"><button id="v3-strike" class="v3-primary">落锤<small>点击 / 空格松开</small></button><button id="v3-deliver" class="v3-gold">交差</button><button id="v3-store">挂剑</button></div><div class="v3-minor"><button id="v3-scrap">回收</button><button id="v3-settle">收工</button><details><summary>看懂这一锤</summary><p>成功涨价45%，大成涨价120%。前三锤无裂损，之后风险逐渐升高。首次裂损掉价20%，再次裂损才会断剑。每六记存活锤，换来一次安全连锻。交差计目标与金币，回收只给底价的四分之一。</p></details></div></section>
<aside class="v3-order v3-visitors"><div id="v3-customer-figure" class="v3-customer-figure" data-pose="waiting" role="img"><div class="v3-customer-sprite" aria-hidden="true"></div><div class="v3-customer-fallback" aria-hidden="true"></div><p id="v3-customer-talk" aria-live="off"></p></div><button id="v3-customer-open" aria-haspopup="dialog"><span>和来客聊聊</span></button><p id="v3-customer-motive" class="v3-customer-motive"></p><div class="v3-visitor-footer"><button id="v3-shop">行脚商人 · 已到场</button><button id="v3-notebook" aria-haspopup="dialog"><span>手札</span><small id="v3-notebook-count"></small></button></div></aside><section class="v3-belt"><h3>随身手艺 · 点挂件查看</h3><div id="v3-traits"></div><section id="v3-gift"></section></section></main>
<section id="v3-screen" class="v3-screen" hidden><h1 id="v3-screen-title" tabindex="-1"></h1><div id="v3-screen-body"></div><div id="v3-screen-actions"></div></section>
<section id="v3-event" class="v3-event" aria-label="炉边事件" hidden></section>
<footer class="v3-footer"><p id="v3-note" role="status"></p><button id="v3-events" aria-haspopup="dialog">炉程</button><button id="v3-help" aria-label="玩法图解" title="玩法图解">?</button><details id="v3-settings"><summary aria-label="声音与动效" title="声音与动效">⚙</summary><label><input id="v3-muted" type="checkbox">静音</label><label>音量<input id="v3-volume" type="range" min="0" max="100"></label><label><input id="v3-motion" type="checkbox">减弱动效</label><span id="v3-preferences-state"></span><button id="v3-settings-retry">重试设置保存</button><span id="v3-audio-state"></span></details></footer>
<dialog id="v3-dialog" aria-labelledby="v3-dialog-title"><h2 id="v3-dialog-title"></h2><div id="v3-dialog-body"></div><div id="v3-dialog-actions"></div></dialog><div id="v3-feedback-layer" aria-hidden="true"></div></div>`;
const ERROR:Record<string,string>={readonly:'另一窗口正在保存。关闭占用页面后读取最新，或明确选择不保存试玩。',locks_unsupported:'浏览器无法取得保存锁，可不保存试玩。',save_conflict:'存档已被另一窗口更新。请导出当前进度，再明确读取最新或不保存续玩。',save_unavailable:'当前主档不可读取；可恢复备份、导出或不保存试玩。',insufficient_coins:'金币不足，这次没有扣款。',invalid_replacement:'请先选择换下哪门手艺。',at_cap:'这柄剑已封顶，可以交差或留到明天。',record_limit:'操作记录已到安全上限，仍可交差、回收和收工。',confirmation_required:'替换进度需要明确确认。',stale_revision:'状态已变化，请重新操作。',stale_session:'页面身份已更新，请重新操作。'};
const fmt=(n:number)=>n.toLocaleString('zh-CN');
function ledgerFor(s:RunState){
 const ledger=element('details',undefined,'v3-ledger');ledger.id='v3-ledger';ledger.append(element('summary',`查看本局 ${s.history.length} 轮账本`));
 const table=element('table'),head=element('thead'),header=element('tr'),rows=element('tbody');table.append(element('caption','逐轮交差与印记'));
 for(const label of ['轮次','交差 / 目标','结果','印记','回收金币','挂剑']){const th=element('th',label);th.scope='col';header.append(th);}head.append(header);table.append(head,rows);
 for(const h of s.history){const tr=element('tr');for(const v of [`第${h.round}轮`,`${fmt(h.delivered)} / ${fmt(h.quota)}`,h.met?'达标':h.protected?'受保护':'失约',String(h.sealsAfter),fmt(h.recovered),h.reserveId??'—'])tr.append(element('td',v));rows.append(tr);}ledger.append(table);
 const pieces=element('details',undefined,'v3-piece-ledger');pieces.append(element('summary',`本局 ${s.blades.length} 柄兵器去向`));const list=element('ol');
 for(const b of s.blades){const label=({active:'挂剑保留',delivered:'交差',recycled:'回收',broken:'断剑回收',traded:'换手艺'}as const)[b.status];list.append(element('li',`${b.id} ${bladeAppearance(b).name} · ${label} · ${b.status==='broken'?`曾达${fmt(b.peak)}`:`身价${fmt(b.value)}`}`));}pieces.append(list);ledger.append(pieces);return ledger;
}
export function mountV3(root:HTMLElement,port:V3Session){
  root.innerHTML=sanitizeHtml(TEMPLATE);
  enableKeyboardNavigation(root);
  const ownRoot=root.firstElementChild;
  const find=<T extends HTMLElement>(id:string)=>{const n=root.querySelector<T>(`#${id}`);if(!n)throw Error(`Missing ${id}`);return n;};
  const button=(id:string)=>find<HTMLButtonElement>(id),field=(id:string)=>find<HTMLInputElement>(id);
  const text=(id:string,value:string)=>{const n=find(id);if(n.textContent!==value)n.textContent=value;};
  const show=(id:string,visible:boolean)=>{find(id).hidden=!visible;};
  const dialog=find<HTMLDialogElement>('v3-dialog'),canvas=find<HTMLCanvasElement>('v3-blade');
  const preferences=createPreferences(()=>localStorage),audio=createForgeAudio(undefined,IMPACT_SOUNDS),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let snapshot=port.getSnapshot(),prefs=preferences.getSnapshot(),selectedId='',epoch=0,disposed=false,paused=false,busy=false,menu=false,seedDraft='行脚新炉';
  let modeDraft:ContractLength=new URLSearchParams(location.search).get('mode')==='3'?3:12;
  let input:ReturnType<typeof bindDirectStrikeInput>|null=null,modal=false,origin:HTMLElement|null=null,frameKey='',screenKey='',effectToken=0,lastStrikePoint:StrikePoint|null=null;
  const timers=new Set<ReturnType<typeof setTimeout>>(),animations=new Set<Animation>();
  const note=(s:string)=>text('v3-note',s),current=()=>snapshot.state?.blades.find(b=>b.id===selectedId)??null;
  const allowed=()=>!disposed&&!paused&&!menu&&!modal&&snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
  const stamp=()=>`${snapshot.state?.runId}/${snapshot.generation}/${epoch}`;
  const reduced=()=>prefs.value.reducedMotion||motion.matches;
  const art=loadV3Art(()=>{frameKey='';render();},()=>note('部分画稿未加载；数值、文字与锻造仍可使用。'));
  const impact=createImpactFeedback({scene:find('v3-scene'),canvas,hammer:find('v3-hammer'),sparks:find('v3-sparks'),glow:find('v3-impact-glow'),ring:find('v3-impact-ring'),reticle:find('v3-reticle'),float:find('v3-float'),badge:find('v3-impact-badge'),value:find('v3-value')},{reduced,animate,cue:cue=>audio.acceptedCue(cue),project:p=>{const b=current();return bladeContact(b,p,!!b&&!!art.weapon(bladeAppearance(b).family));}});
  const drawStory=(node:HTMLCanvasElement,b:RunState['blades'][number])=>paintBlade(node,b,art.texture(),art.weapon(bladeAppearance(b).family));
  const sceneEffects=createSceneFeedback(root,find('v3-feedback-layer'),{reduced,draw:drawStory});
  const notebookScene=createNotebookScene(root,reduced);
  const workshopGuide=createWorkshopGuide(find('v3-coach'));
  const notices=createForgeNotices(find('v3-event'),button('v3-events'),notice=>{
    const s=snapshot.state;if(!s||!allowed()||busy)return;
    if(notice.target==='shop'&&merchantPresent(s))shop();
    else if(notice.target==='gift'&&s.gift==='available')find<HTMLButtonElement>('v3-gift').querySelector('button')?.click();
    else if(notice.target==='settle'&&s.phase==='workshop')settle();
    else if(notice.target==='deliver'&&current()?.id===notice.pieceId&&current()?.status==='active')button('v3-deliver').focus({preventScroll:true});
    else if(notice.target==='next'&&s.phase==='workshop'){nextBladeOrSettle();if(current()?.status==='active')button('v3-strike').focus({preventScroll:true});}
    else showJourney();
  });
  function syncAudio(){audio.identify(stamp());audio.setMode(allowed()&&!document.hidden?'game':'silent');}
  function later(fn:()=>void,ms:number){const id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);}
  function cancelEffects(silence=true,preserveGuide=false){sceneEffects.reset();notebookScene.reset();notices.stop();if(!preserveGuide)workshopGuide.cancel();effectToken++;for(const id of timers)clearTimeout(id);timers.clear();for(const a of animations)a.cancel();animations.clear();busy=false;find('v3-hammer').classList.remove('preparing');find('v3-steam').classList.remove('show');find('v3-workshop').classList.remove('forge-flare');for(const n of root.querySelectorAll('.trait-triggered'))n.classList.remove('trait-triggered');impact.reset();if(silence)audio.silence();}
  function animate(node:HTMLElement,frames:Keyframe[],ms:number,easing='ease-out'){if(reduced()||document.hidden)return;const a=node.animate(frames,{duration:ms,easing});animations.add(a);void a.finished.catch(()=>{}).finally(()=>animations.delete(a));}
  function select(id:string){input?.cancel();cancelEffects();epoch++;selectedId=id;render();button('v3-strike').focus({preventScroll:true});}
  function chooseNext(){const s=snapshot.state;if(!s)return;selectedId=s.blades.find(b=>b.status==='active'&&b.id!==s.reserveId)?.id??s.reserveId??'';}
  function exportSave(){const s=snapshot.state;if(!s){note('没有可导出的当前局。');return;}const blob=new Blob([JSON.stringify({schemaVersion:3,rulesVersion:'forge-v3',savedAt:new Date().toISOString(),state:s},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=packageUrl(url);link.download=`sword-led-${s.runId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function closeModal(){if(dialog.open)dialog.close();modal=false;epoch++;input?.cancel();cancelEffects();render();const target=origin;origin=null;queueMicrotask(()=>{if(disposed||modal)return;if(target?.isConnected&&!target.matches(':disabled'))target.focus({preventScroll:true});else button(snapshot.state?.phase==='workshop'?'v3-strike':'v3-menu').focus({preventScroll:true});});}
  function openModal(title:string,body:HTMLElement|string,actions:{label:string;run:()=>void}[]){
    if(dialog.open)closeModal();origin=document.activeElement instanceof HTMLElement?document.activeElement:null;input?.cancel();cancelEffects();epoch++;modal=true;syncAudio();dialog.dataset.kind=typeof body==='string'?'confirm':body.classList.contains('v3-shop-grid')?'merchant':body.classList.contains('v3-help-story')?'help':body.classList.contains('v3-notebook-body')?'notebook':'choice';text('v3-dialog-title',title);
    find('v3-dialog-body').replaceChildren(typeof body==='string'?element('p',body):body);
    find('v3-dialog-actions').replaceChildren(...actions.map(a=>{const b=element('button',a.label);b.onclick=a.run;return b;}));dialog.showModal();find<HTMLButtonElement>('v3-dialog-actions').querySelector('button')?.focus();
  }
  function confirm(title:string,body:HTMLElement|string,run:()=>void){const ticket=stamp(),revision=snapshot.state?.revision;openModal(title,body,[{label:'返回',run:closeModal},{label:'确认',run:()=>{
    // Opening the dialog changes epoch; generation/run/revision still bind its intent.
    const now=snapshot.state;if(ticket.split('/').slice(0,2).join('/')!==stamp().split('/').slice(0,2).join('/')||revision!==now?.revision){closeModal();note('进度已更新，请重新查看后果。');return;}closeModal();run();}}]);}
  function effects(events:readonly DomainEvent[],before:RunState){
    const strike=events.find(e=>e.type==='Strike'),delivered=events.find(e=>e.type==='Delivered');
    if(!strike)cancelEffects(false);
    if(strike?.type==='Strike'){
      cancelEffects(false,true);
      const names={success:'锻成',great:'大成',crack:'出现裂纹',broken:'断剑回收'};const last=strike.hits.at(-1);if(!last)return;
      const total=last.after-(strike.hits[0]?.before??last.after),triggers=[...new Set(strike.hits.flatMap(h=>h.triggers))];
      text('v3-result',`${strike.burst?'连锻 ×'+strike.hits.length+' · ':''}${names[last.result]} · 身价${total>=0?'+':''}${fmt(total)}${triggers.length?' · '+triggers.map(t=>TRAITS[t].name).join('、')+'触发':''}${last.result==='broken'?' · 已按底价回收金币':''}`);
      busy=true;const token=++effectToken;impact.start(lastStrikePoint,strike.burst);
      for(const [i,h] of strike.hits.entries())later(()=>{if(token!==effectToken||document.hidden)return;impact.contact(h,i,strike.hits.length);find('v3-workshop').classList.add('forge-flare');for(const id of h.triggers){const item=root.querySelector<HTMLElement>(`#v3-traits [data-trait="${id}"]`);if(item){item.classList.add('trait-triggered');animate(item,[{filter:'brightness(1)'},{filter:'brightness(1.6)',offset:.2},{filter:'brightness(1)'}],500);}}},i*175);
      const duration=strike.burst?(strike.hits.length-1)*175+235:210;
      later(()=>{if(token!==effectToken)return;busy=false;render();},duration);
      later(()=>{if(token===effectToken){find('v3-workshop').classList.remove('forge-flare');for(const n of root.querySelectorAll('.trait-triggered'))n.classList.remove('trait-triggered');}},Math.max(600,duration+80));
    }else if(delivered?.type==='Delivered'){
      text('v3-result',`已交差 ${fmt(delivered.amount)} · 目标和金币同时增加。`);audio.acceptedCue('delivery');find('v3-steam').classList.add('show');animate(find('v3-steam'),[{opacity:0,transform:'translateY(12px)'},{opacity:.8,offset:.3},{opacity:0,transform:'translateY(-50px)'}],500);chooseNext();later(()=>find('v3-steam').classList.remove('show'),500);
    }else if(events.some(e=>e.type==='Traded'||e.type==='Trait')){audio.acceptedCue('purchase');text('v3-result','手艺已带上，下一锤会按它的实际效果结算。');chooseNext();}
    else if(events.some(e=>e.type==='Recycled')){audio.acceptedCue('recycle');chooseNext();text('v3-result','已回收。这笔金币不计交差。');}
    else if(events.some(e=>e.type==='Reserved'))text('v3-result','剑已归架或取下，身价、裂纹与锤势原样保留。');
    else if(events.some(e=>e.type==='Upgraded')){text('v3-result','炉具升级完成，未来配给底价已提高。');audio.acceptedCue('purchase');}
    else if(events.some(e=>e.type==='Repaired')){text('v3-result','契约印记已修补。');audio.acceptedCue('purchase');}
    else if(events.some(e=>e.type==='Advanced'))audio.acceptedCue('met');
    else if(events.some(e=>e.type==='Settled')){const s=snapshot.state;audio.acceptedCue(s?.phase==='victory'?'victory':s?.phase==='defeat'?'defeat':s?.history.at(-1)?.met?'met':'missed');}
    render();if(snapshot.state){const notice=forgeNotice(events,before,snapshot.state);if(notice)notices.push(notice,reduced());notebookScene.play(before,snapshot.state);sceneEffects.play(events,snapshot.state,'v3-customer-figure');}
  }
  function send(action:Action){
    if(!allowed()||busy)return false;const s=snapshot.state;if(!s)return false;
    const result=port.dispatch({runId:s.runId,expectedRevision:s.revision,action},snapshot.generation);
    if(!result.ok){note(ERROR[result.error]??'当前操作不可用，请查看剑与阶段。');render();return false;}
    note('');effects(result.events,s);return true;
  }
  function acquire(traitId:Trait|null,buy:boolean){
    const s=snapshot.state,b=current();if(!s||buy&&(!b||b.status!=='active'||b.id===s.reserveId))return;
    const pieceId=b?.id??'';
    const run=(replaceId?:Trait)=>send(buy?{type:'buy',pieceId,traitId:traitId!,...(replaceId?{replaceId}:{})}:{type:'claimGift',traitId,...(replaceId?{replaceId}:{})});
    if(s.traits.length===3&&traitId!==null){const body=element('div');body.append(element('p',`${TRAITS[traitId].name}：${TRAITS[traitId].text}${buy?` 将交出当前剑，放弃身价${fmt(b?.value??0)}。`:''}`));for(const old of s.traits){const x=element('button',`换下${TRAITS[old].name}：${TRAITS[old].text}`);x.onclick=()=>{closeModal();confirm('确认替换手艺',`换下${TRAITS[old].name}，带上${TRAITS[traitId].name}。${buy?'交出所选剑。':''}`,()=>run(old));};body.append(x);}openModal('三门已满，选择换下哪门',body,[{label:'保留原样',run:closeModal}]);}
    else if(buy)confirm('用这柄剑换手艺',`${TRAITS[traitId!].name}：${TRAITS[traitId!].text} 将交出第${b?.suppliedRound}轮的剑，放弃身价${fmt(b?.value??0)}，不再计交差。`,()=>run());else run();
  }
  function shop(){const s=snapshot.state;if(!s||!merchantPresent(s))return;const body=element('div',undefined,'v3-shop-grid');
    const trader=element('div',undefined,'v3-trader'),portrait=element('div',undefined,'v3-trader-portrait');portrait.setAttribute('aria-hidden','true');const words=element('div');words.append(element('h3','行脚商人'),element('p','好剑换手艺，炉火才走得远。'),element('small','手艺用当前剑交换；金币升级未来配给或修补印记。'));trader.append(portrait,words);body.append(trader);
    for(const id of s.shop){const card=element('article');card.dataset.trait=id;card.append(traitArt(id),element('h3',TRAITS[id].name),element('p',TRAITS[id].text));const owned=s.traits.includes(id)||s.sold.includes(id),b=current(),buy=element('button',owned?'已持有 / 已换取':`用当前剑交换 · 放弃${fmt(b?.value??0)}`);buy.disabled=owned||!b||b.status!=='active'||b.id===s.reserveId;buy.onclick=()=>{closeModal();acquire(id,true);};card.append(buy);body.append(card);}
    body.append(element('p',`下轮配给底价 ${fmt(s.base)}；本轮剑的底价保持原样。${s.round===s.roundLimit?' 本轮结束即结束本次练手，不再发配给。':''}`));
    const upgrade=element('button',s.upgraded?'炉具本次已升级':`升级炉具 · ${fmt(upgradePrice(s.round))}金币`);upgrade.disabled=s.upgraded||s.coins<upgradePrice(s.round);upgrade.onclick=()=>{closeModal();confirm('提高未来配给底价',`支付${upgradePrice(s.round)}金币；下轮配给底价 ${fmt(s.base)}→${fmt(s.base*2)}。当前三柄不改变。${s.roundLimit===3?'三轮练手本身不会发第4轮配给。':''}`,()=>send({type:'upgrade'}));};body.append(upgrade);
    if(s.seals<3){const repair=element('button',`补一枚印记 · ${Math.ceil(quotaFor(s.round)/2)}金币`);repair.disabled=s.repaired||s.coins<Math.ceil(quotaFor(s.round)/2);repair.onclick=()=>{closeModal();confirm('修补契约印记',`支付${Math.ceil(quotaFor(s.round)/2)}金币，本轮商人最多修补一次。`,()=>send({type:'repair'}));};body.append(repair);}
    openModal('行脚商人的摊子',body,[{label:'回铁砧',run:closeModal}]);
  }
  function settle(){const s=snapshot.state;if(!s||s.phase!=='workshop')return;const p=settlementPreview(s),body=element('div');body.append(element('p',`交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))}。${p.met?'已经达标。':p.protected?'护炉契将保护这次失约。':`尚未达标，将扣一枚印记（${s.seals}→${p.sealsAfter}）。`}`));
    for(const b of p.remaining)body.append(element('p',`${b.id} · 当前身价${fmt(b.value)} → 按底价回收${recovery(b)}金币，不计交差。`));
    body.append(element('p',s.reserveId?`挂剑${s.reserveId}原样保留，其余回收共${p.recovered}金币。${s.round===s.roundLimit?'这柄剑会作为本局收官留剑保留，不再发下一轮配给。':''}`:`没有挂剑保留，回收共${p.recovered}金币。`));confirm('确认收工',body,()=>send({type:'settle'}));}
  function start(confirmed=false,memory=false){const seed=seedDraft;const input={runId:`v3-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,seed,roundLimit:modeDraft},decision={generation:snapshot.generation,confirmed};
    const result=memory?port.useMemory(input,decision):port.startNewGame(input,decision);
    if(!result.ok&&result.error==='confirmation_required'){confirm('开始新契约',`将开启${contractName(modeDraft)}并替换当前炉前进度；可先导出。旧D细锻与B版进度保留。`,()=>start(true,memory));return;}
    if(!result.ok){note(ERROR[result.error]??'无法开始，请检查种子或保存状态。');return;}menu=false;paused=false;chooseNext();epoch++;render();text('v3-result','第一柄已就位。鼠标左键点剑身，即刻落锤。');button('v3-strike').focus();}
  function showNotebook(){const s=snapshot.state;if(!s)return;openModal('本炉手札 · 真实作品',notebookPages(s,()=>paintNotebook(root,s,drawStory)),[{label:'回铁砧',run:closeModal}]);paintNotebook(root,s,drawStory);}
  function showJourney(){const s=snapshot.state;if(s)openModal('炉程 · 目标、成长与经历',forgeJourney(s,notices.entries(),journey(s)),[{label:'回铁砧',run:closeModal}]);}
  function screen(title:string,body:HTMLElement,actions:HTMLButtonElement[]){const key=JSON.stringify([title,menu,paused,snapshot.mode,snapshot.active,snapshot.generation,snapshot.conflict,snapshot.load?.main.status,snapshot.state?.runId,snapshot.state?.revision]);if(key===screenKey)return;screenKey=key;text('v3-screen-title',title);find('v3-screen-body').replaceChildren(body);find('v3-screen-actions').replaceChildren(...actions);}
  function actionButton(label:string,run:()=>void){const b=element('button',label);b.onclick=run;return b;}
  function render(){
    if(disposed)return;const s=snapshot.state,b=current();syncAudio();
    ownRoot?.classList.toggle('interface-review',menu||paused||!s||s.phase!=='workshop');
    text('v3-edition',`v0.6 炉前 · ${s?.roundLimit===3?'三轮练手':'十二轮契约'}`);
    text('v3-round',s?`第 ${s.round} / ${s.roundLimit} 轮${s.roundLimit===3?' · 练手':''}`:'新炉 · 十二轮契约');text('v3-target',s?`交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))}`:'三次商人 · 十二轮契约');
    const progress=find<HTMLProgressElement>('v3-progress');progress.max=s?quotaFor(s.round):180;progress.value=s?.delivered??0;
    const wallet=find('v3-wallet'),walletKey=JSON.stringify([s?.coins,s?.seals]);if(wallet.dataset.value!==walletKey){wallet.dataset.value=walletKey;wallet.replaceChildren(element('b',`金币 ${fmt(s?.coins??0)}`));const seals=element('span',undefined,'v3-seals');seals.setAttribute('aria-label',`契约印记 ${s?.seals??3}/3`);for(let i=0;i<3;i++){const seal=element('i','契');seal.className=i<(s?.seals??3)?'intact':'lost';seal.setAttribute('aria-hidden','true');seals.append(seal);}wallet.append(seals);}if(s){const j=find('v3-journey'),key=JSON.stringify([s.round,s.roundLimit,s.history.map(h=>[h.met,h.protected])]);if(j.dataset.value!==key){j.dataset.value=key;j.replaceChildren(journey(s));}}
    const main=snapshot.load?.main,backup=snapshot.load?.backup;
    const saved=snapshot.mode==='memory'?'本局不保存，请结束前导出':snapshot.conflict?'检测到另一窗口更改，当前进度未覆盖磁盘':snapshot.mode==='readonly'?'只读：另一窗口正在保存':!snapshot.active?'正在取得保存锁':snapshot.dirty?'保存失败，已接受进度仍在本页':main?.status==='invalid'?'主档无效或版本不支持，原字节保留':main?.status==='unavailable'?'无法读取主档，原字节保留':snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning?'主档已保存；备份写入失败':'本地自动保存';
    ownRoot?.classList.toggle('save-issue',snapshot.dirty||snapshot.conflict||snapshot.mode==='readonly'||snapshot.mode==='memory'||main?.status==='invalid'||main?.status==='unavailable'||!!(snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning));
    text('v3-save-text',saved);button('v3-retry').hidden=!snapshot.dirty||snapshot.mode==='memory';button('v3-reread').hidden=!snapshot.conflict&&snapshot.mode!=='readonly';button('v3-recover').hidden=main?.status==='valid'||backup?.status!=='valid';button('v3-memory').hidden=!!s&&!snapshot.dirty&&!snapshot.conflict&&snapshot.mode==='writer';button('v3-export').disabled=!s;
    button('v3-pause').textContent=paused?'继续':'暂停';button('v3-pause').disabled=!s||menu||s.phase!=='workshop';
    const work=!!s&&s.phase==='workshop'&&!menu&&!paused;find('v3-screen').dataset.kind=!s||menu?'menu':paused?'pause':s.phase;if(work)screenKey='';show('v3-workshop',work);show('v3-screen',!work);
    notices.identify(`${s?.runId}/${snapshot.generation}`);notices.render(work&&!modal&&snapshot.active&&!document.hidden&&!ownRoot?.classList.contains('save-issue'));
    button('v3-events').disabled=!s;for(const n of find('v3-event').querySelectorAll<HTMLButtonElement>('button'))n.disabled=busy||!allowed();
    if(!work){const body=element('div');if(!s||menu){
      const intro=element('div',undefined,'v3-menu-hero');intro.append(element('span','十二轮行脚 · 一炉好剑'),element('p','守住炉火，锻出一程好剑。'));if(s)intro.append(element('small',`当前第${s.round}/${s.roundLimit}轮 · ${fmt(s.coins)}金币 · 保有${s.seals}枚印记`));body.append(intro,element('p','左键落锤，见好就收。交差保住今天，留剑为明天留一手。'));
      const label=element('label','契约种子'),seed=element('input');seed.id='v3-seed';seed.maxLength=64;seed.value=seedDraft;seed.oninput=()=>{seedDraft=seed.value;};label.append(seed);body.append(label);
      const modeLabel=element('label','契约长度'),mode=element('select');mode.id='v3-mode';for(const length of [12,3]as const){const option=element('option',contractName(length));option.value=String(length);mode.append(option);}mode.value=String(modeDraft);const hint=element('p',modeDraft===12?'完成十二轮；商人在第3、6、9轮到场。':'第三轮结束即练手结束，不计十二轮通关。');mode.onchange=()=>{modeDraft=mode.value==='3'?3:12;hint.textContent=modeDraft===12?'完成十二轮；商人在第3、6、9轮到场。':'第三轮结束即练手结束，不计十二轮通关。';};modeLabel.append(mode);body.append(modeLabel,hint);
      const actions:HTMLButtonElement[]=[];if(s)actions.push(actionButton('返回当前进度',()=>{menu=false;render();}),actionButton('回顾本炉手札',showNotebook));
      const create=actionButton('开一炉新契约',()=>start());create.disabled=!snapshot.active||snapshot.mode!=='writer'||main?.status==='unavailable';actions.push(create,actionButton('不保存开一炉',()=>start(false,true)));
      const links=element('p');for(const [href,label] of [['/v2.html','继续旧版D细锻'],['/legacy.html','继续B版旧契约']]){const a=element('a',label);a.href=packageUrl(href??'');links.append(a,document.createTextNode('　'));}body.append(links);screen('锤下求生 · 行脚灯炉',body,actions);
    }else if(paused){body.append(element('p','准备中的锤击已取消，已经接受的身价和风险保留。'));screen('炉火暂歇',body,[actionButton('继续锻造',()=>togglePause()),actionButton('回顾本炉手札',showNotebook)]);}
    else{const last=s.history.at(-1);if(s.phase==='summary')body.append(element('p',last?`第${last.round}轮：交差${fmt(last.delivered)}/${fmt(last.quota)}，${last.met?'达标':last.protected?'护炉契保护':'未达标'}；印记${last.sealsBefore}→${last.sealsAfter}。`:'这轮结束了。'));
      if(last&&s.phase==='summary'){body.append(element('p',`回收${last.recovered}金币；${last.reserveId?`挂剑${last.reserveId}保留`:'未留挂剑'}。`));}
      const ledger=ledgerFor(s);
      if(s.phase==='summary'){const next=s.round+1;body.append(element('p',`下一炉 · 第${next}轮目标 ${fmt(quotaFor(next))} · ${[3,6,9].includes(next)?'行脚商人到场，可用剑换手艺、用金币升级':'领取三柄新配给'}。`,'v3-next-round'),roundStory(s),notebookSummary(s,showNotebook),ledger);screen('本轮收据',body,[actionButton('领取下一轮三柄剑',()=>{if(send({type:'advance'})){chooseNext();text('v3-result','新配给已就位。继续锤，还是先用一柄投资手艺？');render();button('v3-strike').focus();}})]);}
      else{const totals=campaignTotals(s);body.append(endStory(s));body.append(element('p',s.phase==='experienceComplete'?'三轮练手已结束。这不是十二轮通关，可以开启完整十二轮契约。':s.phase==='victory'?`你已完成十二轮契约期，保住${s.seals}枚印记。`:`第${s.round}轮三枚印记用尽，可以换一种收手计划再来。`));const metrics=element('div',undefined,'v3-end-metrics');for(const [label,value]of [['达标轮数',`${totals.met}/${s.history.length}`],['累计交差',fmt(totals.earned)],['留存金币',fmt(s.coins)],['最高身价',fmt(totals.peak)]]){const card=element('p');card.append(element('small',label),element('b',value));metrics.append(card);}body.append(metrics);const kept=s.blades.find(p=>p.id===s.reserveId);if(kept)body.append(element('p',`收官留剑：${bladeAppearance(kept).name} · 身价${fmt(kept.value)}${kept.cracked?' · 有裂纹':''}。`));const actions=[actionButton('再开一炉',()=>{modeDraft=s.roundLimit;menu=true;render();}),actionButton('导出这次经历',exportSave)];if(s.phase==='experienceComplete')actions.unshift(actionButton('开始十二轮契约',()=>{modeDraft=12;menu=true;render();}));body.append(notebookSummary(s,showNotebook),ledger);screen(s.phase==='experienceComplete'?'前三轮体验结束':s.phase==='victory'?'十二轮契约完成':'契约终止',body,actions);}
    }}
    if(s){
      const inventory=find('v3-inventory'),pieces=s.blades.filter(p=>p.status==='active'&&p.id!==s.reserveId),inventoryKey=JSON.stringify([s.runId,snapshot.generation,pieces,s.round,selectedId,allowed(),busy]);
      if(inventory.dataset.key!==inventoryKey){inventory.dataset.key=inventoryKey;inventory.replaceChildren();for(const p of pieces){const x=actionButton('',()=>select(p.id)),look=bladeAppearance(p),thumb=element('canvas');thumb.className='v3-weapon-thumb';thumb.setAttribute('aria-hidden','true');x.append(thumb,element('b',look.name),element('small',`${p.suppliedRound===s.round?'本轮':'上轮'} · ${fmt(p.value)}${p.cracked?' · 裂纹':''}`));x.dataset.piece=p.id;x.setAttribute('aria-pressed',String(p.id===selectedId));x.disabled=!allowed()||busy;inventory.append(x);}if(!inventory.children.length)inventory.append(element('p','本轮可用剑已处理。'));}
      if(work)for(const thumb of inventory.querySelectorAll<HTMLCanvasElement>('canvas')){const piece=pieces.find(b=>b.id===thumb.parentElement?.dataset.piece);if(piece)drawStory(thumb,piece);}
      text('v3-reserve-title',s.round===s.roundLimit?'收官留剑':'留给明天');const reserve=s.blades.find(p=>p.id===s.reserveId),slot=find('v3-reserve-slot'),reserveKey=JSON.stringify([s.runId,snapshot.generation,reserve,allowed(),busy]);
      if(slot.dataset.key!==reserveKey){slot.dataset.key=reserveKey;slot.replaceChildren();if(reserve){const x=actionButton('',()=>{if(send({type:'reserve',pieceId:reserve.id}))select(reserve.id);}),thumb=element('canvas');thumb.className='v3-weapon-thumb';thumb.setAttribute('aria-hidden','true');x.append(thumb,element('small',`${fmt(reserve.value)}${reserve.cracked?' · 裂纹':''} · 取下`));x.disabled=!allowed()||busy;slot.append(x);}else slot.append(element('p',s.round===s.roundLimit?'可挂一柄作为本局留剑':'空架 · 可留一柄跨轮'));}
      const reserveThumb=slot.querySelector<HTMLCanvasElement>('canvas');if(work&&reserve&&reserveThumb)drawStory(reserveThumb,reserve);
      const traits=find('v3-traits'),statuses=s.traits.map(id=>traitStatus(s,b,id)),traitKey=JSON.stringify([s.traits,statuses]);if(traits.dataset.equipped!==traitKey){traits.dataset.equipped=traitKey;traits.replaceChildren();for(const id of s.traits){const p=actionButton('',()=>{const body=element('div');body.append(traitArt(id),element('p',TRAITS[id].text),element('p',traitStatus(snapshot.state??s,current(),id)));openModal(TRAITS[id].name,body,[{label:'回铁砧',run:closeModal}]);});p.className='v3-trait-item';p.dataset.trait=id;p.setAttribute('aria-label',`${TRAITS[id].name} · ${traitStatus(s,b,id)}`);const copy=element('span');copy.append(element('b',TRAITS[id].name),element('small',traitStatus(s,b,id)));p.append(traitArt(id),copy);traits.append(p);}if(!s.traits.length)traits.append(element('p',undefined,'v3-empty-traits'));if(!s.traits.length){traits.firstElementChild?.append(traitArt('steady'),element('small','首次达标 · 免费领手艺'));}}
      const gift=find('v3-gift'),giftKey=JSON.stringify([s.runId,snapshot.generation,s.gift,s.traits,allowed(),busy]);if(gift.dataset.key!==giftKey){gift.dataset.key=giftKey;gift.replaceChildren();if(s.gift==='available'){const claim=actionButton('首次达标 · 领一门免费手艺',()=>{const body=element('div'),options=(['steady','ember']as const).filter(id=>!s.traits.includes(id));body.className='v3-gift-grid';for(const id of options){const x=actionButton(`${TRAITS[id].name} · ${TRAITS[id].text}`,()=>{closeModal();acquire(id,false);});x.prepend(traitArt(id));body.append(x);}if(!options.length)body.append(actionButton('领取40金币',()=>{closeModal();acquire(null,false);}));openModal('带上一门手艺',body,[{label:'稍后领取',run:closeModal}]);});claim.disabled=!allowed()||busy;gift.append(claim);}}
      button('v3-shop').hidden=!merchantPresent(s);button('v3-shop').disabled=!allowed()||busy;
      notebookScene.render(s,art.customersReady(),art.coverReady());
    }
    const active=!!s&&!!b&&b.status==='active'&&b.id!==s.reserveId,forge=active&&!atCap(b!);
    find('v3-scene').dataset.instruction=!active?'empty':b?.charge===6?'burst':s?.round===1&&!s.journal.some(a=>a.type==='strike')?'first':'off';
    const look=b?bladeAppearance(b):null;text('v3-blade-name',b&&look?`${look.name} · ${look.rank}${b.cracked?' · 已有裂纹':''}`:'铁砧空了');
    find('v3-scene').dataset.tier=String(look?.stage??0);find('v3-workshop').classList.toggle('visual-still',!work||!snapshot.active||modal||document.hidden||reduced());
    text('v3-value',b?fmt(b.value):'—');
    if(s&&b){const odds=strikeOdds(s,b);find('v3-scene').classList.toggle('burst-ready',odds.burst&&active);text('v3-risk',b.status==='broken'?'这把剑已断，请换下一柄':odds.burst?'连锻已就绪 · 本次无裂损':`${b.cracked?'再裂会断':'下一锤裂损'} ${odds.crack/10}%`);text('v3-risk-after',active?(odds.burst?`连锻后普通风险 ${odds.afterBurstCrack/10}%`:`大成 ${odds.great/10}% · ${b.cracked?'当前身价仍可交差':'首次裂损仍能保住剑'}`):'');
      find('v3-pips').replaceChildren(...Array.from({length:6},(_,i)=>element('i',undefined,i<b.charge?'charged':'')));text('v3-charge-text',`${b.charge}/6${odds.burst?' · 下一锤爆发':''}`);
    }else{text('v3-risk','这一轮，可以收工了');text('v3-risk-after','先查看收工去向，不会立即结算。');find('v3-pips').replaceChildren();text('v3-charge-text','');}
    const primary=button('v3-strike');primary.replaceChildren(document.createTextNode(!active?(s?.blades.some(p=>p.status==='active'&&p.id!==s.reserveId)?'换下一柄':'查看收工结果'):atCap(b!)?'已封顶 · 可以交差':busy?'落锤中…':b?.charge===6?'连锻！':'落锤'),element('small',active?'左键点剑身 / 空格落锤':'这一步不会继续锻打'));
    primary.disabled=!allowed()||(!forge&&active);primary.setAttribute('aria-busy',String(busy));
    // Keep the focused hit surface alive during recoil; the input context rejects busy hits.
    button('v3-hit').disabled=!allowed()||s?.phase!=='workshop';
    button('v3-hit').setAttribute('aria-busy',String(busy));
    button('v3-hit').setAttribute('aria-label',busy?'铁砧 · 落锤中':active?(atCap(b!)?'铁砧 · 已封顶，请交差或挂剑':b?.charge===6?'铁砧 · 鼠标左键安全连锻':'铁砧 · 鼠标左键直接落锤，无需瞄准或卡时机'):s?.blades.some(p=>p.status==='active'&&p.id!==s.reserveId)?'铁砧 · 左键换下一柄':'铁砧 · 左键查看收工结果');
    const hint=find('v3-hit').querySelector('.hit-hint');if(hint)hint.textContent=busy?'锤落 · 火星迸发':active&&b?.charge===6?'锤势已满 · 左键释放连锻':b?.status==='broken'?'剑已断 · 左键换下一柄':!active?'左键查看下一步':'鼠标左键 · 直接敲击剑身';
    button('v3-deliver').textContent=`交差 ${fmt(b?.value??0)}`;button('v3-deliver').disabled=!allowed()||busy||!active;
    button('v3-store').textContent=s?.reserveId?'交换挂剑':s?.round===s?.roundLimit?'挂剑保留':'留给下一轮';button('v3-store').disabled=!allowed()||busy||!active;
    button('v3-scrap').textContent=`回收 · ${b?recovery(b):0}金币`;button('v3-scrap').disabled=!allowed()||busy||!active;button('v3-settle').disabled=!allowed()||busy||s?.phase!=='workshop';
    const bladeKey=JSON.stringify(b);if(frameKey!==bladeKey&&work){frameKey=bladeKey;canvas.setAttribute('aria-label',b?`${look?.name}，${look?.rank}，等级${b.level}，身价${b.value}，${b.status==='broken'?'断剑':b.cracked?'有裂纹':'完好'}；外形不影响属性`:'空铁砧');paintBlade(canvas,b,art.texture(),art.weapon(look?.family??0));impact.refresh();}
    if(s){const hint=workshopGuide.render(s,b,work&&!modal&&snapshot.active);for(const n of root.querySelectorAll('.v3-suggested'))n.classList.remove('v3-suggested');if(work)find(hint.target).classList.add('v3-suggested');for(const c of root.querySelectorAll<HTMLCanvasElement>('[data-story-piece]')){const blade=s.blades.find(b=>b.id===c.dataset.storyPiece);if(blade)drawStory(c,blade);}}
    if(s)paintNotebook(root,s,drawStory);
    input?.refresh();
  }
  function togglePause(){if(!snapshot.state||snapshot.state.phase!=='workshop')return;paused=!paused;epoch++;input?.cancel();cancelEffects();render();if(!paused)button('v3-strike').focus();}
  function inputContext(forge:boolean):InputIdentity|null{const s=snapshot.state,b=current();if(!allowed()||busy||s?.phase!=='workshop')return null;if(forge&&(!b||b.status!=='active'||b.id===s.reserveId||atCap(b)))return null;return{runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId:b?.id??'',mode:'standard',periodMs:1000,rulesVersion:s.rulesVersion};}
  function nextBladeOrSettle(){const b=current();if(!allowed()||busy)return;if(!b||b.status!=='active'||b.id===snapshot.state?.reserveId){const next=snapshot.state?.blades.find(p=>p.status==='active'&&p.id!==snapshot.state?.reserveId);if(next)select(next.id);else settle();}else if(atCap(b))note(ERROR.at_cap??'已封顶，可以交差。');}
  input=bindDirectStrikeInput([button('v3-hit'),button('v3-strike')],{context:()=>inputContext(true),navigationContext:()=>inputContext(false),navigate:nextBladeOrSettle,commit:(identity,point)=>{lastStrikePoint=point;send({type:'strike',pieceId:identity.pieceId});},aim:point=>{if(allowed()&&!busy)impact.aim(point);},preparing:v=>find('v3-hammer').classList.toggle('preparing',v)});
  button('v3-deliver').onclick=()=>{const b=current();if(b&&send({type:'deliver',pieceId:b.id})){button('v3-strike').focus();}};
  button('v3-store').onclick=()=>{const b=current(),old=snapshot.state?.reserveId;if(b&&send({type:'reserve',pieceId:b.id})){if(old&&old!==b.id)selectedId=old;else chooseNext();render();button('v3-strike').focus();}};
  button('v3-scrap').onclick=()=>{const b=current();if(b)confirm('回收这柄剑',`放弃身价${fmt(b.value)}，只回收${recovery(b)}金币，不计目标。`,()=>send({type:'scrap',pieceId:b.id}));};
  button('v3-settle').onclick=settle;button('v3-shop').onclick=shop;button('v3-pause').onclick=togglePause;
  button('v3-menu').onclick=()=>{input?.cancel();cancelEffects();epoch++;menu=!menu;paused=false;render();};
  button('v3-retry').onclick=()=>{const r=port.retrySave(snapshot.generation);if(!r.ok)note(ERROR[r.error]??'仍未保存，请导出当前进度。');};
  button('v3-reread').onclick=()=>confirm('读取最新契约','将放弃本页尚未保存的更改，读取磁盘中的最新进度。可先导出本页进度。',()=>{void port.activate().then(()=>{const r=port.resume({generation:port.getSnapshot().generation,confirmed:true});if(!r.ok)note(ERROR[r.error]??'无法读取最新主档。');chooseNext();render();});});
  button('v3-recover').onclick=()=>{const backup=snapshot.load?.backup;if(backup?.status!=='valid')return;confirm('恢复本炉备份',`备份第${backup.state.round}轮、${backup.state.coins}金币，保存于${new Date(backup.savedAt).toLocaleString('zh-CN')}。确认后替换主档，可能回退最近一步。`,()=>{const r=port.recoverBackup({generation:snapshot.generation,confirmed:true});if(!r.ok)note(ERROR[r.error]??'恢复失败，原档保留。');else{menu=false;chooseNext();render();}});};
  button('v3-memory').onclick=()=>{if(snapshot.state){confirm('保留当前进度，不保存续玩','沿用当前剑和随机结果。磁盘档不会覆盖，结束前请导出。',()=>{port.useMemory(null,{generation:snapshot.generation,confirmed:true});render();});}else{menu=true;render();}};
  button('v3-export').onclick=exportSave;
  button('v3-notebook').onclick=showNotebook;
  button('v3-events').onclick=showJourney;
  button('v3-customer-open').onclick=()=>{const s=snapshot.state;if(s)openModal('炉边来客',customerStory(s,current()),[{label:'回铁砧',run:closeModal}]);};
  button('v3-help').onclick=()=>openModal('炉边图解 · 三步开锻',helpStory(),[{label:'回铁砧',run:closeModal}]);
  const muted=field('v3-muted'),volume=field('v3-volume'),motionField=field('v3-motion');muted.onchange=()=>preferences.update({muted:muted.checked});volume.oninput=()=>preferences.update({volume:Number(volume.value)});motionField.onchange=()=>{input?.cancel();cancelEffects();epoch++;preferences.update({reducedMotion:motionField.checked});render();};button('v3-settings-retry').onclick=()=>preferences.retry();
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  const gesture=()=>{if(!disposed){syncAudio();void audio.gesture();}};
  const hidden=()=>{if(document.hidden){input?.cancel();cancelEffects();epoch++;}render();};
  const blur=()=>{input?.cancel();cancelEffects();epoch++;render();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!modal&&!e.repeat){e.preventDefault();togglePause();}};
  const changedSettings=(e:StorageEvent)=>{if(e.key===SETTINGS_KEY||e.key===null)preferences.reload();};
  const resize=new ResizeObserver(()=>{frameKey='';render();});resize.observe(canvas);
  root.addEventListener('pointerdown',gesture,true);root.addEventListener('keydown',gesture,true);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',key);window.addEventListener('storage',changedSettings);
  const changeMotion=()=>{input?.cancel();cancelEffects();epoch++;render();};motion.addEventListener('change',changeMotion);
  const offPrefs=preferences.subscribe(value=>{prefs=value;muted.checked=value.value.muted;volume.value=String(value.value.volume);motionField.checked=value.value.reducedMotion;audio.configure(value.value);text('v3-preferences-state',value.problem?'设置未保存，可重试':'设置已保存');button('v3-settings-retry').hidden=!value.problem;});
  const offAudio=audio.subscribe(status=>text('v3-audio-state',({waiting:'点击后开启声音',ready:'声音已就绪',muted:'已静音',blocked:'声音未能开启，玩法仍可继续',unavailable:'音频不可用，玩法仍可继续'})[status]));
  const off=port.subscribe(value=>{const changed=snapshot.generation!==value.generation||snapshot.state?.runId!==value.state?.runId;snapshot=value;if(changed){input?.cancel();cancelEffects();epoch++;chooseNext();}if(!selectedId)chooseNext();render();});
  void port.activate().then(()=>{if(disposed)return;const s=port.getSnapshot();if(!s.state&&s.mode==='writer'&&s.load?.main.status==='empty'&&s.load.backup.status==='empty'){const r=port.startNewGame({runId:`v3-${Date.now()}`,seed:'行脚新炉',roundLimit:modeDraft},{generation:s.generation,confirmed:false});if(r.ok){chooseNext();render();button('v3-strike').focus();}}else{chooseNext();render();if(s.state)text('v3-result',`已续上第${s.state.round}轮，剑的身价、裂纹和锤势原样保留。`);}});
  return{async dispose(){disposed=true;off();offPrefs();offAudio();input?.dispose();cancelEffects();notices.dispose();art.dispose();resize.disconnect();motion.removeEventListener('change',changeMotion);root.removeEventListener('pointerdown',gesture,true);root.removeEventListener('keydown',gesture,true);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',key);window.removeEventListener('storage',changedSettings);await Promise.all([port.dispose(),audio.dispose()]);if(root.firstElementChild===ownRoot)root.replaceChildren();}};
}
