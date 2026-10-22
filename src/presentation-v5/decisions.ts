import {CHAPTERS, RECIPES, LEVEL_CAP, VALUE_CAP, describeRoute, routeAssessment} from '../core-v5/index.js';
import type {Blade, RouteCondition, Trait, getRunView} from '../core-v5/index.js';

export type ForgeView = ReturnType<typeof getRunView>;
export type DecisionTone = 'neutral' | 'ready' | 'safe' | 'risk' | 'danger';
export interface DecisionNote {readonly headline: string; readonly copy: string; readonly tone: DecisionTone}
export type ForgeDecisionAction = 'deliver' | 'strike' | 'retrieve' | 'select' | 'recipe' | 'plan' | 'settle' | 'none';
export interface ForgeDecision extends DecisionNote {
 readonly action: ForgeDecisionAction;
 readonly actionLabel: string;
 readonly pieceId: string | null;
 readonly missing: readonly string[];
 /** Zero means the next click is a safe burst; a positive number is ordinary hits still needed if the sword survives. */
 readonly ordinaryToBurst: number | null;
}
export interface TomorrowRoute {
 readonly id: string; readonly description: string; readonly required: number;
 readonly reserveMatches: boolean; readonly missing: readonly string[];
}
export interface ReservePurpose extends DecisionNote {
 readonly id: string; readonly valueNow: number; readonly valueNext: number; readonly matchingRoutes: readonly string[];
}
export interface NextDayDecision extends DecisionNote {
 readonly day: number | null; readonly title: string; readonly customer: string;
 readonly newCount: number; readonly oldCount: number; readonly totalCount: number;
 readonly routes: readonly TomorrowRoute[]; readonly reserve: ReservePurpose | null;
 /** Current unreserved swords that already meet a tomorrow route at their current value; no hypothetical warming is added. */
 readonly candidateIds: readonly string[];
}
export interface TraitDecision extends DecisionNote {
 readonly costCopy: string; readonly equipped: boolean; readonly replacementRequired: boolean;
}
export interface UpgradeDecision extends DecisionNote {
 readonly price: number | null; readonly canBuy: boolean;
 readonly currentBase: number | null; readonly afterBase: number | null; readonly balanceAfter: number | null;
}

type PublicBlade = ForgeView['blades'][number];
const fmt = (value: number) => value.toLocaleString('zh-CN');
const owns = (view: ForgeView, id: Trait) => view.traits.some(trait => trait.id === id);
const recipeName = (id: Blade['recipe']) => RECIPES[id].name;
function cannotRepairCondition(route: RouteCondition, blade: Blade, day: number) {
 return !!(route.recipe && route.recipe !== blade.recipe && blade.hits > 0
  || route.crack === 'intact' && blade.cracked
  || route.age === 'old' && blade.suppliedDay >= day
  || route.age === 'new' && blade.suppliedDay !== day
  || route.maxHits !== undefined && blade.hits > route.maxHits);
}
function nearestRoute(view: ForgeView, item: PublicBlade) {
 return view.commission.routes.map(route => {
  const missing = item.assessment.routes.find(assessment => assessment.id === route.id)?.missing ?? [];
  return {route, missing, blocked: cannotRepairCondition(route, item.blade, view.day)};
 }).sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.missing.length - b.missing.length)[0]!;
}
function riskCopy(item: PublicBlade) {
 const rate = item.odds.crack / 10;
 if (rate === 0) return item.blade.cracked ? '这一记普通锤不会再裂，已有裂纹仍在。' : '下一记普通锤不会裂，不代表之后也一直安全。';
 return item.blade.cracked ? `下一记普通锤有${rate}%会断；断后只回收${fmt(item.recovery)}铜钱。` : `下一记普通锤裂损率${rate}%；继续敲要承担这份风险。`;
}
function paymentCopy(item: PublicBlade) {
 return item.quote.matched ? `现在交剑实收${fmt(item.quote.amount)}铜钱。` : `行会可收${fmt(item.quote.amount)}铜钱。`;
}
function spareCopy(view: ForgeView, item: PublicBlade) {
 const barter=view.merchant?(item.barter.allowed?'可献给商人换手艺。':'等级3的成器可换手艺。'):'';
 return `${view.next?'留到明日会占一位新坯。':''}${barter}回收实得${fmt(item.recovery)}铜钱。`;
}
function forgeNote(note: DecisionNote, item: PublicBlade | undefined, action: ForgeDecisionAction, actionLabel: string, missing: readonly string[] = []): ForgeDecision {
 return {...note, action, actionLabel, pieceId: item?.blade.id ?? null, missing, ordinaryToBurst: item ? Math.max(0, 6 - item.blade.charge) : null};
}

/** One contextual choice beside the real sword. No command, random draw, future hit simulation, or wallet mutation. */
export function forgeDecisions(view: ForgeView, selectedId: string | null): ForgeDecision {
 const item = view.blades.find(piece => piece.blade.id === selectedId);
 if (view.ending) return forgeNote({headline: view.ending.title, copy: '这一程已经收束，看看留下的炉谱，再决定下一次启程。', tone: 'neutral'}, undefined, 'none', '');
 if (view.phase !== 'workshop') return forgeNote({headline: '先收好这一程', copy: '沿灯路继续，回到铁砧再决定下一柄。', tone: 'neutral'}, undefined, 'none', '');
 if (!item) {
  const spare = view.blades.find(piece => !piece.reserved);
  if (spare) return forgeNote({headline: selectedId ? '这柄已离开铁砧' : '挑一柄，接着打造', copy: '选另一柄继续；已经交出或碎掉的剑不会再回来。', tone: 'neutral'}, spare, 'select', '换下一柄');
  const reserve = view.blades.find(piece => piece.reserved);
  if (reserve) return forgeNote({headline: '只剩剑架上的这一柄', copy: view.next ? '可以取回再锻，也可以收工，把它带到明天。' : '这是最后一炉，可取回安排交付、出售或回收；留在剑架的兵器不会带入新局。', tone: 'neutral'}, reserve, 'retrieve', '取回留剑');
  return forgeNote({headline: '这一炉的剑都安排好了', copy: '看看收成与契印，收工后再启程。', tone: 'neutral'}, undefined, 'settle', '收工，封炉');
 }
 if (item.reserved) return forgeNote({headline: '先取回，才能敲这柄', copy: view.next ? '挂起的剑留给明天；取回后，才可继续打造或交给来客。' : '这柄暂放在本局剑架，不会带入新局；取回后可继续打造或交付。', tone: 'neutral'}, item, 'retrieve', '取回留剑');
 if (view.commission.progress.complete) return forgeNote({headline: view.market.remaining === 0 ? '约定已交妥，今日收购钱袋已空' : '今天的约定已经交妥', copy: `${view.market.remaining === 0 ? '这柄现在无法出售。' : paymentCopy(item)}${spareCopy(view,item)}`, tone: 'ready'}, item, view.next ? 'plan' : 'settle', view.next ? '看看明日纸单' : '收工，封炉');
 if (item.willCommission) {
  const matching = view.commission.routes.filter(route => item.assessment.routes.some(assessment => assessment.id === route.id && assessment.matches));
  const completes = matching.some(route => (view.commission.progress.routes.find(progress => progress.id === route.id)?.count ?? 0) + 1 >= route.count);
  return forgeNote({headline: completes ? `现在交给${view.commission.name}，今天就交妥` : `这柄合格，先交给${view.commission.name}`,
   copy: `${paymentCopy(item)}${view.market.remaining === 0 ? '收购钱袋虽已用尽，合格委托仍可交；酬劳按真实进度结算。' : ''}${completes ? '现在交能保住这份约定；再敲仍会承担新风险。' : '交出后，还要另一柄各自合格的剑。'}`, tone: 'ready'}, item, 'deliver', `交给${view.commission.name}`);
 }
 const nearest = nearestRoute(view, item), missing = nearest.missing;
 if (nearest.blocked) return forgeNote({headline: '这柄接不了今天的这份约定', copy: `${missing.join('、')}。${paymentCopy(item)}${view.market.remaining === 0 ? '今日收购钱袋已空，剑仍在你手里。' : ''}${spareCopy(view,item)}`, tone: 'risk'}, item, view.blades.some(piece => piece !== item && !piece.reserved) ? 'select' : 'plan', '看看其他选择', missing);
 if (!item.canStrike) return forgeNote({headline: item.blade.value >= VALUE_CAP || item.blade.level >= LEVEL_CAP ? '这柄已到锻造上限' : '先安排这一炉的成品', copy: `${missing.join('、')}。现在可交剑、回收或收工。`, tone: 'neutral'}, item, 'settle', '看看收工结果', missing);
 if (nearest.route.recipe && nearest.route.recipe !== item.blade.recipe && item.canChangeRecipe) return forgeNote({headline: `先把这柄定成${recipeName(nearest.route.recipe)}`, copy: `首锤之前还能换配方；今天这条路线${missing.join('、')}。`, tone: 'neutral'}, item, 'recipe', '选择配方', missing);
 if (item.odds.burst) {
  const hits = 2 + Number(owns(view, 'ember')) + Number(item.blade.bursts === 0 && view.modifications.some(modification => modification.id === 'wideMouth'));
  return forgeNote({headline: '下一锤是安全连锻', copy: `最多${hits}记安全锤，不会裂；一次连锻仍只算一次。当前${missing.join('、')}。`, tone: 'safe'}, item, 'strike', '落下这记连锻', missing);
 }
 if (nearest.route.maxHits !== undefined) {
  const left = Math.max(0, nearest.route.maxHits - item.blade.hits);
  return forgeNote({headline: left ? `这条路线还容${left}记普通锤` : '这条路线没有再试锤的余地', copy: `${missing.join('、')}。${left ? riskCopy(item) : '再敲会超过普通锤要求，可以换下一柄。'}`, tone: left ? 'neutral' : 'risk'}, item, left ? 'strike' : 'select', left ? '再落一锤' : '换下一柄', missing);
 }
 if (item.blade.cracked) return forgeNote({headline: '带着裂纹，要想好何时收手', copy: `${missing.join('、')}。${riskCopy(item)}`, tone: 'danger'}, item, 'strike', '看清风险，再落锤', missing);
 const toBurst = Math.max(0, 6 - item.blade.charge);
 const missingBursts = Math.max(0, (nearest.route.minBursts ?? 0) - item.blade.bursts);
 const headline = missingBursts ? `今天还差${missingBursts}次连锻` : missing[0] ?? '这柄还在成形';
 return forgeNote({headline, copy: `${missing.slice(missingBursts ? 0 : 1).join('、')}${missing.length > (missingBursts ? 0 : 1) ? '。' : ''}再攒${toBurst}记普通锤，剑撑住后才有安全连锻。${riskCopy(item)}`, tone: item.odds.crack > 0 ? 'risk' : 'neutral'}, item, 'strike', '再落一锤', missing);
}

/** Tomorrow comes from the public order/supply preview, including challenge reordering and actual reserved-sword warming. */
export function nextDayPlan(view: ForgeView): NextDayDecision {
 const next = view.next;
 if (view.ending) return {day: null, title: view.ending.title, customer: '', headline: '这一程已经收束', copy: '没有可继续的明日纸单，留下的炉谱会陪你再启程。', tone: 'neutral', routes: [], reserve: null, candidateIds: [], newCount: 0, oldCount: 0, totalCount: 0};
 if (!next) return {day: null, title: '最后一炉', customer: '', headline: '今天决定这一程的归途', copy: '已经没有明日来料。先交眼前的约定，再安排余剑与收工。', tone: 'neutral', routes: [], reserve: null, candidateIds: [], newCount: 0, oldCount: 0, totalCount: 0};
 const saved = next.reserve ? view.blades.find(item => item.blade.id === next.reserve!.id) : undefined;
 const routes = next.commission.routes.map(route => {
  const assessment = next.reserve?.assessment.routes.find(item => item.id === route.id);
  return {id: route.id, description: describeRoute(route), required: route.count, reserveMatches: assessment?.matches ?? false, missing: assessment?.missing ?? []};
 });
 const candidateIds = view.blades.filter(item => !item.reserved && next.commission.routes.some(route => routeAssessment({day: next.day}, item.blade, route).matches)).map(item => item.blade.id);
 let reserve: ReservePurpose | null = null;
 if (saved && next.reserve) {
  const matching = routes.filter(route => route.reserveMatches), first = matching[0];
  const value = saved.blade.value === next.reserve.value ? `跨天仍值${fmt(next.reserve.value)}` : `现在${fmt(saved.blade.value)}，明日${fmt(next.reserve.value)}`;
  const nearest = next.commission.routes.map((route, index) => ({route, assessment: routes[index]!})).sort((a, b) => Number(cannotRepairCondition(a.route, next.reserve!, next.day)) - Number(cannotRepairCondition(b.route, next.reserve!, next.day)) || a.assessment.missing.length - b.assessment.missing.length)[0]!;
  reserve = {id: saved.blade.id, valueNow: saved.blade.value, valueNext: next.reserve.value, matchingRoutes: matching.map(route => route.id),
   headline: first ? first.required > 1 ? '明日已有一柄合用的剑' : '明日已有可交的留剑' : '这柄还不能直接交明日的单',
   copy: `${value}；裂纹与锤势保留。${first ? first.required > 1 ? `取回后可算一柄，还需另外${first.required - 1}柄各自合格。` : `取回后可交给${next.commission.name}。` : `${nearest.assessment.missing.join('、')}。${cannotRepairCondition(nearest.route, next.reserve, next.day) ? '有不能靠多敲补回的条件，明日另开新坯更合适。' : '明日取回后可继续打造，也可另开新坯。'}`}留它后明日是${next.oldCount}柄旧剑＋${next.newCount}柄新坯，共${next.totalCount}柄，少领一柄新坯；明日取下也不会补发。`,
   tone: first ? 'ready' : 'risk'};
 }
 const oldRoute = next.commission.routes.find(route => route.age === 'old'), newRoute = next.commission.routes.find(route => route.age === 'new');
 const copy = oldRoute && newRoute ? `留一柄达到${fmt(oldRoute.value)}的旧剑可走旧剑路线；也能用${newRoute.count}柄各值${fmt(newRoute.value)}的新剑接替。`
  : reserve ? reserve.copy : candidateIds.length ? '眼前已有剑符合明日的一柄要求，可以留住；也可卖出，再用新坯打造。'
  : '明日可以从新坯开始。留剑能保住已有锤势与成品，但不必每一炉都占住剑架。';
 return {day: next.day, title: next.commission.title, customer: next.commission.name,
  headline: `明日给${next.commission.name} · ${next.commission.title}`, copy: `${copy}${reserve ? copy === reserve.copy ? '' : `明日旧剑${next.oldCount}＋新坯${next.newCount}，共${next.totalCount}柄，留剑占一槽，取下不补坯。` : `明日领${next.newCount}柄新坯，共${next.totalCount}柄；若留一柄，会改为旧剑1＋新坯2，取下不补发第四柄。`}`, tone: reserve?.tone ?? 'neutral', routes, reserve, candidateIds, newCount: next.newCount, oldCount: next.oldCount, totalCount: next.totalCount};
}

/** Purpose and opportunity cost for the real three-slot loadout, rather than a generic upgrade promise. */
export function traitPurpose(traitId: Trait, view: ForgeView): TraitDecision {
 const equipped = owns(view, traitId), replacementRequired = !equipped && view.traits.length >= 3;
 const free = view.gift.canClaim && (traitId === 'steady' || traitId === 'ember') && !equipped;
 const costCopy = equipped ? '已经带着这门手艺，无需再交剑。' : `${free ? '首单谢礼可免费学；商人交换仍需交出等级≥3、未挂剑架的一柄剑。' : '交出等级≥3、未挂剑架的一柄剑，不能再交差、卖钱或留给明日。'}这里要求兵器等级，不是敲满三锤。${replacementRequired ? `手艺三槽已满，还要换下${view.traits.map(trait => trait.name).join('、')}中的一门。` : `现有${view.traits.length}/3门手艺。`}`;
 const cracked = view.blades.filter(item => item.blade.cracked).length;
 const nowIntact = view.commission.routes.some(route => route.crack === 'intact'), nextIntact = view.next?.commission.routes.some(route => route.crack === 'intact') ?? false;
 let headline: string, copy: string, tone: DecisionTone = equipped ? 'neutral' : 'ready';
 switch (traitId) {
  case 'steady': headline = '保住首裂的估值，保不住无裂条件'; copy = nowIntact || nextIntact ? '眼前或明日的无裂委托，裂了仍不合格；它只能减轻首裂掉价，不能修好裂纹。' : cracked === view.blades.length && cracked > 0 ? '手里的剑都已裂，不能靠护符治好；它主要照顾下一柄的首次裂损。' : '继续锻时，首次裂损可保住估值；剑仍留裂纹，再裂仍会断。'; if (view.growth.crackGuard) copy += '现有赊护也会在同一次首裂用掉。'; break;
  case 'ember': headline = '把一次连锻里的安全锤做厚'; copy = `${view.blades.some(item => item.blade.charge === 6) ? '已有剑蓄满六格，下一次连锻就可用上。' : '先把六格锤势攒满，连锻时才用得上。'}最多多一记安全锤；一次不会变成两次连锻。`; break;
  case 'inherit': headline = view.next ? '碎剑的余温，留给明日首坯' : '最后一天已没有下一批来料'; copy = view.next ? `以后碎剑可把峰值20%传给明日首坯，最多增加普通底价4倍。${view.next.inheritanceBonus ? `明日已有${fmt(view.next.inheritanceBonus)}余温加料。` : '它不保住碎剑，也不保证冒险更赚。'}` : '这门手艺只给下一天的首坯加料；现在换来，已没有明日首坯可受益。'; if (!view.next) tone = 'risk'; break;
  case 'echo': {const closest = view.blades.filter(item => !item.reserved).map(item => 3 - item.blade.successes % 3).sort((a, b) => a - b)[0]; headline = '让普通成功接成三声回响'; copy = `${closest ? `眼前最近一柄还需${closest}次普通成功。` : '下一柄每第三次普通成功，可额外增值25%。'}安全连锻不计这三次；别为凑回声超过委托的普通锤限制。`; break;}
  case 'crackedEdge': headline = cracked ? `眼前${cracked}柄裂剑能用上裂锋` : '有裂纹以后，才用得上裂锋'; copy = '裂剑的普通大成率加10个百分点，裂损率不变，再裂仍会断。'; if (nowIntact && !view.commission.routes.some(route => route.crack === 'cracked')) copy += '今天要无裂剑，不必为这门手艺故意造裂。'; break;
  case 'pardon': {const used = view.history.some(record => record.protected) || view.traits.some(trait => trait.id === 'pardon' && trait.used); headline = used ? '这一程的护印机会已经用过' : '留一次失约后的继续机会'; copy = used ? '换下再换回也不会重置；不必再交一柄剑来买已经用过的次数。' : '首次失约只免扣一枚契印，不替你完成委托。第4、8、12天的关键缺口仍会留下。'; if (used) tone = 'risk'; break;}
 }
 return {headline, copy, tone, costCopy, equipped, replacementRequired};
}

/** Exact normal-base quote from public chapter, upgrade count and already disclosed next-day supply percentage. */
export function upgradePlan(view: ForgeView): UpgradeDecision {
 const market = view.merchant, next = view.next;
 if (!market) return {headline: next?.merchant ? '明日再看看行脚商人的报价' : '先把眼前这炉安排好', copy: next ? `按当前来料，明日普通新坯底价${fmt(next.normalBase)}。商人到场时再看备料选择。` : '已经没有下一批来料。', tone: 'neutral', price: null, canBuy: false, currentBase: next?.normalBase ?? null, afterBase: null, balanceAfter: null};
 if (!market.canUpgrade || !next) return {headline: '这一站暂不能再备料', copy: `本次报价${fmt(market.upgrade)}铜钱，现有${fmt(view.coins)}。${next ? `按当前准备，明日普通新坯底价${fmt(next.normalBase)}。` : '已经没有明日来料。'}`, tone: 'neutral', price: market.upgrade, canBuy: false, currentBase: next?.normalBase ?? null, afterBase: null, balanceAfter: null};
 const chapter = CHAPTERS.find(item => next.day >= item.days[0]! && next.day <= item.days[1]!);
 const count = view.growth.upgradeCount + 1;
 const projected = chapter && Number.isSafeInteger(count) && count >= 1 && count <= 3 ? Math.floor(chapter.base * 3 ** count / 2 ** count * view.growth.pending.supplyPct / 100) : null;
 const afterBase = projected !== null && Number.isSafeInteger(projected) && projected >= next.normalBase ? projected : null;
 return {headline: afterBase === null ? '为后续来料提高普通底价' : `明日普通新坯 ${fmt(next.normalBase)} → ${fmt(afterBase)}`,
  copy: `花${fmt(market.upgrade)}，余${fmt(view.coins - market.upgrade)}铜钱。${afterBase === null ? '后续普通底价提高50%；' : ''}手上已有的剑不会涨价，留剑与修印仍要另作取舍。`, tone: 'ready', price: market.upgrade, canBuy: true, currentBase: next.normalBase, afterBase, balanceAfter: view.coins - market.upgrade};
}
