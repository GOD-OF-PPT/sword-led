import type {getRunView} from '../core-v5/index.js';

export type PaymentView=ReturnType<typeof getRunView>;
export type PaymentQuoteKind='commission'|'sale'|'exhausted'|'reserved'|'empty'|'unavailable';
interface QuoteText {
 readonly buttonText:string;
 readonly breakdown:string;
 readonly explanation:string;
 readonly details:readonly string[];
}
export type PaymentQuoteCopy=QuoteText&(
 |{readonly kind:'commission'|'sale';readonly amount:number;readonly pieceValue:number}
 |{readonly kind:Exclude<PaymentQuoteKind,'commission'|'sale'>;readonly amount:null;readonly pieceValue:number|null}
);
export interface WorkshopPaymentCopy {
 readonly valueLabel:'作品估值';
 readonly valueHint:string;
 readonly orderPay:string;
 readonly orderExplanation:string;
 readonly detailsSummary:'估值、酬劳与实收';
 readonly quote:PaymentQuoteCopy;
}
const fmt=(value:number)=>value.toLocaleString('zh-CN');

/** Display only the public quote. No price, eligibility, progress or wallet is calculated here. */
export function workshopPaymentCopy(view:PaymentView,selectedId:string|null):WorkshopPaymentCopy {
 const orderPay=`整单酬劳 ${fmt(view.market.baseFee)}铜钱 · 已领 ${fmt(view.market.baseFeesPaid)}铜钱`;
 const multiple=view.commission.routes.some(route=>route.count>1);
 const orderExplanation=view.commission.progress.complete
  ?'本单酬劳已按交剑进度领取；余剑出售不再领取这份酬劳。'
  :multiple
   ?'整单酬劳按合格交剑进度分次领取；“本柄酬劳”是这次交剑可领的份额。'
   :'整单酬劳是这份约定的基础付款，品质加赏另计。';
 const common={valueLabel:'作品估值' as const,valueHint:'估值用来验剑，铜钱按右侧报价入袋。',orderPay,orderExplanation,detailsSummary:'估值、酬劳与实收' as const};
 const selected=view.blades.find(item=>item.blade.id===selectedId);
 const blocked=(kind:Exclude<PaymentQuoteKind,'commission'|'sale'>,buttonText:string,explanation:string):WorkshopPaymentCopy=>({...common,quote:{kind,buttonText,breakdown:kind==='reserved'?'先取回，再查看本次收款':kind==='empty'?'选中一柄剑，查看收款':kind==='exhausted'?'暂不能出售，可查看去向':'当前无法交付，可查看原因',explanation,details:[],amount:null,pieceValue:selected?.quote.pieceValue??null}});
 if(!selected)return blocked('empty','先选一柄剑','选中一柄剑后，再看这次能收多少铜钱。');
 if(selected.reserved)return blocked('reserved','先从剑架取回','这柄在剑架上；取回后才显示本次可交付或出售的实收。');
 const quote=selected.quote;
 if(!quote.allowed){
  if(quote.error==='market_exhausted')return blocked('exhausted','今日收购余款已用尽','这柄余剑暂不能出售，可查看留剑或回收安排。');
  return blocked('unavailable',quote.error==='record_limit'?'先查看行程与导出':'回到炉前再安排','这次不能交付或出售，请先查看当前行程与保存状态。');
 }
 if(quote.matched){
  const threshold=quote.threshold===null?'超出订单估值门槛的部分':`超出订单估值门槛 ${fmt(quote.threshold)}的部分`;
  return{...common,quote:{
   kind:'commission',amount:quote.amount,pieceValue:quote.pieceValue,
   buttonText:`交给${view.commission.name} · 实收${fmt(quote.amount)}铜钱`,
   breakdown:`本柄酬劳${fmt(quote.baseFeeDelta)}＋品质加赏${fmt(quote.qualityBonus)}＝${fmt(quote.amount)}铜钱`,
   explanation:'估值用来核对订单；铜钱按本柄酬劳与品质加赏结算。',
   details:[
    `作品估值 ${fmt(quote.pieceValue)}，用于检查订单门槛，不会整笔变成铜钱。`,
    `整单酬劳 ${fmt(view.market.baseFee)}铜钱，已领 ${fmt(view.market.baseFeesPaid)}铜钱；本次交剑领取其中 ${fmt(quote.baseFeeDelta)}铜钱。`,
    `${threshold}按1/5折为品质加赏，向下取整；加赏受今日收购余款 ${fmt(view.market.remaining)}铜钱限制，本柄加赏为 ${fmt(quote.qualityBonus)}铜钱。`,
    '收购余款只限制品质加赏与余剑收购，不扣减本柄应领的委托酬劳。',
   ],
  }};
 }
 return{...common,quote:{
  kind:'sale',amount:quote.amount,pieceValue:quote.pieceValue,
  buttonText:`卖给行会 · 实收${fmt(quote.amount)}铜钱`,
  breakdown:`余剑出售 · 本次实收${fmt(quote.amount)}铜钱`,
  explanation:'按估值的1/4折价出售，受今日收购余款限制，不计主委托。',
  details:[
   `作品估值 ${fmt(quote.pieceValue)}；余剑按估值的1/4换铜钱，向下取整。`,
   `今日收购余款 ${fmt(view.market.remaining)}铜钱；本次按正式报价实收 ${fmt(quote.amount)}铜钱，最多收到这笔余款。`,
   view.commission.progress.complete?'今天的主委托已交妥，这柄作为余剑出售，不再领取整单酬劳。':'这柄作为余剑出售，不计作主委托交剑，也不领取委托酬劳。',
  ],
 }};
}
