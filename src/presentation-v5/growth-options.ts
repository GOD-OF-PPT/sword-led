import {CHAPTERS, JOURNAL_SOFT_LIMIT, describeRoute, percent, routeAssessment} from '../core-v5/index.js';
import type {Blade,Trait} from '../core-v5/index.js';
import {freezeDeep} from '../core/immutable.js';
import {traitPurpose} from './decisions.js';
import type {ForgeView} from './decisions.js';

export interface GrowthControls {
 readonly upgraded: boolean;
 readonly repaired: boolean;
 readonly recordLimited: boolean;
}
export interface CarryOption {
 readonly id: string;
 readonly blade: Blade;
 readonly valueNow: number;
 readonly valueNext: number;
 /** A new placement only. Retrieving an already reserved sword is a separate action. */
 readonly canReserve: boolean;
 readonly matching: boolean;
 readonly missing: readonly string[];
 readonly copy: string;
}
export interface CashUpgradeOption {
 readonly price: number | null;
 readonly canBuy: boolean;
 readonly currentBase: number | null;
 readonly afterBase: number | null;
 /** A negative value is a prospective shortfall, never an accepted negative wallet. */
 readonly balanceAfter: number | null;
 readonly reason: string;
 readonly copy: string;
}
export interface CashRepairOption {
 readonly price: number | null;
 readonly canBuy: boolean;
 readonly sealsBefore: number;
 readonly sealsAfter: number;
 readonly balanceAfter: number | null;
 readonly reason: string;
 readonly copy: string;
}
export interface CashOptions {
 readonly upgrade: CashUpgradeOption;
 readonly repair: CashRepairOption;
}
export interface TradeOption {
 readonly pieceId: string;
 readonly allowed: boolean;
 readonly reason: string;
 readonly opportunity: readonly string[];
}

const fmt = (value: number) => value.toLocaleString('zh-CN');
const priceCopy = (price: number, balance: number) => balance < 0
 ? `需${fmt(price)}铜钱，当前还差${fmt(-balance)}。`
 : `支付${fmt(price)}铜钱后，余${fmt(balance)}。`;

/** A deterministic next-day preview: no command, future strike, or random draw. */
export function carryOption(view: ForgeView, pieceId: string, recordLimited = false): CarryOption | null {
 const item = view.blades.find(value => value.blade.id === pieceId);
 if (!item) return null;
 const blade = item.blade, next = view.next;
 const valueNext = next ? view.modifications.some(value => value.id === 'warmRack') ? percent(blade.value, 115) : blade.value : blade.value;
 const canReserve = view.phase === 'workshop' && !item.reserved && !recordLimited && item.barter.error !== 'record_limit';
 if (!next) return freezeDeep({id: pieceId, blade, valueNow: blade.value, valueNext, canReserve,
  matching: false, missing: ['最后一炉，没有明日委托'], copy: '这是最后一炉。挂架只暂存本局，不带入新局；收工时也不会自动回收挂架剑。'});
 const projected = {...blade, value: valueNext, peak: Math.max(blade.peak, valueNext)};
 const routes = next.commission.routes.map(route => ({route, ...routeAssessment({day: next.day}, projected, route)}));
 const matches = routes.filter(route => route.matches), matching = matches.length > 0;
 const missing = matching ? [] : routes.length === 1 ? routes[0]!.missing
  : routes.map(route => `${describeRoute(route.route)}：${route.missing.join('、')}`);
 const valueCopy = blade.value === valueNext ? `明日身价${fmt(valueNext)}` : `余温架：${fmt(blade.value)}→${fmt(valueNext)}`;
 const fitCopy = matching ? `符合${next.commission.name}的${matches.map(value => value.route.count > 1 ? '其中一柄要求' : '一柄交付要求').join('或')}`
  : `尚不能直接交付：${missing.join('；或')}`;
 return freezeDeep({id: pieceId, blade, valueNow: blade.value, valueNext, canReserve, matching, missing,
  copy: `${valueCopy}，${fitCopy}。裂纹、配方与锤势保留；留它后是旧剑1＋新坯2，少一柄新坯，明日取下不补发。`});
}

/** UI metadata comes from the current run, since the public view combines these permissions. */
export function cashOptions(view: ForgeView, controls?: GrowthControls): CashOptions {
 const market = view.merchant, next = view.next, currentBase = next?.normalBase ?? null;
 if (!market) return freezeDeep({
  upgrade: {price: null, canBuy: false, currentBase, afterBase: null, balanceAfter: null,
   reason: view.phase === 'workshop' ? '行脚商人今天未到访。' : '回到商人到访的炉前，才能备料。',
   copy: next ? `按当前准备，下批${next.newCount}柄新坯的普通底价各${fmt(next.normalBase)}。` : '已经没有下一批来料。'},
  repair: {price: null, canBuy: false, sealsBefore: view.seals, sealsAfter: view.seals, balanceAfter: null,
   reason: view.phase === 'workshop' ? '行脚商人今天未到访。' : '回到商人到访的炉前，才能修印。', copy: '契印最多三枚；补印不能补完已经失约的关键约定。'},
 });
 const chapter = next ? CHAPTERS.find(value => next.day >= value.days[0]! && next.day <= value.days[1]!) : undefined;
 const count = view.growth.upgradeCount + 1;
 const afterBase = controls?.upgraded || !next || !chapter || count > 3 ? null
  : Math.floor(chapter.base * 3 ** count / 2 ** count * view.growth.pending.supplyPct / 100);
 const upgradeBalance = controls?.upgraded ? null : view.coins - market.upgrade;
 let upgradeReason = '';
 if (controls?.recordLimited) upgradeReason = `操作记录已到安全上限（${JOURNAL_SOFT_LIMIT}），不能再备料。`;
 else if (controls?.upgraded) upgradeReason = '本次到访已经备好铁料，不能重复购买。';
 else if (!next) upgradeReason = '已经没有下一批来料。';
 else if (view.coins < market.upgrade) upgradeReason = `还差${fmt(market.upgrade - view.coins)}铜钱。`;
 else if (!market.canUpgrade) upgradeReason = '这次暂不能再备料，请保留当前来料安排。';
 const firstAfter = next && afterBase !== null ? afterBase + Math.min(afterBase * 4, view.growth.inheritance) : null;
 const upgradeCopy = controls?.upgraded ? `下一批普通新坯底价已为${fmt(next?.normalBase ?? view.growth.supplyBase)}，手上已有的剑不再涨价。`
  : next && afterBase !== null ? `下批${next.newCount}柄新坯：普通底价${fmt(next.normalBase)}→${fmt(afterBase)}。${next.inheritanceBonus && firstAfter !== null ? `首柄另含余温，实际${fmt(next.firstBase)}→${fmt(firstAfter)}。` : ''}${next.oldCount ? '同行旧剑不涨价。' : '手上已有的剑不涨价。'}${priceCopy(market.upgrade, view.coins - market.upgrade)}`
  : '当前没有可再次购买的下一批来料；手上已有的剑保持原值。';
 let repairReason = '';
 if (controls?.recordLimited) repairReason = `操作记录已到安全上限（${JOURNAL_SOFT_LIMIT}），不能再修印。`;
 else if (controls?.repaired) repairReason = '本次到访已经修过契印，不能重复修补。';
 else if (view.seals >= 3) repairReason = '契印已满三枚，无需修补。';
 else if (view.coins < market.repair) repairReason = `还差${fmt(market.repair - view.coins)}铜钱。`;
 else if (!market.canRepair) repairReason = '这次暂不能再修印，请查看当前契印安排。';
 const sealsAfter = controls?.repaired ? view.seals : Math.min(3, view.seals + 1);
 const repairBalance = controls?.repaired || view.seals >= 3 ? null : view.coins - market.repair;
 return freezeDeep({
  upgrade: {price: market.upgrade, canBuy: market.canUpgrade && !upgradeReason, currentBase, afterBase, balanceAfter: upgradeBalance, reason: upgradeReason, copy: upgradeCopy},
  repair: {price: market.repair, canBuy: market.canRepair && !repairReason, sealsBefore: view.seals, sealsAfter, balanceAfter: repairBalance, reason: repairReason,
   copy: `${controls?.repaired ? '本次已修补；' : `契印${view.seals}→${sealsAfter}；`}不补完失约或关键约定。${repairBalance !== null ? priceCopy(market.repair, repairBalance) : '当前不会再次扣款。'}`},
 });
}

/** A sword's actual alternatives, not a second quotation or a synthetic receipt. */
export function tradeOption(view: ForgeView, pieceId: string): TradeOption {
 const item = view.blades.find(value => value.blade.id === pieceId);
 if (!item) return freezeDeep({pieceId, allowed: false, reason: '这柄已经离开炉边，请重新选剑。', opportunity: []});
 const reasons: Record<string, string> = {
  wrong_phase: '先回炉前，再决定献剑。', record_limit: '操作记录已到安全上限，仍可交剑或回收。',
  piece_unavailable: '这柄已经离开炉边。', reserved_piece: '先取回挂架剑，才能献艺。',
  blade_unworked: `当前等级${item.blade.level}；成器至少等级3，普通成功加1、大成加2。`,
 };
 const reason = item.barter.error ? reasons[item.barter.error] ?? '当前不能献出这柄剑。'
  : !view.merchant ? '行脚商人今天未到访。' : '';
 const opportunity: string[] = [];
 if (item.quote.matched) opportunity.push(`${item.reserved ? '取回后按当前报价，' : ''}今天可交给${view.commission.name}，实收${fmt(item.quote.amount)}铜钱（酬劳${fmt(item.quote.baseFeeDelta)}＋品质${fmt(item.quote.qualityBonus)}）。`);
 else if (item.quote.allowed) opportunity.push(`今天卖给行会实收${fmt(item.quote.amount)}铜钱，不计主委托。`);
 else if (item.quote.error === 'market_exhausted') opportunity.push('今日收购钱袋已空，普通出售当前为0；剑仍保留。');
 else if (item.reserved) opportunity.push(item.quote.amount > 0 ? `先取回挂架剑；按当前报价卖给行会可收${fmt(item.quote.amount)}铜钱，不计主委托。` : '这柄正在剑架上，不能直接交换；今日钱袋已空，取回后也不能普通出售。');
 if (item.quote.matched && view.commission.routes.some(route => route.count > 1)) opportunity.push('献出去后不能再计入这份双剑或替代路线委托。');
 const carry = carryOption(view, pieceId);
 if (carry && view.next) opportunity.push(carry.copy);
 else if (!view.next) opportunity.push('最后一炉没有明日来料；挂架也不会把兵器带入新局。');
 opportunity.push(`${item.reserved ? '先取回后，按当前钱袋' : '明确'}回收实得${fmt(item.recovery)}铜钱；献艺后不能再回收。`);
 return freezeDeep({pieceId, allowed: item.barter.allowed && !!view.merchant, reason, opportunity});
}

/** Assess the benefit on the swords that remain after paying the selected sword. */
export function tradePurpose(traitId:Trait,view:ForgeView,pieceId:string){
 return traitPurpose(traitId,{...view,blades:view.blades.filter(item=>item.blade.id!==pieceId)});
}
