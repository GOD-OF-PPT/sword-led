import type {DomainEvent,RunState} from '../core-v3/index.js';
import {atCap,quotaFor,TRAITS,merchantPresent} from '../core-v3/index.js';
import {element} from '../presentation/dom.js';
import {bladeAppearance} from './appearance.js';

export interface ForgeNotice {readonly kind:string;readonly title:string;readonly copy:string;readonly action:string;readonly target:'deliver'|'next'|'gift'|'shop'|'settle'|'review';readonly round:number;readonly revision:number;readonly pieceId?:string}
const fmt=(n:number)=>n.toLocaleString('zh-CN');
/** Only an accepted command can create an event. Ordinary hits never erase a decision. */
export function forgeNotice(events:readonly DomainEvent[],before:RunState,s:RunState):ForgeNotice|null{
 const base={round:s.round,revision:s.revision},strike=events.find(e=>e.type==='Strike');
 const make=(kind:string,title:string,copy:string,action:string,target:ForgeNotice['target'],pieceId?:string):ForgeNotice=>({...base,kind,title,copy,action,target,...(pieceId?{pieceId}:{})});
 if(strike?.type==='Strike'){
  const last=strike.hits.at(-1),b=s.blades.find(b=>b.id===strike.pieceId);if(!last||!b)return null;
  if(last.result==='broken')return make('broken','剑断了，炉火还在',`这柄曾值 ${fmt(b.peak)}，现已自动按底价回收。换下一柄，或摇铃结算；不能再交这柄剑。`,'换下一柄','next',b.id);
  if(last.result==='crack')return make('crack','裂纹出现 · 再裂就断',`那一记后身价 ${fmt(b.value)}，仍可交差。换剑或刷新不会重置风险；再裂会断。`,'查看交差选择','deliver',b.id);
  if(atCap(b))return make('masterwork','名器已成 · 可以收手了',`身价 ${fmt(b.value)}，已不能继续增值。交给来客，或留一柄作为下一轮的保险。`,'查看交差选择','deliver',b.id);
  if(strike.burst)return make('burst',`安全连锻 · ${strike.hits.length} 锤完成`,`身价 ${fmt(strike.hits[0]!.before)} → ${fmt(b.value)}。连锻结束，接下来恢复普通裂损风险。`,'查看当前炉程','review',b.id);
  if(b.charge===6)return make('ready','六格锤势已满！','下一次左键将触发安全连锻，无需换工具。连锻后，原来的普通裂损风险仍在。','回剑身连锻','next',b.id);
  const missing=Math.max(0,quotaFor(s.round)-s.delivered);
  if(missing>0&&b.value>=missing&&(before.blades.find(p=>p.id===b.id)?.value??0)<missing)return make('enough','这一柄，已经够交差',`那一记后身价 ${fmt(b.value)}，已够补上当时缺口 ${fmt(missing)}。身价还在剑上，最新报价见交差按钮。`,'查看交差选择','deliver',b.id);
  return null;
 }
 const delivery=events.find(e=>e.type==='Delivered');
 if(delivery?.type==='Delivered'){
  const met=s.delivered>=quotaFor(s.round)&&before.delivered<quotaFor(s.round);
  return make(met?'met':'delivery',met?'今日达标 · 印记保住了':`交差入账 +${fmt(delivery.amount)}`,met?`交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))}。余剑可以留一柄；${s.gift==='available'?'左下有一门免费手艺待领。':'准备好就摇铃收工。'}`:`金币与目标同时增加。今天还差 ${fmt(Math.max(0,quotaFor(s.round)-s.delivered))}，继续下一柄或取用留剑。`,met&&s.gift==='available'?'领取免费手艺':met?'查看收工后果':'继续下一柄',met&&s.gift==='available'?'gift':met?'settle':'next');
 }
 const trait=events.find(e=>e.type==='Trait');
 if(trait?.type==='Trait')return make('trait',trait.traitId?`${TRAITS[trait.traitId].name} · 已带上`:'补给已入账',trait.traitId?TRAITS[trait.traitId].text:'两门赠品都已持有，40金币已到账。','查看成长','review');
 if(events.some(e=>e.type==='Upgraded'))return make('upgrade','炉具升级 · 下轮来料更好',`新配给底价 ${fmt(before.base)} → ${fmt(s.base)}。当前剑不变，投入会在下一轮发配时兑现。`,'查看成长','review');
 if(events.some(e=>e.type==='Repaired'))return make('repair','契约印记已修补',`保有印记 ${before.seals} → ${s.seals}。这次付款已保存。`,'查看炉程','review');
 if(events.some(e=>e.type==='Advanced'))return make([3,6,9].includes(s.round)?'merchant':'round',[3,6,9].includes(s.round)?'行脚商人到场了！':`第 ${s.round} 轮 · 新铁入炉`,`三柄新配给，目标 ${fmt(quotaFor(s.round))}。${[3,6,9].includes(s.round)?'用一柄剑换手艺，或用金币升级下一轮来料。':'留剑的身价与风险原样继承。'}`,[3,6,9].includes(s.round)?'看看商人的货':'查看本轮安排',[3,6,9].includes(s.round)?'shop':'review');
 const reserve=events.find(e=>e.type==='Reserved');
 if(reserve?.type==='Reserved')return make('reserve',s.reserveId===reserve.pieceId?'好剑归架 · 留给下一轮':'留剑已取下','身价、裂纹和锤势原样保留。挂剑只占一个位置，不会额外发一柄新剑。','查看本炉记录','review');
 if(events.some(e=>e.type==='Recycled'))return make('recycle','已回收 · 只收金币','这柄剑不再计入交差目标。余剑和印记仍可在炉程中查看。','继续下一柄','next');
 return null;
}

export function createForgeNotices(node:HTMLElement,button:HTMLButtonElement,act:(notice:ForgeNotice)=>void){
 let identity='',current:ForgeNotice|null=null,acknowledged=true,visible=false,animation:Animation|null=null;
 const history:ForgeNotice[]=[];
 const copy=element('div'),title=element('b'),body=element('p'),actions=element('div'),go=element('button'),dismiss=element('button','收起');
 copy.setAttribute('role','status');copy.setAttribute('aria-live','polite');copy.setAttribute('aria-atomic','true');copy.append(title,body);actions.append(go,dismiss);node.append(copy,actions);
 function stop(){animation?.cancel();animation=null;}
 function paint(){node.hidden=!visible||!current||acknowledged;button.dataset.unread=String(!!current&&!acknowledged);button.textContent=current&&!acknowledged?'炉程 · 新':'炉程';if(current){node.dataset.event=current.kind;go.textContent=current.action;dismiss.setAttribute('aria-label',`收起${current.title}提示`);}}
 go.onclick=()=>{const n=current;if(n)act(n);};dismiss.onclick=()=>{acknowledged=true;stop();paint();button.focus({preventScroll:true});};
 return{
  identify(run:string){if(identity===run)return;identity=run;current=null;acknowledged=true;history.length=0;stop();title.textContent='';body.textContent='';paint();},
  push(notice:ForgeNotice,reduced:boolean){current=notice;history.unshift(notice);history.splice(12);acknowledged=false;title.textContent=notice.title;body.textContent=notice.copy;stop();paint();if(visible&&!reduced&&!document.hidden)animation=node.animate([{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'});},
  render(show:boolean){visible=show;if(!show)stop();paint();},
  entries:()=>[...history],stop,
  dispose(){stop();history.length=0;go.onclick=null;dismiss.onclick=null;},
 };
}

/** Saved facts, not a fabricated strike history. Works even after refreshing the page. */
export function forgeJourney(s:RunState,notices:readonly ForgeNotice[],route:HTMLElement){
 const body=element('section',undefined,'v3-forge-journey'),ended=s.phase!=='workshop'&&s.phase!=='summary',next=[3,6,9].find(r=>r>s.round&&r<=s.roundLimit);
 body.append(element('h3',s.roundLimit===3?'三轮练手 · 学会收手':'十二轮契约 · 守住行脚灯炉'),element('p',s.roundLimit===3?'第三轮收工即结束练手；完整十二轮需要另开契约。':'每轮三柄铁坯。用交差填满目标，未达标扣印记；保住印记走到第十二轮。'),route);
 body.append(element('h3','眼下这一炉'),element('p',`第 ${s.round}/${s.roundLimit} 轮 · 交差 ${fmt(s.delivered)} / ${fmt(quotaFor(s.round))} · 印记 ${s.seals}/3`),element('p',ended?'本局契约已结束，已保存的经历可以继续回顾。':merchantPresent(s)?'商人正在炉边。收工后本轮商人离开。':next?`下一次商人：第 ${next} 轮。`:'本局后面没有商人。'),element('h3','已经获得的成长'),element('p',`来料底价 ${fmt(s.base)} · 炉具升级 ${s.journal.filter(a=>a.type==='upgrade').length} 次 · 已带手艺 ${s.traits.length}/3`));
 if(s.traits.length)for(const id of s.traits)body.append(element('p',`${TRAITS[id].name}：${TRAITS[id].text}`));
 if(notices.length){const list=element('ol');body.append(element('h3','本次打开页面后的重要事件'));for(const n of notices)list.append(element('li',`第${n.round}轮 · ${n.title}。${n.copy}`));body.append(list);}
 body.append(element('h3','已保存的经历'));const facts=element('ol');
 for(const h of s.history)facts.append(element('li',`第${h.round}轮 · ${h.met?'达标':h.protected?'护印':'失约'} · ${fmt(h.delivered)}/${fmt(h.quota)} · 剩${h.sealsAfter}枚印记`));
 for(const b of s.blades.filter(b=>b.status!=='active'))facts.append(element('li',`第${b.finalizedRound??b.suppliedRound}轮 · ${bladeAppearance(b).name} · ${{delivered:'交差',broken:'断剑回收',recycled:'主动回收',traded:'换得手艺'}[b.status as Exclude<typeof b.status,'active'>]} · 最高身价 ${fmt(b.peak)}`));
 if(!facts.children.length)facts.append(element('li','第一炉已点火，三柄铁坯就位。还没有已结算的经历。'));body.append(facts);return body;
}
