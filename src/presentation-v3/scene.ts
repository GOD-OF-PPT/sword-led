import type {Blade,RunState} from '../core-v3/index.js';
import {atCap,merchantPresent,quotaFor} from '../core-v3/index.js';
import {element} from '../presentation/dom.js';
import {bladeAppearance} from './appearance.js';

export function workshopHint(s:RunState,b:Blade|null){
 const active=b?.status==='active'&&b.id!==s.reserveId,missing=Math.max(0,quotaFor(s.round)-s.delivered);
 if(!active)return{title:'铁砧歇一歇',copy:s.reserveId?'取下留剑再打造，或摇铃收工，查看这一轮的去向。':'左键换下一柄；没有余剑时，摇铃查看收工结果。',target:'v3-settle'};
 if(atCap(b))return{title:'名器已成',copy:'这柄剑已经封顶。交差把身价变成收入，或挂起保留。',target:'v3-deliver'};
 if(b.charge===6)return{title:'锤势已满 · 安全连锻',copy:'仍用鼠标左键。一口气落下安全锤；结束后原来的风险还在。',target:'v3-strike'};
 if(b.cracked)return{title:'裂纹不会自己消失',copy:'现在交差仍能收下这笔身价；再出现一次裂损，这柄剑就会断。',target:'v3-deliver'};
 if(missing===0)return{title:s.gift==='available'?'委托已成 · 带上新手艺':'今日委托已成',copy:s.gift==='available'?'左下方可免费领手艺。余剑也能挂起，为明天留一手。':merchantPresent(s)?'剩下的剑可交差、留到明天，或向商人换一门手艺。':'可以摇铃收工，也可以留一柄剑或继续争取更高身价。',target:s.gift==='available'?'v3-gift':'v3-settle'};
 if(b.value>=missing)return{title:'这一柄，足够交差',copy:`交差即可补上今天还差的 ${missing.toLocaleString('zh-CN')}。收手，还是继续锻得更好？`,target:'v3-deliver'};
 if(s.round===1&&b.hits===0&&!s.journal.some(a=>a.type==='strike'))return{title:'第一锤 · 左键点剑身',copy:'无需长按或卡时机。先让铁坯增值，再决定什么时候收手。',target:'v3-hit'};
 if(s.round===1&&!s.journal.some(a=>a.type==='deliver'))return{title:'身价在剑上，交差才入账',copy:'继续落锤积攒身价；交差同时填订单、收金币。前三次普通锤没有裂损。',target:'v3-hit'};
 return{title:merchantPresent(s)?'行脚商人已到炉边':'再锤一记，还是收手？',copy:merchantPresent(s)?'手艺要用一柄剑交换，金币则能升级未来来料或补印记。':'看好下方裂损风险。交差保住今天，挂剑为下一轮留后手。',target:merchantPresent(s)?'v3-shop':'v3-hit'};
}
export function journey(s:RunState){
 const line=element('ol',undefined,'v3-journey');line.setAttribute('aria-label','本局契约旅程');
 for(let round=1;round<=s.roundLimit;round++){const history=s.history.find(h=>h.round===round),node=element('li',String(round));node.className=[history?(history.met?'met':history.protected?'protected':'missed'):'',round===s.round?'current':'',[3,6,9].includes(round)?'merchant':''].join(' ');node.setAttribute('aria-label',`第${round}轮${history?history.met?'已达标':history.protected?'护印':'失约':round===s.round?'当前':''}${[3,6,9].includes(round)?'，商人到访':''}`);line.append(node);}return line;
}
const STATUS={active:'挂剑保留',delivered:'已交差',recycled:'已回收',broken:'断剑回收',traded:'换得手艺'}as const;
export function bladeCard(b:Blade){const figure=element('figure',undefined,'v3-story-blade'),canvas=element('canvas'),caption=element('figcaption');canvas.dataset.storyPiece=b.id;canvas.setAttribute('aria-hidden','true');caption.append(element('b',bladeAppearance(b).name),element('small',`${STATUS[b.status]} · ${b.status==='broken'?`曾达${b.peak.toLocaleString('zh-CN')}`:b.value.toLocaleString('zh-CN')}`));figure.append(canvas,caption);return figure;}
export function roundStory(s:RunState){
 const last=s.history.at(-1),body=element('section',undefined,'v3-round-story');if(!last)return body;
 const stamp=element('b',last.met?'委托达成':last.protected?'护印保全':'此次失约','v3-receipt-stamp');stamp.dataset.verdict=last.met?'met':last.protected?'protected':'missed';body.append(stamp);
 const pieces=element('div',undefined,'v3-story-pieces');for(const b of s.blades.filter(b=>b.suppliedRound===last.round||b.finalizedRound===last.round||b.id===last.reserveId))pieces.append(bladeCard(b));body.append(pieces);return body;
}
export function endStory(s:RunState){const hero=element('section',undefined,'v3-end-hero'),best=[...s.blades].sort((a,b)=>b.peak-a.peak)[0];hero.append(element('p',s.phase==='victory'?'炉火未熄 · 十二轮的作品留在这里':s.phase==='defeat'?'炉火可再燃 · 带着这次的经验再来':'三轮练手收炉 · 还有一段长路'));if(best){hero.append(bladeCard(best),element('small',`本局最高身价 ${best.peak.toLocaleString('zh-CN')} · 造型来自实际锻造`));}return hero;}
export function helpStory(){const help=element('div',undefined,'v3-help-story');for(const[number,title,copy]of [['一','左键锻造','点中央剑身即可落锤。普通成功涨价，大成涨得更多；六格锤势换来安全连锻。'],['二','决定收手','交差填主契约并收金币。来客只作建议，合意成品自动记入手札；留一柄剑可跨轮作保险。'],['三','经营炉火','第3、6、9轮商人到场：用剑换手艺，用金币升级或补印记。摇铃收工前会先列清所有后果。']]){const step=element('section');step.append(element('i',number),element('h3',title),element('p',copy));help.append(step);}return help;}
