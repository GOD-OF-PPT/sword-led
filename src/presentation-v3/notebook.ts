import type {Blade,RunState} from '../core-v3/index.js';
import {quotaFor} from '../core-v3/index.js';
import {hashUtf8} from '../core/random.js';

/** Presentation only: no commands, new rewards, saved fields, or random draws. */
export type NotebookKind='debut'|'light'|'burst'|'return'|'cracked'|'masterwork'|'doubleBurst'|'finale';
export type CustomerId='guard'|'courier'|'smith';
export interface CustomerRequest {readonly round:number;readonly kind:NotebookKind;readonly title:string;readonly customer:CustomerId;readonly name:string;readonly motive:string;readonly condition:string;readonly target:number}
export interface BladeAssessment {readonly matches:boolean;readonly canDeliver:boolean;readonly target:number;readonly condition:string;readonly reason:string}
export interface NotebookWork {readonly round:number;readonly request:CustomerRequest;readonly blade:Blade;readonly condition:string}
export interface NotebookPage {readonly round:number;readonly status:'work'|'missed'|'today'|'tomorrow'|'unseen';readonly request:CustomerRequest|null;readonly work:NotebookWork|null}
export interface NotebookView {readonly current:CustomerRequest;readonly next:CustomerRequest|null;readonly works:readonly NotebookWork[];readonly currentWork:NotebookWork|null;readonly pages:readonly NotebookPage[];readonly title:string}

const details:Readonly<Record<NotebookKind,{title:string;customer:CustomerId;name:string;motive:string}>>=Object.freeze({
 debut:{title:'出锋',customer:'guard',name:'阿岚',motive:'巡夜的路，想带一柄可靠的新剑。'},
 light:{title:'轻鸣',customer:'courier',name:'阿禾',motive:'山路很长，想要轻快又利落的剑。'},
 burst:{title:'炉心',customer:'smith',name:'杜伯',motive:'想看看这一炉火，能把剑锻成什么模样。'},
 return:{title:'归来',customer:'courier',name:'阿禾',motive:'想带走一柄，陪你走过一程的旧剑。'},
 cracked:{title:'逆火',customer:'guard',name:'阿岚',motive:'留下裂纹也无妨，险路需要有故事的剑。'},
 masterwork:{title:'留名',customer:'smith',name:'杜伯',motive:'若还有余力，锻一柄值得留下名字的剑吧。'},
 doubleBurst:{title:'复炉',customer:'smith',name:'杜伯',motive:'愿再等一炉，看看两次炉火的成品。'},
 finale:{title:'灯炉终章',customer:'smith',name:'杜伯',motive:'这一程将尽，想把最好的作品记在册上。'},
});
const middle:readonly (readonly NotebookKind[])[]=[
 ['return','cracked','masterwork','light','return','cracked','doubleBurst','masterwork'],
 ['cracked','return','light','masterwork','cracked','doubleBurst','return','masterwork'],
 ['masterwork','light','return','cracked','doubleBurst','masterwork','return','cracked'],
 ['light','masterwork','cracked','return','masterwork','doubleBurst','cracked','return'],
];
const fmt=(n:number)=>n.toLocaleString('zh-CN');
const terminal=(s:RunState)=>['victory','defeat','experienceComplete'].includes(s.phase);
const cache=new WeakMap<RunState,NotebookView>();

/** The final breaking ordinary hit adds one, never a whole six-charge cycle. */
export const burstCommands=(b:Blade)=>Math.floor((b.hits-b.charge)/6);
export const normalSupplyBase=(s:RunState,b:Blade)=>s.blades.find(p=>p.id===`r${b.suppliedRound}-2`)?.base??null;
function kindAt(s:RunState,round:number):NotebookKind{
 if(round<=3)return(['debut','light','burst']as const)[round-1]!;
 if(round===12)return'finale';
 return middle[hashUtf8(`${s.seed}|notebook-v1`)%4]![round-4]!;
}
function targetFor(s:RunState,kind:NotebookKind,round:number,b?:Blade):number{
 if(kind==='light'){
  const normal=b?normalSupplyBase(s,b):s.blades.find(p=>p.id===`r${round}-2`)?.base??s.base;
  return normal===null?0:Math.ceil(normal*36/10);
 }
 return quotaFor(round)*(kind==='masterwork'||kind==='finale'?2:1/2);
}
function condition(kind:NotebookKind,target:number){
 const value=`身价≥${fmt(Math.ceil(target))}`;
 switch(kind){
  case'debut':return`无裂 · 叠纹 · ${value}`;
  case'light':return`三锤内叠纹 · 无裂 · ${value}`;
  case'burst':return`一次连锻 · ${value}`;
  case'return':return`同行过一轮的旧剑 · ${value}`;
  case'cracked':return`带裂纹 · ${value}`;
  case'masterwork':return value;
  case'doubleBurst':return`两次连锻 · ${value}`;
  case'finale':return`无裂 · 名器 · ${value}`;
 }
}
export function requestFor(s:RunState,round:number):CustomerRequest|null{
 if(!Number.isInteger(round)||round<1||round>s.roundLimit)return null;
 const kind=kindAt(s,round),target=Math.ceil(targetFor(s,kind,round));
 const line=kind==='light'?`三锤内叠纹 · 无裂 · 新坯参考≥${fmt(target)}`:condition(kind,target);
 return Object.freeze({round,kind,...details[kind],target,condition:line});
}
export function assessBlade(s:RunState,b:Blade,request:CustomerRequest):BladeAssessment{
 const {kind,round}=request,target=Math.ceil(targetFor(s,kind,round,b)),line=condition(kind,target);
 let reason='';
 if(b.status==='broken')reason='这柄已断，可换一柄或先保住契约。';
 else if(b.status!=='active'&&b.status!=='delivered')reason='这柄已交给别处，可换一柄再看。';
 else if(kind==='light'&&normalSupplyBase(s,b)===null)reason='来料记录不完整，先查看当前契约。';
 else if(kind==='light'&&b.hits>3)reason='这柄已超过三锤，可先交契约或换一柄。';
 else if(['debut','light','finale'].includes(kind)&&b.cracked)reason='来客想要无裂纹的剑，可以换一柄再看。';
 else if(kind==='return'&&b.suppliedRound>=round)reason=s.blades.some(p=>p.status==='active'&&p.suppliedRound<round)?'这是新剑，换用那柄同行过的旧剑。':'这次没有可用旧剑，可以先保住契约。';
 else if(kind==='cracked'&&!b.cracked)reason='来客想看带裂纹的作品，不必为了它放弃主契约。';
 else if((kind==='debut'||kind==='light')&&b.level<3)reason='还未叠纹，先看看这柄剑如何长成。';
 else if(kind==='finale'&&b.level<9)reason='还未锻至名器，可以先完成主契约。';
 else if((kind==='burst'||kind==='doubleBurst')&&burstCommands(b)<(kind==='burst'?1:2))reason=`还需${(kind==='burst'?1:2)-burstCommands(b)}次连锻，风险仍按原样保留。`;
 else if(b.value<target)reason=kind==='light'&&b.hits===3?'三锤内身价不足，可先交契约或换一柄。':`还差 ${fmt(target-b.value)} 身价，是否继续由你决定。`;
 const matches=!reason,canDeliver=b.status==='active'&&b.id!==s.reserveId;
 return Object.freeze({matches,canDeliver,target,condition:line,reason:reason||(b.status==='delivered'?'这柄已交差，可在手札回顾。':b.id===s.reserveId?'这柄合意，取下留剑后可交差。':'这柄合意，交差后可记入手札。')});
}
export function notebookTitle(count:number,length:3|12){
 if(length===3)return`练手 ${count}/3`;
 return count===12?'灯炉留名':count>=9?'灯炉':count>=6?'匠作':count>=3?'行脚':'初炉';
}
export function getNotebook(s:RunState):NotebookView{
 const cached=Object.isFrozen(s)?cache.get(s):undefined;if(cached)return cached;
 const pieces=new Map(s.blades.map(b=>[b.id,b])),byRound=new Map<number,NotebookWork>();
 // Finalized blades are immutable. Their accepted delivery order identifies the first matching work.
 for(const action of s.journal){
  if(action.type!=='deliver')continue;const b=pieces.get(action.pieceId);
  if(!b||b.status!=='delivered'||b.finalizedRound===null||byRound.has(b.finalizedRound))continue;
  const request=requestFor(s,b.finalizedRound);if(!request)continue;const assessment=assessBlade(s,b,request);if(!assessment.matches)continue;
  const actualRequest=Object.freeze({...request,target:assessment.target,condition:assessment.condition});
  byRound.set(request.round,Object.freeze({round:request.round,request:actualRequest,blade:Object.freeze({...b}),condition:assessment.condition}));
 }
 const works=Object.freeze([...byRound.values()].sort((a,b)=>a.round-b.round));
 const pages=Object.freeze(Array.from({length:s.roundLimit},(_,index):NotebookPage=>{
  const round=index+1,work=byRound.get(round)??null,status=work?'work':s.history.some(h=>h.round===round)?'missed':round===s.round?'today':!terminal(s)&&round===s.round+1?'tomorrow':'unseen';
  return Object.freeze({round,status,work,request:status==='unseen'?null:requestFor(s,round)});
 }));
 const view=Object.freeze({current:requestFor(s,s.round)!,next:terminal(s)?null:requestFor(s,s.round+1),works,currentWork:byRound.get(s.round)??null,pages,title:notebookTitle(works.length,s.roundLimit)});
 if(Object.isFrozen(s))cache.set(s,view);return view;
}
