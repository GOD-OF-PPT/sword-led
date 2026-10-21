import {RECIPES,TRAITS} from '../core-v5/index.js';
import type {Blade,Trait} from '../core-v5/index.js';
import {element} from '../presentation/dom.js';
import {traitArt} from '../presentation-v3/art.js';
import type {ForgeView} from './decisions.js';
import {cashOptions,tradeOption,tradePurpose} from './growth-options.js';
import type {GrowthControls} from './growth-options.js';

export interface MarketStallContext {
  selectedPieceId:string|null;
  growthControls?:GrowthControls;
  thumb:(blade:Blade)=>HTMLElement;
  action:(label:string,run:()=>void,primary?:boolean,disabled?:boolean)=>HTMLButtonElement;
  buy:(traitId:Trait,pieceId:string)=>void;
  upgrade:()=>void;
  repair:()=>void;
}

type Selection={kind:'trait';id:Trait}|{kind:'upgrade'}|{kind:'repair'};
const fmt=(value:number)=>value.toLocaleString('zh-CN');

/** An owned DOM surface: selecting goods or a sword never dispatches or changes the forge selection. */
export function createMarketStall(view:ForgeView,context:MarketStallContext):HTMLElement {
  const root=element('div',undefined,'v5-market-stall'),market=view.merchant;
  if(!market){root.append(element('p','商人已经离开，回炉边继续这一程。'));return root;}
  const offers=market.offers,options=cashOptions(view,context.growthControls);
  const initial=view.blades.find(item=>item.blade.id===context.selectedPieceId)
    ??view.blades.find(item=>item.barter.allowed)??view.blades.find(item=>!item.reserved)??view.blades[0];
  let pieceId=initial?.blade.id??null;
  let selection:Selection=offers[0]?{kind:'trait',id:offers[0].id}:{kind:'upgrade'};
  const header=element('header',undefined,'v5-stall-heading');
  const welcome=element('div');welcome.append(element('b','炉边开摊'),element('p','手艺用剑换，备料与补印用铜钱。先挑一件，看看值不值得。'));
  const purse=element('p',undefined,'v5-stall-purse');purse.append(element('small','行囊'),element('strong',fmt(view.coins)),element('span','铜钱'));
  header.append(welcome,purse);root.append(header);

  const goods=element('div',undefined,'v5-stall-goods');goods.setAttribute('aria-label','摊上的物件');
  const selectors:{node:HTMLButtonElement;value:Selection}[]=[];
  const cashArt=(kind:'upgrade'|'repair')=>{
    const art=element('span',undefined,`v5-stall-cash-art v5-stall-${kind}`);art.setAttribute('aria-hidden','true');
    if(kind==='upgrade')for(let i=0;i<3;i++)art.append(element('i'));
    else for(let i=0;i<3;i++)art.append(element('i','契'));
    return art;
  };
  const addGood=(value:Selection,name:string,price:string,status:string)=>{
    const node=context.action(name,()=>{selection=value;update();});node.classList.add('v5-stall-good');
    node.dataset.stallGood=value.kind;
    if(value.kind==='trait')node.dataset.stallTrait=value.id;
    node.replaceChildren(value.kind==='trait'?traitArt(value.id):cashArt(value.kind),element('b',name),element('small',status||price));
    node.setAttribute('aria-label',`${name} · ${status||price}，查看用途`);
    selectors.push({node,value});goods.append(node);
  };
  for(const offer of offers)addGood({kind:'trait',id:offer.id},offer.name,'献一柄成器',offer.sold?'已换走':offer.owned?'已经带着':'');
  addGood({kind:'upgrade'},'下一批铁料',`${fmt(market.upgrade)}铜钱`,context.growthControls?.upgraded?'本次已备好':'');
  addGood({kind:'repair'},'补一枚契印',`${fmt(market.repair)}铜钱`,context.growthControls?.repaired?'本次已修补':view.seals===3?'契印已满':'');
  root.append(goods);

  const main=element('div',undefined,'v5-stall-main');
  const detail=element('section',undefined,'v5-stall-detail');detail.setAttribute('aria-label','所选物件的用途');
  const hero=element('div',undefined,'v5-stall-hero'),heroArt=element('div',undefined,'v5-stall-hero-art'),heroCopy=element('div');
  const eyebrow=element('small'),title=element('h3'),rule=element('p',undefined,'v5-stall-rule');heroCopy.append(eyebrow,title,rule);hero.append(heroArt,heroCopy);
  const purposeHeading=element('b',undefined,'v5-stall-purpose'),purposeCopy=element('p',undefined,'v5-stall-purpose-copy');
  const shortCost=element('p',undefined,'v5-stall-cost'),reason=element('p',undefined,'v5-stall-reason');reason.setAttribute('role','status');
  const rules=element('details',undefined,'v5-stall-rules'),rulesCopy=element('p');rules.append(element('summary','细看代价与规则'),rulesCopy);
  const purchase=context.action('',()=>{
    if(selection.kind==='upgrade'){if(options.upgrade.canBuy)context.upgrade();return;}
    if(selection.kind==='repair'){if(options.repair.canBuy)context.repair();return;}
    const traitId=selection.id,offer=offers.find(item=>item.id===traitId),trade=tradeOption(view,pieceId??'');
    if(offer&&!offer.owned&&!offer.sold&&trade.allowed&&pieceId)context.buy(traitId,pieceId);
  },true);purchase.classList.add('v5-stall-purchase');
  detail.append(hero,purposeHeading,purposeCopy,shortCost,purchase,reason,rules);main.append(detail);

  const payment=element('section',undefined,'v5-stall-payment');
  const swords=element('div',undefined,'v5-stall-swords'),swordTitle=element('h3','选一柄来换'),swordList=element('div',undefined,'v5-stall-sword-list');swordList.setAttribute('aria-label','摊内挑选献剑');
  const swordButtons:{id:string;node:HTMLButtonElement}[]=[];
  for(const item of view.blades){
    const blade=item.blade,node=context.action(`${RECIPES[blade.recipe].name} · 等级${blade.level}`,()=>{pieceId=blade.id;update();});
    node.classList.add('v5-stall-sword');node.dataset.stallPiece=blade.id;
    node.replaceChildren(context.thumb(blade),element('b',`${RECIPES[blade.recipe].name} · 等级${blade.level}`),element('small',item.reserved?'已挂剑架':item.quote.matched?`交委托实收${fmt(item.quote.amount)}`:`出售实收${fmt(item.quote.amount)}`));
    swordButtons.push({id:blade.id,node});swordList.append(node);
  }
  const tradeReason=element('p',undefined,'v5-stall-trade-reason'),opportunities=element('ul',undefined,'v5-stall-opportunities');
  swords.append(swordTitle,swordList,tradeReason,opportunities);
  if(!view.blades.length)swords.append(element('p','这一炉已没有可献的剑。仍可查看手艺，或用铜钱备料与补印。'));
  const cash=element('div',undefined,'v5-stall-cash-payment'),cashTitle=element('h3','从行囊里付'),cashBefore=element('p'),cashAfter=element('p',undefined,'v5-stall-cash-after'),cashNote=element('p',undefined,'v5-stall-cash-note');
  cash.append(cashTitle,cashBefore,cashAfter,cashNote);payment.append(swords,cash);main.append(payment);root.append(main);
  const foot=element('p','今日收购钱袋余'+fmt(view.market.remaining)+'铜钱；交出主委托的基础酬劳另算。挑选和查看不花钱，也不移动炉前的剑。','v5-stall-footnote');root.append(foot);

  function update(){
    root.dataset.selection=selection.kind;
    for(const item of selectors)item.node.setAttribute('aria-pressed',String(item.value.kind===selection.kind&&(item.value.kind!=='trait'||selection.kind==='trait'&&item.value.id===selection.id)));
    for(const item of swordButtons)item.node.setAttribute('aria-pressed',String(item.id===pieceId));
    const isTrait=selection.kind==='trait';swords.hidden=!isTrait;cash.hidden=isTrait;
    reason.hidden=false;rules.open=false;
    if(selection.kind==='trait'){
      const traitId=selection.id,offer=offers.find(item=>item.id===traitId)!,trait=TRAITS[traitId],purpose=tradePurpose(traitId,view,pieceId??''),trade=tradeOption(view,pieceId??'');
      heroArt.replaceChildren(traitArt(traitId));eyebrow.textContent='一柄成器，换一门手艺';title.textContent=trait.name;rule.textContent=trait.text;
      purposeHeading.textContent=purpose.headline;purposeCopy.textContent=purpose.copy;detail.dataset.tone=purpose.tone;
      shortCost.textContent=purpose.replacementRequired?'献出所选成器，并明确换下一门旧手艺。':'献出所选成器，装进手艺行囊。';
      rulesCopy.textContent=purpose.costCopy;
      purchase.textContent=offer.sold?'这门手艺已换走':offer.owned?'已经带着这门手艺':pieceId&&trade.allowed?`献这柄，换${trait.name}`:'先选可献的成器';
      purchase.disabled=offer.sold||offer.owned||!trade.allowed;
      reason.textContent=offer.sold?'本次摊位没有第二件。':offer.owned?'无需再交一柄剑。':trade.allowed?'确认前，仍可换一柄比较；剑只在最终确认后交出。':trade.reason;
      tradeReason.textContent=trade.allowed?'所选剑可献，先看它原本能去哪里。':trade.reason;
      opportunities.replaceChildren(...trade.opportunity.map(copy=>element('li',copy)));
      if(!opportunities.childElementCount)opportunities.append(element('li','选一柄剑，查看它与今日委托、明日留剑的取舍。'));
    }else{
      const option=options[selection.kind],upgrade=selection.kind==='upgrade';
      heroArt.replaceChildren(cashArt(selection.kind));eyebrow.textContent=upgrade?'给后面的炉火备料':'让眼前的行旅继续';title.textContent=upgrade?'下一批更好的铁料':'补回一枚契印';
      rule.textContent=upgrade?options.upgrade.currentBase===null||options.upgrade.afterBase===null?'查看后续来料的变化':`明日普通底价 ${fmt(options.upgrade.currentBase)} → ${fmt(options.upgrade.afterBase)}`:`契印 ${options.repair.sealsBefore}/3 → ${options.repair.sealsAfter}/3`;
      purposeHeading.textContent=upgrade?'只影响后续新坯，手上旧剑不涨价':'补契印，保不回已经失约的那一单';
      purposeCopy.textContent=option.copy;detail.dataset.tone=option.canBuy?'ready':'neutral';
      shortCost.textContent=option.price===null?'商人此刻没有这项报价。':`这次付${fmt(option.price)}铜钱 · 每次到访限一次`;
      rulesCopy.textContent=upgrade?'备料不改变手上已有剑的身价。留一柄时，明日发两柄新坯；不留则发三柄。旧剑占用一个总名额，明日取下也不会补第四柄。':'最多三枚契印。补印不会替你完成第4、8、12天的关键约定，也不会补发未取得的作品或基础酬劳。';
      purchase.textContent=upgrade?(context.growthControls?.upgraded?'本次已备好':'准备更好的铁料'):(context.growthControls?.repaired?'本次已修补':'请商人修补');purchase.disabled=!option.canBuy;
      reason.textContent=option.reason||'先看清付款后的行囊，再决定是否请商人动手。';
      cashBefore.textContent=`现在 ${fmt(view.coins)}铜钱`;
      cashAfter.textContent=option.balanceAfter===null?'暂无可确认的付款':option.balanceAfter<0?`还差 ${fmt(-option.balanceAfter)}铜钱`:`付后留下 ${fmt(option.balanceAfter)}铜钱`;
      cashNote.textContent=upgrade&&view.next?`按眼前剑架：明日${view.next.oldCount}柄旧剑＋${view.next.newCount}柄新坯。${view.next.inheritanceBonus?`第一新坯还接余温加料；`:'首新坯的借锤、炉棚等另按实际准备；'}备料不会多发一柄。`:'铜钱从你的行囊支付，与今日收购钱袋分开；取消不会扣款。';
    }
  }
  update();return root;
}
