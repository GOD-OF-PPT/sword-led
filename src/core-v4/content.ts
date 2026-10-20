import {freezeDeep} from '../core/immutable.js';
import type {Commission,Recipe,Modification,EventId,Trait} from './model.js';
export {TRAITS} from '../core-v3/rules.js';
export const TRAIT_IDS:readonly Trait[]=Object.freeze(['steady','ember','inherit','echo','crackedEdge','pardon']);
export const RECIPE_IDS:readonly Recipe[]=Object.freeze(['light','guard','heavy']);
export const MODIFICATION_IDS:readonly Modification[]=Object.freeze(['windbox','warmRack','wideMouth']);
export const EVENT_IDS:readonly EventId[]=Object.freeze(['donation','loan','salvage','credit','shelter','rest']);
export const RECIPES=freezeDeep({
 light:{name:'轻刃',success:155,great:210,greatOdds:150,cracks:[80,120,180,260,340,420,500,550,600]},
 guard:{name:'护刃',success:140,great:195,greatOdds:150,cracks:[30,50,80,120,180,240,320,400,480]},
 heavy:{name:'重锋',success:145,great:240,greatOdds:200,cracks:[60,100,150,220,300,380,460,540,600]},
});
export const MODIFICATIONS=freezeDeep({
 windbox:{name:'风箱',text:'每柄首次普通大成，额外增加10%身价；从下一天起生效。'},
 warmRack:{name:'余温架',text:'唯一留剑跨天增加15%身价，裂纹和锤势原样保留。'},
 wideMouth:{name:'宽口炉',text:'每柄第一次安全连锻多一记，可与炉心余烬叠加。'},
});
export const CHAPTERS=freezeDeep([
 {id:1,title:'第一章 · 灯从炉起',days:[1,4],base:40,opening:'山路第一盏灯熄了。阿岚把旧巡剑放到铁砧旁：先让巡夜的人回家。',letter:'阿禾捎来第一封信：驿路有人等灯，也有人等一把好剑。',success:'渡口亮起第一列灯，巡守与信使终于能在桥头碰面。',failure:'渡口还没有完全守住。你带着未完成的委托继续上路，炉火仍在。'},
 {id:2,title:'第二章 · 风雪同行',days:[5,8],base:80,opening:'山路渐陡。留下的旧剑、新学的手艺，都要在风雪里派上用场。',letter:'杜伯说，裂纹也能记住炉火。阿禾却要两柄轻剑，分给两条驿路。',success:'双驿的灯先后回应，雪中的救援队看见了归路。',failure:'双驿仍有一条路未通。已救回的人与遗憾，都记在这本炉谱里。'},
 {id:3,title:'第三章 · 山口守灯',days:[9,12],base:160,opening:'最后一位商人在山口等候。决定带上什么，再锻最后几炉。',letter:'阿岚守着缺口，阿禾赶来接力。杜伯等一柄真正能留名的护灯剑。',success:'护灯剑送到山口，三人的灯火终于相连。',failure:'山口仍有未完成的事。好剑与遗憾会一同陪你归来。'},
]);
export const MERCHANTS=freezeDeep([
 {day:3,upgrade:180,repair:150,pool:['steady','ember','echo']as readonly Trait[]},
 {day:6,upgrade:700,repair:350,pool:['inherit','crackedEdge','pardon']as readonly Trait[]},
 {day:9,upgrade:1600,repair:800,pool:['steady','ember','inherit','echo','crackedEdge','pardon']as readonly Trait[]},
]);
export const EVENTS=freezeDeep({
 donation:{name:'护送捐剑',request:'巡守愿替你护送下一批铁料，代价是一柄现在能带走的剑。',cost:[0,0,0],piece:'active',result:'这柄剑交给护送队。下一天的三个铁坯底价增加20%。'},
 loan:{name:'借锤',request:'杜伯愿借出老锤。付60金币，让明天第一柄前三记普通锤的正收益额多10%。',cost:[60,60,60],piece:'none',result:'借锤的钱已记清，明日第一柄会带上这份手感。'},
 salvage:{name:'旧刃回收',request:'行商愿用160金币换走架上的旧剑。交出去，就没有这柄旧剑可作下一轮委托。',cost:[0,0,0],piece:'reserve',result:'160金币入袋，旧剑离开剑架，不再兼作交差或保险。'},
 credit:{name:'商人赊护',request:'付清护炉钱，下一次完好剑出现裂纹时保住身价；再次裂损仍会断。',cost:[90,180,360],piece:'none',result:'保价资格已备好。下一次首次裂损会消耗，不会恢复断剑。'},
 shelter:{name:'雨夜修棚',request:'花80金币修好炉棚，明天第一柄在当天的裂损率降低3个百分点。',cost:[80,80,80],piece:'none',result:'炉棚补好了。明天第一柄能少受一点风雨，之后不再额外生效。'},
 rest:{name:'守炉',request:'今夜不添交易。守着炉火，保留眼前的剑与金币。',cost:[0,0,0],piece:'none',result:'没有额外得失，这一炉的选择原样保留。'},
});
export const COMMISSIONS:readonly Commission[]=freezeDeep([
 {id:1,title:'巡夜第一灯',customer:'guard',name:'阿岚',request:'巡夜的人要一柄无裂新剑，先点亮归家的第一站。',success:'阿岚点亮第一座灯站，巡夜的人看见了家门。',failure:'第一站还在等可靠的新剑。',scene:'night-watch',routes:[{id:'intact',count:1,value:100,crack:'intact'}]},
 {id:2,title:'重开驿路',customer:'courier',name:'阿禾',request:'四记普通锤内的无裂轻刃，跑山路才轻快。',success:'阿禾带轻刃穿过驿路，第一封信准时送达。',failure:'驿路还没有等到轻快的剑。',scene:'courier-road',routes:[{id:'light',count:1,value:160,recipe:'light',crack:'intact',maxHits:4}]},
 {id:3,title:'修炉试锋',customer:'smith',name:'杜伯',request:'让一柄剑经历一次安全连锻，看看这座炉的火候。',success:'杜伯听过成品的回响，替你重新接好了炉火。',failure:'这次还没有交出连锻的成品。',scene:'rekindle',routes:[{id:'burst',count:1,value:260,minBursts:1}]},
 {id:4,title:'守住渡口',customer:'guard',name:'阿岚',request:'渡口需要一柄无裂护刃，守住来往的人。',success:'护刃送上桥头，渡口恢复了巡守。',failure:'渡口仍有缺口，阿岚把未竟的事记在纸上。',scene:'bridge',routes:[{id:'guard',count:1,value:360,recipe:'guard',crack:'intact'}]},
 {id:5,title:'故剑归程',customer:'courier',name:'阿禾',request:'带一柄昨日留下的旧剑；若没有，就用更好的新剑接替。',success:'一柄剑接住了前一程的约定，阿禾又能赶路。',failure:'这一程的旧剑与新剑都还差一点。',scene:'returning-blade',routes:[{id:'old',count:1,value:420,age:'old'},{id:'new',count:1,value:630,age:'new'}]},
 {id:6,title:'逆火修行',customer:'smith',name:'杜伯',request:'带裂纹也能成器，锻一柄有故事的剑。',success:'杜伯接过裂剑：它记得你何时肯收手。',failure:'裂纹的手艺还需下一炉。',scene:'cracked-work',routes:[{id:'cracked',count:1,value:520,crack:'cracked'}]},
 {id:7,title:'救援重锋',customer:'guard',name:'阿岚',request:'救援队要重锋，劈开山路上的阻碍。',success:'重锋开出救援道，山里的灯又亮了一站。',failure:'救援道还没有完全打开。',scene:'rescue',routes:[{id:'heavy',count:1,value:760,recipe:'heavy'}]},
 {id:8,title:'风雪双驿',customer:'courier',name:'阿禾',request:'两条驿路，两柄各自合格的无裂轻刃。',success:'两柄轻刃分赴双驿，雪中的灯彼此回应。',failure:'双驿尚未全部接通，不能把一柄剑算作两柄。',scene:'twin-stations',routes:[{id:'two-light',count:2,value:420,recipe:'light',crack:'intact'}]},
 {id:9,title:'炉火回响',customer:'smith',name:'杜伯',request:'让一柄剑经历两次安全连锻，再听一次炉火回响。',success:'两次连锻的锻纹交在一起，杜伯记下了这门手艺。',failure:'两次炉火的成品还未交出。',scene:'double-fire',routes:[{id:'two-bursts',count:1,value:1000,minBursts:2}]},
 {id:10,title:'缺口之剑',customer:'guard',name:'阿岚',request:'带裂护刃也可守缺口，或用更高身价的完好护刃。',success:'阿岚把护刃举在缺口前，身后的人继续前行。',failure:'缺口尚未补上，这次的风险与收手都留在记录中。',scene:'mountain-gap',routes:[{id:'cracked',count:1,value:1150,recipe:'guard',crack:'cracked'},{id:'intact',count:1,value:1800,recipe:'guard',crack:'intact'}]},
 {id:11,title:'最后的接力',customer:'courier',name:'阿禾',request:'一柄同行的旧剑，或两柄新剑，接完最后一程。',success:'阿禾把剑交到接力的人手里，山口已在眼前。',failure:'接力还缺最后的一柄，归程也会记住这件事。',scene:'relay',routes:[{id:'old',count:1,value:1300,age:'old'},{id:'two-new',count:2,value:850,age:'new'}]},
 {id:12,title:'山口护灯',customer:'smith',name:'杜伯',request:'无裂名器重锋，送到山口，护住最后的灯。',success:'护灯剑送到山口，三人抬头看见了相连的灯火。',failure:'护灯剑还没有完成，不能说十二灯已经复明。',scene:'last-lantern',routes:[{id:'finale',count:1,value:2500,recipe:'heavy',crack:'intact',minLevel:9}]},
]);
export const ENDINGS=freezeDeep({
 victory:{title:'十二灯复明',text:'关键的剑都送到了，十二站的灯在归路上依次亮起。'},
 return:{title:'灯下归途',text:'炉火还在，有些约定仍未完成。带着这次的作品与手艺再上路。'},
 defeat:{title:'炉火暂熄',text:'契约印记用尽了。已经做成的作品与学会的炉谱会留下。'},
});
