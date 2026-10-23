import type {Action,DomainEvent,Draft,ErrorCode,RunState} from './model.js';

const PRICES={coal:2,blank:2,upgrade:4,exchange:2} as const;

export function shopError(state:RunState,action:Action):ErrorCode|null{
 if(action.type!=='shop')return null;
 if(state.phase!=='prepare'||(state.node!==1&&state.node!==4&&state.node!==7))return'wrong_phase';
 switch(action.item){
  case'coal':if(state.lamp>=8)return'at_capacity';break;
  case'blank':if(state.blanks>=3)return'at_capacity';break;
  case'upgrade':
   if(!state.tool)return'no_tool';
   if(state.upgradeUsed||state.tool.level!==1)return'upgrade_used';
   break;
  case'exchange':if(!state.tool)return'no_tool';break;
 }
 return state.coins<PRICES[action.item]?'not_enough_coins':null;
}

/** Shops transfer actual resources only after shopError accepts the command. */
export function applyShop(draft:Draft,action:Action,events:DomainEvent[]):void{
 if(action.type!=='shop')return;
 const price=PRICES[action.item];
 if((action.item==='upgrade'||action.item==='exchange')&&!draft.tool)throw new Error('Tool transaction requires an owned tool.');
 draft.coins-=price;
 if(draft.encounter)draft.encounter.braced=false;
 events.push({type:'CoinsChanged',amount:-price,total:draft.coins,reason:'shop-'+action.item});
 switch(action.item){
  case'coal':{
   const before=draft.lamp;draft.lamp=Math.min(8,before+3);
   events.push({type:'LightChanged',amount:draft.lamp-before,total:draft.lamp,reason:'shop-coal'});
   break;
  }
  case'blank':draft.blanks++;break;
  case'upgrade':
   if(!draft.tool)throw new Error('Upgrade requires an owned tool.');
   draft.tool.level=2;draft.upgradeUsed=true;
   events.push({type:'ToolChanged',kind:draft.tool.kind,level:2});
   break;
  case'exchange':{
   if(!draft.tool)throw new Error('Exchange requires an owned tool.');
   const kind=draft.tool.kind==='rebound'?'furnace':'rebound';
   draft.tool={kind,level:1,stored:0};
   events.push({type:'ToolChanged',kind,level:1});
   break;
  }
 }
 events.push({type:'ShopUsed',item:action.item,price});
}
