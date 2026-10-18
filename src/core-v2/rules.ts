import { freezeDeep } from '../core/immutable.js';
import type { Condition, Material, Pattern, Ratings, Request, RequestKind, Stat, Technique, TimingGrade, Workpiece } from './model.js';

export const RULES_VERSION = 'forge-v2' as const;
export const QUOTAS = Object.freeze([150,180,210,250,290,330,380,430,480,540,600,660]);
export const MATERIALS = freezeDeep({
  iron: { label: '熟铁', value: 18, integrity: 4, threshold: 40, scrap: 3, ratings: { edge: 0, toughness: 2, balance: 0 } },
  steel: { label: '精钢', value: 22, integrity: 3, threshold: 36, scrap: 4, ratings: { edge: 2, toughness: 0, balance: 0 } },
  meteorite: { label: '陨铁', value: 28, integrity: 2, threshold: 32, scrap: 5, ratings: { edge: 0, toughness: 0, balance: 2 } },
});
export const HAMMERS = freezeDeep({
  light: { label: '轻锤', force: 1, heat: 8, stress: 1, periodMs: 1600 },
  standard: { label: '平锤', force: 3, heat: 16, stress: 6, periodMs: 1400 },
  heavy: { label: '重锤', force: 5, heat: 24, stress: 12, periodMs: 1200 },
});
export const STAT_NAMES: Readonly<Record<Stat,string>> = Object.freeze({edge:'锋',toughness:'韧',balance:'衡'});
export const PATTERN_NAMES: Readonly<Record<Pattern,string>> = Object.freeze({edge:'巡锋',spine:'守脊',bridge:'游衡'});
export const SECTION_NAMES = Object.freeze(['剑尖','前刃','中段','根部','剑茎']);
export const TECHNIQUES = freezeDeep({
  edgeTooth: { label:'巡锋齿', effect:'巡锋奖励从 +2锋变为 +4锋', coins:100, scrap:3 },
  bridgeClip: { label:'桥脊扣', effect:'形成游衡后，本剑水淬免除 +8应力', coins:100, scrap:3 },
  reheatSand: { label:'回火砂', effect:'每件首次回火额外 +2韧', coins:100, scrap:3 },
  warmTongs: { label:'余温钳', effect:'每件前两次重锤热耗 −4，应力额外 +2', coins:160, scrap:5 },
  shardBox: { label:'断纹匣', effect:'每轮首件破碎额外 +4废料', coins:160, scrap:5 },
  balanceWeight: { label:'匀衡砝', effect:'油淬前最高/最低属性差 ≤4，额外 +3衡', coins:160, scrap:5 },
});
export const TECHNIQUE_IDS = Object.freeze(Object.keys(TECHNIQUES) as Technique[]);
export const STARTERS: readonly Technique[] = Object.freeze(['edgeTooth','bridgeClip','reheatSand']);
export const CONDITION_NAMES = Object.freeze({steady:'静炉',wetCoal:'湿煤：煤1，回收额外+1废料',brightFire:'旺炉：初热120，重锤应力+2',brittle:'脆脉：阈值−4，成品价值+20',urgent:'急件：委托额外+20，需指定锻纹',reclaimed:'旧器回炉：一项初始属性+2，底价−4'});
const TEMPLATES: Readonly<Record<RequestKind,{label:string;needs:readonly (readonly [Stat,number])[];pattern:Pattern|null}>> = freezeDeep({
  guard:{label:'巡卫的守夜剑',needs:[['edge',6],['toughness',5]],pattern:null},
  courier:{label:'信使的随身剑',needs:[['edge',5],['balance',6]],pattern:null},
  hunter:{label:'猎手的开路剑',needs:[['edge',8],['balance',3]],pattern:null},
  protector:{label:'护卫的挡击剑',needs:[['toughness',8],['balance',3]],pattern:null},
  ceremony:{label:'仪仗的匀衡剑',needs:[['toughness',4],['balance',7]],pattern:'bridge'},
  duelist:{label:'剑客的试锋剑',needs:[['edge',7],['toughness',4]],pattern:'edge'},
});
export const REQUEST_KINDS = Object.freeze(Object.keys(TEMPLATES) as RequestKind[]);
export function requestFor(kind:RequestKind,round:number,condition:Condition):Request {
  const t=TEMPLATES[kind],difficulty=2*Math.floor((round-1)/3);
  const patterns:Pattern[] = t.pattern ? [t.pattern] : [];
  if(condition.pattern&&!patterns.includes(condition.pattern))patterns.push(condition.pattern);
  return {id:`${round}:${kind}`,kind,label:t.label,needs:t.needs.map(([stat,minimum])=>({stat,minimum:minimum+difficulty})),patterns};
}
export function quotaFor(round:number):number { return QUOTAS[round-1]??0; }
export function gradeOf(mark:number):TimingGrade { const d=Math.abs(mark-5000);return d<=600?'precise':d<=2000?'ordinary':'mishit'; }
export function statAt(node:number):Stat { return node%5===2?'balance':node<5?'edge':'toughness'; }
export function adjacent(a:number,b:number):boolean { return Math.abs(Math.floor(a/5)-Math.floor(b/5))+Math.abs(a%5-b%5)===1; }
export function ratingsTotal(r:Ratings):number { return r.edge+r.toughness+r.balance; }
export function marketValue(p:Workpiece):number {
  if(p.status==='broken')return 0;
  if(p.quench===null)return p.baseValue;
  return Math.max(p.baseValue,p.baseValue+4*ratingsTotal(p.ratings)+3*Math.min(p.ratings.edge,p.ratings.toughness,p.ratings.balance)
    +12*p.patterns.length+(p.patterns.length===3?12:0)-6*(p.maxIntegrity-p.integrity)+p.temperedBonus);
}
export function salvageValue(p:Workpiece,condition:Condition):number { return MATERIALS[p.material].scrap+Math.floor(ratingsTotal(p.ratings)/12)+(condition.kind==='wetCoal'?1:0); }
export function requestBonus(p:Workpiece,request:Request,condition:Condition):number {
  if(p.quench===null||p.status==='broken'||!request.needs.every(n=>p.ratings[n.stat]>=n.minimum)||!request.patterns.every(pattern=>p.patterns.includes(pattern)))return 0;
  return 40+(request.needs.every(n=>p.ratings[n.stat]>=n.minimum+3)?20:0)+(condition.kind==='urgent'?20:0);
}
export function makePiece(round:number,slot:number,material:Material,condition:Condition):Workpiece {
  const m=MATERIALS[material],ratings={...m.ratings};if(condition.stat)ratings[condition.stat]+=2;
  return {id:`${round}:${slot}`,material,baseValue:m.value-(condition.kind==='reclaimed'?4:0),temperedBonus:condition.kind==='brittle'?20:0,
    threshold:m.threshold-(condition.kind==='brittle'?4:0),maxIntegrity:m.integrity,integrity:m.integrity,heat:condition.kind==='brightFire'?120:100,stress:0,
    ratings,nodes:Array<number>(10).fill(0),chain:[],patterns:[],traces:[],strikes:0,heavyStrikes:0,reheats:0,bridgeUsed:false,
    quench:null,status:'active',paidValue:0,recoveredScrap:0};
}
