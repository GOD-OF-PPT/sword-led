import {RECIPES} from '../core-v5/index.js';
import type {Blade, RouteCondition, getRunView} from '../core-v5/index.js';

export type CommissionPaperView = ReturnType<typeof getRunView>;
export interface PaperSelection {
 readonly pieceId: string;
 readonly matches: boolean;
 readonly canDeliver: boolean;
 readonly blocked: boolean;
 readonly reserved: boolean;
 readonly missing: readonly string[];
 readonly copy: string;
}
export interface PaperRoute {
 readonly id: string;
 readonly label: string;
 readonly requirement: string;
 readonly required: number;
 readonly complete: boolean;
 readonly inactive: boolean;
 /** Accepted, commissioned swords only. A qualifying sword on the anvil is not a receipt. */
 readonly deliveredIds: readonly string[];
 readonly selected: PaperSelection | null;
}
export interface CommissionPaper {
 readonly commissionId: number;
 readonly complete: boolean;
 readonly alternative: boolean;
 readonly multiple: boolean;
 readonly summary: string;
 readonly progressCopy: string;
 readonly routes: readonly PaperRoute[];
}
interface PaperHost {thumb(pieceId: string): HTMLCanvasElement | null}

const fmt = (value: number) => value.toLocaleString('zh-CN');
const countName = (count: number) => count === 1 ? '一柄' : count === 2 ? '两柄' : `${count}柄`;

function routeLabel(route: RouteCondition, alternative: boolean) {
 if (route.age === 'old') return `此前留剑${countName(route.count)}`;
 if (route.age === 'new') return `本日新剑${countName(route.count)}`;
 if (alternative && route.crack) return `${route.crack === 'intact' ? '完好剑' : '裂剑'}${countName(route.count)}`;
 return route.count > 1 ? `${countName(route.count)}分别交付` : '交付一柄';
}

function requirement(route: RouteCondition, alternative: boolean) {
 const parts: string[] = [];
 if (route.recipe) parts.push(RECIPES[route.recipe].name);
 // Age and alternative crack conditions already appear in the route's visible label.
 if (route.crack && !(alternative && !route.age)) parts.push(route.crack === 'intact' ? '无裂纹' : '带裂纹');
 if (route.maxHits !== undefined) parts.push(`普通锤≤${route.maxHits}`);
 if (route.minLevel !== undefined) parts.push(`等级≥${route.minLevel}`);
 if (route.minBursts !== undefined) parts.push(`连锻≥${route.minBursts}次`);
 parts.push(`${route.count > 1 ? '每柄' : ''}身价≥${fmt(route.value)}`);
 return parts.join(' · ');
}

function currentMissing(route: RouteCondition, blade: Blade, day: number) {
 const missing: string[] = [];
 let blocked = false;
 if (route.recipe && blade.recipe !== route.recipe) {
  missing.push(`要${RECIPES[route.recipe].name}`);
  blocked ||= blade.hits > 0;
 }
 if (route.crack === 'intact' && blade.cracked) {missing.push('须另换无裂剑');blocked = true;}
 if (route.crack === 'cracked' && !blade.cracked) missing.push('还未带裂纹');
 if (route.age === 'old' && blade.suppliedDay >= day) {missing.push('这是新剑，不能作留剑');blocked = true;}
 if (route.age === 'new' && blade.suppliedDay !== day) {missing.push('这是留剑，不能作新剑');blocked = true;}
 if (route.maxHits !== undefined && blade.hits > route.maxHits) {missing.push(`已超过${route.maxHits}次普通锤`);blocked = true;}
 if (route.minLevel !== undefined && blade.level < route.minLevel) missing.push(`还差${route.minLevel - blade.level}级`);
 if (route.minBursts !== undefined && blade.bursts < route.minBursts) missing.push(`还差${route.minBursts - blade.bursts}次连锻`);
 if (blade.value < route.value) missing.push(`还差${fmt(route.value - blade.value)}身价`);
 return {missing, blocked};
}

/** Public, current-state projection. It never dispatches, simulates a hit, or changes a sword. */
export function commissionPaper(view: CommissionPaperView, selectedId: string | null): CommissionPaper {
 const commission = view.commission, alternative = commission.routes.length > 1;
 const item = view.blades.find(piece => piece.blade.id === selectedId);
 const complete = commission.progress.complete;
 const routes: PaperRoute[] = commission.routes.map(route => {
  const progress = commission.progress.routes.find(value => value.id === route.id);
  const deliveredIds = progress?.pieceIds.slice(0, route.count) ?? [];
  const routeComplete = progress?.complete ?? false, inactive = complete && !routeComplete;
  let selected: PaperSelection | null = null;
  if (item && !complete) {
   const assessment = item.assessment.routes.find(value => value.id === route.id);
   const {missing, blocked} = currentMissing(route, item.blade, view.day);
   const matches = assessment?.matches ?? false;
   const canDeliver = matches && item.assessment.canDeliver && !item.reserved;
   const copy = matches ? item.reserved ? '这柄合格 · 先从剑架取回' : '这柄合格 · 可以交给来客'
    : `${missing[0] ?? '这柄尚不合纸单'}${missing.length > 1 ? `，另有${missing.length - 1}项` : ''}`;
   selected = {pieceId: item.blade.id, matches, canDeliver, blocked, reserved: item.reserved, missing, copy};
  }
  return {id: route.id, label: routeLabel(route, alternative), requirement: requirement(route, alternative),
   required: route.count, complete: routeComplete, inactive, deliveredIds, selected};
 });
 const multiple = routes.some(route => route.required > 1);
 const partial = routes.find(route => route.deliveredIds.length > 0 && !route.complete);
 let progressCopy: string;
 if (complete) progressCopy = multiple && routes.some(route => route.complete && route.required > 1) ? '✓ 两柄均已交妥' : '✓ 这份约定已经交妥';
 else if (partial) progressCopy = alternative ? '已收一柄；还可改走另一条路线' : '已收一柄，还等另一柄';
 else progressCopy = alternative ? '' : multiple ? '每柄各自合格，不能一剑算两柄' : '合格后递给来客，才算交妥';
 return {commissionId: commission.id, complete, alternative, multiple,
  summary: alternative ? '两条路，任选其一' : multiple ? '两柄剑，各赴一程' : '好剑有它要去的地方', progressCopy, routes};
}

/** Owns only the small, existing paper surface. All actions remain with the game controller. */
export function createCommissionPaper(root: HTMLElement, host: PaperHost) {
 const document = root.ownerDocument;
 const list = root.querySelector<HTMLElement>('#v4-order-routes');
 const condition = root.querySelector<HTMLElement>('#v4-goal-condition');
 const progress = root.querySelector<HTMLElement>('#v4-goal-progress');
 const customer = root.querySelector<HTMLElement>('#v4-customer-zone');
 const objective = list?.closest<HTMLElement>('.v4-objective');
 if (!list || !condition || !progress || !customer || !objective) throw new Error('Commission paper DOM is incomplete.');
 const target = list, conditionText = condition, progressText = progress, customerZone = customer, paper = objective;
 let disposed = false, key = '';
 function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);node.className = className;if (text !== undefined) node.textContent = text;return node;
 }
 function write(node: HTMLElement, value: string) {if (node.textContent !== value) node.textContent = value;}
 function render(view: CommissionPaperView, selectedId: string | null, identity = '') {
  if (disposed) return;
  const model = commissionPaper(view, selectedId), nextKey = JSON.stringify([identity, model]);
  write(conditionText, model.summary);write(progressText, model.progressCopy);
  customerZone.dataset.paperLayout = model.alternative ? 'double' : 'single';
  customerZone.dataset.paperMulti = String(model.multiple);
  paper.dataset.paperComplete = String(model.complete);
  if (nextKey === key) return;
  key = nextKey;
  const fragment = document.createDocumentFragment();
  for (const [index, route] of model.routes.entries()) {
   if (index > 0) fragment.append(element('p', 'v4-order-or', '或'));
   const section = element('section', 'v4-order-route');section.dataset.route = route.id;
   section.dataset.complete = String(route.complete);section.dataset.inactive = String(route.inactive);
   section.dataset.selectedState = route.selected?.matches ? route.selected.reserved ? 'reserved' : 'ready' : route.selected?.blocked ? 'blocked' : 'missing';
   const row = element('div', 'v4-order-row'), copy = element('div', 'v4-order-copy');
   const title = element('p', 'v4-order-title');
   title.append(element('strong', 'v4-order-label', route.label), element('span', 'v4-order-requirement', route.requirement));
   const selectedCopy = route.inactive ? '另一条已履约，这条不必再交' : route.complete ? '这条路线已经交妥' : route.selected?.copy ?? '挑一柄，看看还差什么';
   copy.append(title, element('p', 'v4-order-selected', selectedCopy));
   const sockets = element('div', 'v4-order-sockets');sockets.dataset.required = String(route.required);
   for (let slot = 0; slot < route.required; slot++) {
    const id = route.deliveredIds[slot], socket = element('span', 'v4-order-socket');
    socket.dataset.received = String(!!id);socket.setAttribute('role', 'img');
    socket.setAttribute('aria-label', `第${slot + 1}柄${id ? '已收讫' : '尚未交付'}`);
    if (id) {
     socket.dataset.piece = id;
     let canvas: HTMLCanvasElement | null = null;
     try {canvas = host.thumb(id);} catch {/* The accepted receipt still has its text when artwork is unavailable. */}
     if (canvas) {canvas.setAttribute('aria-hidden', 'true');socket.append(canvas);}
    }
    socket.append(element('small', 'v4-order-socket-caption', id ? '收讫' : '待交'));
    sockets.append(socket);
   }
   row.append(copy, sockets);section.append(row);fragment.append(section);
  }
  target.replaceChildren(fragment);
 }
 return {render, dispose() {if (disposed) return;disposed = true;target.replaceChildren();customerZone.removeAttribute('data-paper-layout');customerZone.removeAttribute('data-paper-multi');paper.removeAttribute('data-paper-complete');}};
}
