import type {V3Session} from '../application/v3-persistence.js';
import type {Action,DomainEvent,Trait} from '../core-v3/index.js';
import {TRAITS,quotaFor,strikeOdds,atCap,recovery,settlementPreview,merchantPresent,upgradePrice} from '../core-v3/index.js';
import {bindStrikeInput} from '../platform/input.js';
import {createPreferences,SETTINGS_KEY} from '../platform/settings.js';
import {createForgeAudio} from '../platform/audio.js';
import {element,enableKeyboardNavigation} from '../presentation/dom.js';
import {loadDArt} from '../presentation-v2/art.js';
import {paintBlade} from './blade.js';

const TEMPLATE=`<div class="v3-app">
<header class="v3-top"><div class="v3-brand">锤下求生<small>行脚灯炉 · v0.4 · 前三轮玩法验证版</small></div><div class="v3-contract"><b id="v3-round"></b><span id="v3-target"></span><progress id="v3-progress" aria-label="本轮交差进度"></progress></div><div id="v3-wallet"></div><button id="v3-pause">暂停</button><button id="v3-menu">契约</button></header>
<section id="v3-save" class="v3-save" aria-label="保存状态"><span id="v3-save-text" role="status"></span><button id="v3-retry">重试保存</button><button id="v3-reread">读取最新</button><button id="v3-recover">恢复备份</button><button id="v3-memory">保留进度，不保存续玩</button><button id="v3-export">导出进度</button></section>
<main id="v3-workshop" class="v3-workshop"><aside class="v3-rack"><h2>今日三柄</h2><div id="v3-inventory"></div><section class="v3-reserve"><h3>留给明天</h3><div id="v3-reserve-slot"></div></section></aside>
<section class="v3-anvil"><div class="v3-focus"><span id="v3-blade-name"></span><strong id="v3-value"></strong><span id="v3-value-hint">当前身价 · 收手即可交差</span></div><div class="v3-scene"><canvas id="v3-blade" role="img" aria-label="当前剑的造型与裂纹"></canvas><div id="v3-hammer" aria-hidden="true"><img src="/assets/d/hammer-standard-v1.webp" alt=""><i></i></div><div id="v3-sparks" aria-hidden="true"></div><div id="v3-steam" aria-hidden="true"></div><div id="v3-float" aria-live="off"></div></div><div id="v3-result" class="v3-result" role="status" aria-live="polite">第一柄已就位。落一锤，看看它能值多少。</div><div class="v3-risk"><b id="v3-risk"></b><span id="v3-risk-after"></span></div><div class="v3-charge"><span>锤势</span><div id="v3-pips"></div><span id="v3-charge-text"></span></div>
<div class="v3-actions"><button id="v3-strike" class="v3-primary">落锤<small>点击 / 空格松开</small></button><button id="v3-deliver" class="v3-gold">交差</button><button id="v3-store">挂剑</button></div><div class="v3-minor"><button id="v3-scrap">回收</button><button id="v3-settle">收工</button><details><summary>看懂这一锤</summary><p>成功涨价45%，大成涨价120%。前三锤无裂损，之后风险逐渐升高。首次裂损掉价20%，再次裂损才会断剑。每六记存活锤，换来一次安全连锻。交差计目标与金币，回收只给底价的四分之一。</p></details></div></section>
<aside class="v3-order"><h2>今日交差</h2><img class="v3-client" src="/assets/d/commission-guard-v2.webp" alt="等候成品的行客"><strong id="v3-deficit"></strong><p id="v3-advice"></p><section id="v3-gift"></section><section><h3>随身手艺</h3><div id="v3-traits"></div></section><button id="v3-shop">行脚商人 · 已到场</button><p class="v3-caption">一柄交差，一柄留后手。<br>再锤一次，还是就此收手？</p></aside></main>
<section id="v3-screen" class="v3-screen" hidden><h1 id="v3-screen-title" tabindex="-1"></h1><div id="v3-screen-body"></div><div id="v3-screen-actions"></div></section>
<footer class="v3-footer"><p id="v3-note" role="status"></p><details id="v3-settings"><summary>声音与动效</summary><label><input id="v3-muted" type="checkbox">静音</label><label>音量<input id="v3-volume" type="range" min="0" max="100"></label><label><input id="v3-motion" type="checkbox">减弱动效</label><span id="v3-preferences-state"></span><button id="v3-settings-retry">重试设置保存</button><span id="v3-audio-state"></span></details></footer>
<dialog id="v3-dialog" aria-labelledby="v3-dialog-title"><h2 id="v3-dialog-title"></h2><div id="v3-dialog-body"></div><div id="v3-dialog-actions"></div></dialog></div>`;
const ERROR:Record<string,string>={readonly:'另一窗口正在保存。关闭占用页面后读取最新，或明确选择不保存试玩。',locks_unsupported:'浏览器无法取得保存锁，可不保存试玩。',save_conflict:'存档已被另一窗口更新。请导出当前进度，再明确读取最新或不保存续玩。',save_unavailable:'当前主档不可读取；可恢复备份、导出或不保存试玩。',insufficient_coins:'金币不足，这次没有扣款。',invalid_replacement:'请先选择换下哪门手艺。',at_cap:'这柄剑已封顶，可以交差或留到明天。',record_limit:'操作记录已到安全上限，仍可交差、回收和收工。',confirmation_required:'替换进度需要明确确认。',stale_revision:'状态已变化，请重新操作。',stale_session:'页面身份已更新，请重新操作。'};
const fmt=(n:number)=>n.toLocaleString('zh-CN');
export function mountV3(root:HTMLElement,port:V3Session){
  root.innerHTML=TEMPLATE;
  enableKeyboardNavigation(root);
  const ownRoot=root.firstElementChild;
  const find=<T extends HTMLElement>(id:string)=>{const n=root.querySelector<T>(`#${id}`);if(!n)throw Error(`Missing ${id}`);return n;};
  const button=(id:string)=>find<HTMLButtonElement>(id),field=(id:string)=>find<HTMLInputElement>(id);
  const text=(id:string,value:string)=>{const n=find(id);if(n.textContent!==value)n.textContent=value;};
  const show=(id:string,visible:boolean)=>{find(id).hidden=!visible;};
  const dialog=find<HTMLDialogElement>('v3-dialog'),canvas=find<HTMLCanvasElement>('v3-blade');
  const sparks=Array.from({length:7},()=>element('i'));find('v3-sparks').append(...sparks);
  const preferences=createPreferences(()=>localStorage),audio=createForgeAudio(),motion=matchMedia('(prefers-reduced-motion: reduce)');
  let snapshot=port.getSnapshot(),prefs=preferences.getSnapshot(),selectedId='',epoch=0,disposed=false,paused=false,busy=false,menu=false,seedDraft='行脚新炉';
  let input:ReturnType<typeof bindStrikeInput>|null=null,modal=false,origin:HTMLElement|null=null,frameKey='',screenKey='',effectToken=0;
  const timers=new Set<ReturnType<typeof setTimeout>>(),animations=new Set<Animation>();
  const note=(s:string)=>text('v3-note',s),current=()=>snapshot.state?.blades.find(b=>b.id===selectedId)??null;
  const allowed=()=>!disposed&&!paused&&!menu&&!modal&&snapshot.active&&!snapshot.conflict&&(snapshot.mode==='writer'||snapshot.mode==='memory');
  const stamp=()=>`${snapshot.state?.runId}/${snapshot.generation}/${epoch}`;
  const reduced=()=>prefs.value.reducedMotion||motion.matches;
  const art=loadDArt(()=>{frameKey='';render();},()=>note('部分画稿未加载；数值、文字与锻造仍可使用。'));
  function syncAudio(){audio.identify(stamp());audio.setMode(allowed()&&!document.hidden?'game':'silent');}
  function later(fn:()=>void,ms:number){const id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);}
  function cancelEffects(){effectToken++;for(const id of timers)clearTimeout(id);timers.clear();for(const a of animations)a.cancel();animations.clear();busy=false;find('v3-hammer').classList.remove('preparing');find('v3-steam').classList.remove('show');find('v3-float').textContent='';audio.silence();}
  function animate(node:HTMLElement,frames:Keyframe[],ms:number){if(reduced()||document.hidden)return;const a=node.animate(frames,{duration:ms,easing:'ease-out'});animations.add(a);void a.finished.catch(()=>{}).finally(()=>animations.delete(a));}
  function select(id:string){input?.cancel();cancelEffects();epoch++;selectedId=id;render();button('v3-strike').focus({preventScroll:true});}
  function chooseNext(){const s=snapshot.state;if(!s)return;selectedId=s.blades.find(b=>b.status==='active'&&b.id!==s.reserveId)?.id??s.reserveId??'';}
  function exportSave(){const s=snapshot.state;if(!s){note('没有可导出的当前局。');return;}const blob=new Blob([JSON.stringify({schemaVersion:3,rulesVersion:'forge-v3',savedAt:new Date().toISOString(),state:s},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=`sword-led-v04-${s.runId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function closeModal(){if(dialog.open)dialog.close();modal=false;epoch++;input?.cancel();cancelEffects();render();const target=origin;origin=null;queueMicrotask(()=>{if(disposed||modal)return;if(target?.isConnected&&!target.matches(':disabled'))target.focus({preventScroll:true});else button(snapshot.state?.phase==='workshop'?'v3-strike':'v3-menu').focus({preventScroll:true});});}
  function openModal(title:string,body:HTMLElement|string,actions:{label:string;run:()=>void}[]){
    if(dialog.open)closeModal();origin=document.activeElement instanceof HTMLElement?document.activeElement:null;input?.cancel();cancelEffects();epoch++;modal=true;syncAudio();text('v3-dialog-title',title);
    find('v3-dialog-body').replaceChildren(typeof body==='string'?element('p',body):body);
    find('v3-dialog-actions').replaceChildren(...actions.map(a=>{const b=element('button',a.label);b.onclick=a.run;return b;}));dialog.showModal();find<HTMLButtonElement>('v3-dialog-actions').querySelector('button')?.focus();
  }
  function confirm(title:string,body:HTMLElement|string,run:()=>void){const ticket=stamp(),revision=snapshot.state?.revision;openModal(title,body,[{label:'返回',run:closeModal},{label:'确认',run:()=>{
    // Opening the dialog changes epoch; generation/run/revision still bind its intent.
    const now=snapshot.state;if(ticket.split('/').slice(0,2).join('/')!==stamp().split('/').slice(0,2).join('/')||revision!==now?.revision){closeModal();note('进度已更新，请重新查看后果。');return;}closeModal();run();}}]);}
  function effects(events:readonly DomainEvent[]){
    const strike=events.find(e=>e.type==='Strike'),delivered=events.find(e=>e.type==='Delivered');
    if(strike?.type==='Strike'){
      const names={success:'锻成',great:'大成',crack:'出现裂纹',broken:'断剑回收'};const last=strike.hits.at(-1);if(!last)return;
      const total=last.after-(strike.hits[0]?.before??last.after),triggers=[...new Set(strike.hits.flatMap(h=>h.triggers))];
      text('v3-result',`${strike.burst?'连锻 ×'+strike.hits.length+' · ':''}${names[last.result]} · 身价${total>=0?'+':''}${fmt(total)}${triggers.length?' · '+triggers.map(t=>TRAITS[t].name).join('、')+'触发':''}${last.result==='broken'?' · 已按底价回收金币':''}`);
      const chain=strike.hits.map(h=>`${fmt(h.before)} → ${fmt(h.after)}`).join(' / ');text('v3-float',chain);
      busy=true;const token=++effectToken;
      for(const [i,h] of strike.hits.entries())later(()=>{if(token!==effectToken||document.hidden)return;animate(find('v3-hammer'),[{transform:'translateY(-62px) rotate(-12deg)'},{transform:'translateY(24px)',offset:.35},{transform:'translateY(0)'}],180);for(const [j,spark]of sparks.entries())animate(spark,[{opacity:0,transform:'translate(0,0)'},{opacity:1,offset:.12},{opacity:0,transform:`translate(${(j-3)*22}px,${-30-Math.abs(j-3)*10}px) rotate(${j*35}deg)`}],h.result==='great'?380:230);audio.acceptedCue(h.result==='broken'?'broken':h.result==='crack'?'damage':h.result==='great'?'heavy':'standard');},i*185);
      animate(find('v3-float'),[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-28px)'}],strike.burst?650:380);
      later(()=>{if(token!==effectToken)return;busy=false;text('v3-float','');render();},strike.burst?650:280);
    }else if(delivered?.type==='Delivered'){
      text('v3-result',`已交差 ${fmt(delivered.amount)} · 目标和金币同时增加。`);audio.acceptedCue('delivery');find('v3-steam').classList.add('show');animate(find('v3-steam'),[{opacity:0,transform:'translateY(12px)'},{opacity:.8,offset:.3},{opacity:0,transform:'translateY(-50px)'}],500);chooseNext();later(()=>find('v3-steam').classList.remove('show'),500);
    }else if(events.some(e=>e.type==='Traded'||e.type==='Trait')){audio.acceptedCue('purchase');text('v3-result','手艺已带上，下一锤会按它的实际效果结算。');chooseNext();}
    else if(events.some(e=>e.type==='Recycled')){audio.acceptedCue('recycle');chooseNext();text('v3-result','已回收。这笔金币不计交差。');}
    else if(events.some(e=>e.type==='Settled')){audio.acceptedCue(snapshot.state?.history.at(-1)?.met?'met':'missed');}
    render();
  }
  function send(action:Action){
    if(!allowed()||busy)return false;const s=snapshot.state;if(!s)return false;
    const result=port.dispatch({runId:s.runId,expectedRevision:s.revision,action},snapshot.generation);
    if(!result.ok){note(ERROR[result.error]??'当前操作不可用，请查看剑与阶段。');render();return false;}
    note('');effects(result.events);return true;
  }
  function acquire(traitId:Trait|null,buy:boolean){
    const s=snapshot.state,b=current();if(!s||buy&&(!b||b.status!=='active'||b.id===s.reserveId))return;
    const pieceId=b?.id??'';
    const run=(replaceId?:Trait)=>send(buy?{type:'buy',pieceId,traitId:traitId!,...(replaceId?{replaceId}:{})}:{type:'claimGift',traitId,...(replaceId?{replaceId}:{})});
    if(s.traits.length===3&&traitId!==null){const body=element('div');body.append(element('p',`${TRAITS[traitId].name}：${TRAITS[traitId].text}${buy?` 将交出当前剑，放弃身价${fmt(b?.value??0)}。`:''}`));for(const old of s.traits){const x=element('button',`换下${TRAITS[old].name}：${TRAITS[old].text}`);x.onclick=()=>{closeModal();confirm('确认替换手艺',`换下${TRAITS[old].name}，带上${TRAITS[traitId].name}。${buy?'交出所选剑。':''}`,()=>run(old));};body.append(x);}openModal('三门已满，选择换下哪门',body,[{label:'保留原样',run:closeModal}]);}
    else if(buy)confirm('用这柄剑换手艺',`${TRAITS[traitId!].name}：${TRAITS[traitId!].text} 将交出第${b?.suppliedRound}轮的剑，放弃身价${fmt(b?.value??0)}，不再计交差。`,()=>run());else run();
  }
  function shop(){const s=snapshot.state;if(!s||!merchantPresent(s))return;const body=element('div',undefined,'v3-shop-grid');
    body.append(element('p','手艺用当前选中的剑交换。金币用来升级未来配给或修补印记。'));
    for(const id of s.shop){const card=element('article');card.append(element('h3',TRAITS[id].name),element('p',TRAITS[id].text));const owned=s.traits.includes(id)||s.sold.includes(id),b=current(),buy=element('button',owned?'已持有 / 已换取':`用当前剑交换 · 放弃${fmt(b?.value??0)}`);buy.disabled=owned||!b||b.status!=='active'||b.id===s.reserveId;buy.onclick=()=>{closeModal();acquire(id,true);};card.append(buy);body.append(card);}
    const upgrade=element('button',s.upgraded?'炉具本次已升级':`升级炉具 · ${fmt(upgradePrice(s.round))}金币`);upgrade.disabled=s.upgraded||s.coins<upgradePrice(s.round);upgrade.onclick=()=>{closeModal();confirm('提高未来配给底价',`支付${upgradePrice(s.round)}金币；从下一轮起底价翻倍。当前三柄不改变，前三轮体验本身不会发第4轮配给。`,()=>send({type:'upgrade'}));};body.append(upgrade);
    if(s.seals<3){const repair=element('button',`补一枚印记 · ${Math.ceil(quotaFor(s.round)/2)}金币`);repair.disabled=s.repaired||s.coins<Math.ceil(quotaFor(s.round)/2);repair.onclick=()=>{closeModal();confirm('修补契约印记',`支付${Math.ceil(quotaFor(s.round)/2)}金币，本轮商人最多修补一次。`,()=>send({type:'repair'}));};body.append(repair);}
    openModal('行脚商人的摊子',body,[{label:'回铁砧',run:closeModal}]);
  }
  function settle(){const s=snapshot.state;if(!s||s.phase!=='workshop')return;const p=settlementPreview(s),body=element('div');body.append(element('p',`交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))}。${p.met?'已经达标。':p.protected?'护炉契将保护这次失约。':`尚未达标，将扣一枚印记（${s.seals}→${p.sealsAfter}）。`}`));
    for(const b of p.remaining)body.append(element('p',`${b.id} · 当前身价${fmt(b.value)} → 按底价回收${recovery(b)}金币，不计交差。`));
    body.append(element('p',s.reserveId?`挂剑${s.reserveId}原样保留，其余回收共${p.recovered}金币。`:`没有挂剑保留，回收共${p.recovered}金币。`));confirm('确认收工',body,()=>send({type:'settle'}));}
  function start(confirmed=false,memory=false){const seed=seedDraft;const input={runId:`v3-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`,seed,roundLimit:3 as const},decision={generation:snapshot.generation,confirmed};
    const result=memory?port.useMemory(input,decision):port.startNewGame(input,decision);
    if(!result.ok&&result.error==='confirmation_required'){confirm('开始新契约',`将替换当前v0.4进度；可以先导出。旧v0.2/v0.3档保留。`,()=>start(true,memory));return;}
    if(!result.ok){note(ERROR[result.error]??'无法开始，请检查种子或保存状态。');return;}menu=false;paused=false;chooseNext();epoch++;render();text('v3-result','第一柄已就位。落一锤，看看它能值多少。');button('v3-strike').focus();}
  function screen(title:string,body:HTMLElement,actions:HTMLButtonElement[]){const key=JSON.stringify([title,menu,paused,snapshot.mode,snapshot.active,snapshot.generation,snapshot.conflict,snapshot.load?.main.status,snapshot.state?.runId,snapshot.state?.revision]);if(key===screenKey)return;screenKey=key;text('v3-screen-title',title);find('v3-screen-body').replaceChildren(body);find('v3-screen-actions').replaceChildren(...actions);}
  function actionButton(label:string,run:()=>void){const b=element('button',label);b.onclick=run;return b;}
  function render(){
    if(disposed)return;const s=snapshot.state,b=current();syncAudio();
    text('v3-round',s?`第 ${s.round} 轮 / 前三轮体验`:'新炉 · 前三轮体验');text('v3-target',s?`交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))}`:'十二轮契约 · 本版先体验前三轮');
    const progress=find<HTMLProgressElement>('v3-progress');progress.max=s?quotaFor(s.round):180;progress.value=s?.delivered??0;
    text('v3-wallet',s?`金币 ${fmt(s.coins)}　印记 ${'●'.repeat(s.seals)}${'○'.repeat(3-s.seals)}`:'金币 0　印记 ●●●');
    const main=snapshot.load?.main,backup=snapshot.load?.backup;
    const saved=snapshot.mode==='memory'?'本局不保存，请结束前导出':snapshot.conflict?'检测到另一窗口更改，当前进度未覆盖磁盘':snapshot.mode==='readonly'?'只读：另一窗口正在保存':!snapshot.active?'正在取得保存锁':snapshot.dirty?'保存失败，已接受进度仍在本页':main?.status==='invalid'?'主档无效或版本不支持，原字节保留':main?.status==='unavailable'?'无法读取主档，原字节保留':snapshot.lastSave?.ok&&snapshot.lastSave.backupWarning?'主档已保存；备份写入失败':'本地自动保存';
    text('v3-save-text',saved);button('v3-retry').hidden=!snapshot.dirty||snapshot.mode==='memory';button('v3-reread').hidden=!snapshot.conflict&&snapshot.mode!=='readonly';button('v3-recover').hidden=main?.status==='valid'||backup?.status!=='valid';button('v3-memory').hidden=!!s&&!snapshot.dirty&&!snapshot.conflict&&snapshot.mode==='writer';button('v3-export').disabled=!s;
    button('v3-pause').textContent=paused?'继续':'暂停';button('v3-pause').disabled=!s||menu||s.phase!=='workshop';
    const work=!!s&&s.phase==='workshop'&&!menu&&!paused;if(work)screenKey='';show('v3-workshop',work);show('v3-screen',!work);
    if(!work){const body=element('div');if(!s||menu){
      body.append(element('p','点击落锤就会增值。看到裂纹后，可以交差，也可以赌下一次连锻。'));
      const label=element('label','契约种子'),seed=element('input');seed.id='v3-seed';seed.maxLength=64;seed.value=seedDraft;seed.oninput=()=>{seedDraft=seed.value;};label.append(seed);body.append(label);
      const actions:HTMLButtonElement[]=[];if(s)actions.push(actionButton('返回当前进度',()=>{menu=false;render();}));
      const create=actionButton('开一炉新契约',()=>start());create.disabled=!snapshot.active||snapshot.mode!=='writer'||main?.status==='unavailable';actions.push(create,actionButton('不保存开一炉',()=>start(false,true)));
      const links=element('p');for(const [href,label] of [['/v2.html','继续旧版D细锻'],['/legacy.html','继续B版旧契约']]){const a=element('a',label);a.href=href??'';links.append(a,document.createTextNode('　'));}body.append(links);screen('锤下求生 · 行脚灯炉',body,actions);
    }else if(paused){body.append(element('p','准备中的锤击已取消，已经接受的身价和风险保留。'));screen('炉火暂歇',body,[actionButton('继续锻造',()=>togglePause())]);}
    else{const last=s.history.at(-1);body.append(element('p',last?`第${last.round}轮：交差${fmt(last.delivered)}/${fmt(last.quota)}，${last.met?'达标':last.protected?'护炉契保护':'未达标'}；印记${last.sealsBefore}→${last.sealsAfter}。`:'这轮结束了。'));
      if(last){body.append(element('p',`回收${last.recovered}金币；${last.reserveId?`挂剑${last.reserveId}保留`:'未留挂剑'}。`));}
      const table=element('table');for(const h of s.history){const tr=element('tr');for(const v of [`第${h.round}轮`,`${fmt(h.delivered)} / ${fmt(h.quota)}`,h.met?'达标':h.protected?'受保护':'失约'])tr.append(element('td',v));table.append(tr);}body.append(table);
      if(s.phase==='summary')screen('本轮收据',body,[actionButton('领取下一轮三柄剑',()=>{if(send({type:'advance'})){chooseNext();text('v3-result','新配给已就位。继续锤，还是先用一柄投资手艺？');render();button('v3-strike').focus();}})]);
      else{body.append(element('p',s.phase==='experienceComplete'?'前三轮体验已结束。这不是十二轮通关；你的剑、去向和构筑都来自实际操作。':'三枚印记用尽，可以换一种收手计划再来。'));screen(s.phase==='experienceComplete'?'前三轮体验结束':s.phase==='victory'?'十二轮契约完成':'契约终止',body,[actionButton('再开一炉',()=>{menu=true;render();}),actionButton('导出这次经历',exportSave)]);}
    }}
    if(s){
      const inventory=find('v3-inventory');inventory.replaceChildren();for(const p of s.blades.filter(p=>p.status==='active'&&p.id!==s.reserveId)){
        const x=actionButton(`${p.suppliedRound===s.round?'本轮':'上轮'} · ${fmt(p.value)}${p.cracked?' · 裂纹':''}`,()=>select(p.id));x.dataset.piece=p.id;x.setAttribute('aria-pressed',String(p.id===selectedId));x.disabled=!allowed()||busy;inventory.append(x);}
      if(!inventory.children.length)inventory.append(element('p','本轮可用剑已处理。'));
      const reserve=s.blades.find(p=>p.id===s.reserveId),slot=find('v3-reserve-slot');slot.replaceChildren();if(reserve){const x=actionButton(`${fmt(reserve.value)}${reserve.cracked?' · 裂纹':''} · 取下`,()=>{if(send({type:'reserve',pieceId:reserve.id}))select(reserve.id);});x.disabled=!allowed()||busy;slot.append(x);}else slot.append(element('p','空架 · 可留一柄跨轮'));
      text('v3-deficit',s.delivered>=quotaFor(s.round)?'今日已达标':`还差 ${fmt(quotaFor(s.round)-s.delivered)}`);text('v3-advice',s.delivered>=quotaFor(s.round)?'可以收工保住印记。剩下的剑，也能投资手艺或留给明天。':'交差才计入目标。不要把三柄都花在商人那里。');
      const traits=find('v3-traits');traits.replaceChildren();for(const id of s.traits){const p=element('p');p.append(element('b',TRAITS[id].name),element('small',TRAITS[id].text+(id==='pardon'&&s.pardonUsed?'（本局已用）':'')));traits.append(p);}if(!s.traits.length)traits.append(element('p','先落锤。首次达标后，可免费领一门手艺。'));
      const gift=find('v3-gift');gift.replaceChildren();if(s.gift==='available'){const claim=actionButton('首次达标 · 领一门免费手艺',()=>{const body=element('div'),options=(['steady','ember']as const).filter(id=>!s.traits.includes(id));for(const id of options){const x=actionButton(`${TRAITS[id].name} · ${TRAITS[id].text}`,()=>{closeModal();acquire(id,false);});body.append(x);}if(!options.length)body.append(actionButton('领取40金币',()=>{closeModal();acquire(null,false);}));openModal('带上一门手艺',body,[{label:'稍后领取',run:closeModal}]);});claim.disabled=!allowed()||busy;gift.append(claim);}
      button('v3-shop').hidden=!merchantPresent(s);button('v3-shop').disabled=!allowed()||busy;
    }
    const active=!!s&&!!b&&b.status==='active'&&b.id!==s.reserveId,forge=active&&!atCap(b!);
    text('v3-blade-name',b?`${b.id} · ${['铁坯','初开锋','火纹刃','金纹长刀','流火剑','灯炉名剑'][Math.min(5,Math.floor(b.level/3))]} +${b.level}${b.cracked?' · 已有裂纹':''}`:'铁砧空了');
    text('v3-value',b?fmt(b.value):'—');
    if(s&&b){const odds=strikeOdds(s,b);text('v3-risk',b.status==='broken'?'这把剑已断，请换下一柄':odds.burst?'连锻已就绪 · 本次无裂损':`${b.cracked?'再裂会断':'下一锤裂损'} ${odds.crack/10}%`);text('v3-risk-after',active?(odds.burst?`连锻后普通风险 ${odds.afterBurstCrack/10}%`:`大成 ${odds.great/10}% · ${b.cracked?'当前身价仍可交差':'首次裂损仍能保住剑'}`):'');
      find('v3-pips').replaceChildren(...Array.from({length:6},(_,i)=>element('i',undefined,i<b.charge?'charged':'')));text('v3-charge-text',`${b.charge}/6${odds.burst?' · 下一锤爆发':''}`);
    }else{text('v3-risk','这一轮，可以收工了');text('v3-risk-after','先查看收工去向，不会立即结算。');find('v3-pips').replaceChildren();text('v3-charge-text','');}
    const primary=button('v3-strike');primary.replaceChildren(document.createTextNode(!active?(s?.blades.some(p=>p.status==='active'&&p.id!==s.reserveId)?'换下一柄':'查看收工结果'):atCap(b!)?'已封顶 · 可以交差':b?.charge===6?'连锻！':'落锤'),element('small',active?'点击 / 空格松开 · 无需卡时机':'这一步不会继续锻打'));
    primary.disabled=!allowed()||(!forge&&active);primary.setAttribute('aria-busy',String(busy));
    button('v3-deliver').textContent=`交差 ${fmt(b?.value??0)}`;button('v3-deliver').disabled=!allowed()||busy||!active;
    button('v3-store').textContent=s?.reserveId?'交换挂剑':'留给下一轮';button('v3-store').disabled=!allowed()||busy||!active;
    button('v3-scrap').textContent=`回收 · ${b?recovery(b):0}金币`;button('v3-scrap').disabled=!allowed()||busy||!active;button('v3-settle').disabled=!allowed()||busy||s?.phase!=='workshop';
    const bladeKey=JSON.stringify(b);if(frameKey!==bladeKey&&work){frameKey=bladeKey;canvas.setAttribute('aria-label',b?`等级${b.level}，身价${b.value}，${b.status==='broken'?'断剑':b.cracked?'有裂纹':'完好'}`:'空铁砧');paintBlade(canvas,b,art.texture());}
    input?.refresh();
  }
  function togglePause(){if(!snapshot.state||snapshot.state.phase!=='workshop')return;paused=!paused;epoch++;input?.cancel();cancelEffects();render();if(!paused)button('v3-strike').focus();}
  input=bindStrikeInput(button('v3-strike'),{context:()=>{const s=snapshot.state,b=current();return allowed()&&!busy&&s?.phase==='workshop'&&b?.status==='active'&&b.id!==s.reserveId&&!atCap(b)?{runId:s.runId,revision:s.revision,generation:snapshot.generation,epoch,pieceId:b.id,mode:'standard',periodMs:1000,rulesVersion:s.rulesVersion}:null;},release:a=>{send({type:'strike',pieceId:a.identity.pieceId});},visual:v=>find('v3-hammer').classList.toggle('preparing',v.preparing)});
  button('v3-strike').onclick=e=>{const b=current();if(!allowed()||busy)return;if(!b||b.status!=='active'||b.id===snapshot.state?.reserveId){const next=snapshot.state?.blades.find(p=>p.status==='active'&&p.id!==snapshot.state?.reserveId);if(next)select(next.id);else settle();}else if(e.detail===0)send({type:'strike',pieceId:b.id});};
  button('v3-strike').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.repeat)e.preventDefault();});
  button('v3-deliver').onclick=()=>{const b=current();if(b&&send({type:'deliver',pieceId:b.id})){button('v3-strike').focus();}};
  button('v3-store').onclick=()=>{const b=current(),old=snapshot.state?.reserveId;if(b&&send({type:'reserve',pieceId:b.id})){if(old&&old!==b.id)selectedId=old;else chooseNext();render();button('v3-strike').focus();}};
  button('v3-scrap').onclick=()=>{const b=current();if(b)confirm('回收这柄剑',`放弃身价${fmt(b.value)}，只回收${recovery(b)}金币，不计目标。`,()=>send({type:'scrap',pieceId:b.id}));};
  button('v3-settle').onclick=settle;button('v3-shop').onclick=shop;button('v3-pause').onclick=togglePause;
  button('v3-menu').onclick=()=>{input?.cancel();cancelEffects();epoch++;menu=!menu;paused=false;render();};
  button('v3-retry').onclick=()=>{const r=port.retrySave(snapshot.generation);if(!r.ok)note(ERROR[r.error]??'仍未保存，请导出当前进度。');};
  button('v3-reread').onclick=()=>confirm('读取最新契约','将放弃本页尚未保存的更改，请先导出；读取只影响v0.4。',()=>{void port.activate().then(()=>{const r=port.resume({generation:port.getSnapshot().generation,confirmed:true});if(!r.ok)note(ERROR[r.error]??'无法读取最新主档。');chooseNext();render();});});
  button('v3-recover').onclick=()=>{const backup=snapshot.load?.backup;if(backup?.status!=='valid')return;confirm('恢复v0.4备份',`备份第${backup.state.round}轮、${backup.state.coins}金币，保存于${new Date(backup.savedAt).toLocaleString('zh-CN')}。确认后替换主档，可能回退最近一步。`,()=>{const r=port.recoverBackup({generation:snapshot.generation,confirmed:true});if(!r.ok)note(ERROR[r.error]??'恢复失败，原档保留。');else{menu=false;chooseNext();render();}});};
  button('v3-memory').onclick=()=>{if(snapshot.state){confirm('保留当前进度，不保存续玩','沿用当前剑和随机结果。磁盘档不会覆盖，结束前请导出。',()=>{port.useMemory(null,{generation:snapshot.generation,confirmed:true});render();});}else{menu=true;render();}};
  button('v3-export').onclick=exportSave;
  const muted=field('v3-muted'),volume=field('v3-volume'),motionField=field('v3-motion');muted.onchange=()=>preferences.update({muted:muted.checked});volume.oninput=()=>preferences.update({volume:Number(volume.value)});motionField.onchange=()=>{input?.cancel();cancelEffects();epoch++;preferences.update({reducedMotion:motionField.checked});render();};button('v3-settings-retry').onclick=()=>preferences.retry();
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  const gesture=()=>{if(!disposed){syncAudio();void audio.gesture();}};
  const hidden=()=>{if(document.hidden){input?.cancel();cancelEffects();epoch++;syncAudio();}else render();};
  const blur=()=>{input?.cancel();cancelEffects();epoch++;};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!modal&&!e.repeat){e.preventDefault();togglePause();}};
  const changedSettings=(e:StorageEvent)=>{if(e.key===SETTINGS_KEY||e.key===null)preferences.reload();};
  const resize=new ResizeObserver(()=>{frameKey='';render();});resize.observe(canvas);
  root.addEventListener('pointerdown',gesture,true);root.addEventListener('keydown',gesture,true);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',key);window.addEventListener('storage',changedSettings);
  const changeMotion=()=>{input?.cancel();cancelEffects();epoch++;render();};motion.addEventListener('change',changeMotion);
  const offPrefs=preferences.subscribe(value=>{prefs=value;muted.checked=value.value.muted;volume.value=String(value.value.volume);motionField.checked=value.value.reducedMotion;audio.configure(value.value);text('v3-preferences-state',value.problem?'设置未保存，可重试':'设置已保存');button('v3-settings-retry').hidden=!value.problem;});
  const offAudio=audio.subscribe(status=>text('v3-audio-state',({waiting:'点击后开启声音',ready:'声音已就绪',muted:'已静音',blocked:'声音未能开启，玩法仍可继续',unavailable:'音频不可用，玩法仍可继续'})[status]));
  const off=port.subscribe(value=>{const changed=snapshot.generation!==value.generation||snapshot.state?.runId!==value.state?.runId;snapshot=value;if(changed){input?.cancel();cancelEffects();epoch++;chooseNext();}if(!selectedId)chooseNext();render();});
  void port.activate().then(()=>{if(disposed)return;const s=port.getSnapshot();if(!s.state&&s.mode==='writer'&&s.load?.main.status==='empty'&&s.load.backup.status==='empty'){const r=port.startNewGame({runId:`v3-${Date.now()}`,seed:'行脚新炉',roundLimit:3},{generation:s.generation,confirmed:false});if(r.ok){chooseNext();render();button('v3-strike').focus();}}else{chooseNext();render();if(s.state)text('v3-result',`已续上第${s.state.round}轮，剑的身价、裂纹和锤势原样保留。`);}});
  return{async dispose(){disposed=true;off();offPrefs();offAudio();input?.dispose();cancelEffects();art.dispose();resize.disconnect();motion.removeEventListener('change',changeMotion);root.removeEventListener('pointerdown',gesture,true);root.removeEventListener('keydown',gesture,true);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',key);window.removeEventListener('storage',changedSettings);await Promise.all([port.dispose(),audio.dispose()]);if(root.firstElementChild===ownRoot)root.replaceChildren();}};
}
