import type { Action, RunView } from '../core/index.js';
import { getRunLedger } from '../core/index.js';
import type { ArtBundle } from './assets.js';
import { artAsset } from './assets.js';
import { explainError } from '../application/session.js';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);if (text !== undefined) el.textContent = text;if (className) el.className = className;return el;
}
export interface PhaseHooks {
  command(action: Action): void;
  confirm(title: string, message: string, label: string, run: () => void): void;
  restart(sameSeed: boolean): void;
  menu(): void;
}

export function renderPhase(panel: HTMLElement, view: RunView, canOperate: boolean, art: ArtBundle, hooks: PhaseHooks) {
  const required = (id: string) => { const el = panel.querySelector<HTMLElement>(id);if (!el) throw new Error(`Missing phase element ${id}`);return el; };
  const content = required('#phase-content'), actions = required('#phase-actions');content.replaceChildren();actions.replaceChildren();
  panel.dataset.kind = view.phase;
  required('#phase-kicker').textContent = `行会手账 · 第 ${view.round} / ${view.totalRounds} 轮`;
  const title = required('#phase-title'), description = required('#phase-description');
  const addAction = (id: string, label: string, run: () => void, primary = false, needsWrite = false) => {
    const button = node('button', label, primary ? 'primary' : '');button.type = 'button';button.id = id;
    button.disabled = needsWrite && !canOperate;button.addEventListener('click', run);actions.append(button);return button;
  };
  const facts = (values: readonly (readonly [string, string | number])[], className = '') => {
    const list = node('dl', undefined, `ledger-facts ${className}`);
    for (const [label, value] of values) { const pair = node('div');pair.append(node('dt', label), node('dd', String(value)));list.append(pair); }
    return list;
  };
  const sealStrip = () => {
    const strip = node('div', undefined, 'seal-strip');strip.setAttribute('aria-label', `剩余 ${view.seals} 枚契约印记`);
    for (let i = 0; i < 3; i++) { const token = node('span', i < view.seals ? '契' : '耗尽', i < view.seals ? 'seal-tag' : 'seal-tag spent');token.setAttribute('aria-hidden', 'true');strip.append(token); }
    return strip;
  };
  if (view.phase === 'roundSummary') {
    const receipt = getRunLedger(view).rounds.at(-1);if (!receipt) throw new Error('Summary phase has no receipt');
    title.textContent = receipt.metQuota ? '今日订单达成' : '订单未达标';
    description.textContent = receipt.metQuota ? '今天的货已经交到行会。收好账本，明天继续开炉。' : `尚差 ${receipt.deficit}。金币保留，扣除 1 枚契约印记；下一轮配额按原契约执行。`;
    const heading = node('div', undefined, 'receipt-heading');
    heading.append(node('span', receipt.metQuota ? '✓ 达成' : '× 违约', `ink-stamp ${receipt.metQuota ? 'met' : 'missed'}`),
      facts([['当轮交货 / 配额', `${receipt.delivered} / ${receipt.quota}`], ['契约印记', `${receipt.sealsBefore} → ${receipt.sealsAfter}`], ['本轮回收与破碎', `${receipt.scrap} 废料`]]));
    content.append(heading, sealStrip());
    const pieces = node('div', undefined, 'receipt-pieces');pieces.setAttribute('aria-label', '本轮三件铁件去向');
    for (const [index, piece] of receipt.pieces.entries()) {
      const card = node('article', undefined, 'receipt-piece');card.dataset.status = piece.statusCode;
      card.append(node('span', `来料 ${index + 1} · ${piece.status}`, 'eyebrow'), node('h3', `${piece.material} · ${piece.tier}`),
        node('strong', piece.coins ? `+${piece.coins} 金币` : `+${piece.scrap} 废料`),
        node('p', piece.lost ? `破碎时估值 ${piece.lost}，未计入订单。` : piece.scrap ? `放弃交货估值 ${piece.value}，不计订单。` : '已计入当轮订单。', 'small'));
      pieces.append(card);
    }
    content.append(pieces, node('p', `这张收据只展示已结算结果。剩余 ${receipt.coalRemaining} 煤不结转；下一轮重新配给。`, 'small'));
    const merchant = view.nextMerchantRound === view.round;
    addAction('phase-advance', merchant ? '拜访行会商人' : '进入下一轮', () => hooks.command({ type: 'advanceSummary' }), true, true);
  } else if (view.phase === 'merchant') {
    title.textContent = '行会商人';description.textContent = '每种商品本次限购一次。升级随契约保留；风箱从下一轮增加煤配给。';
    const heading = node('div', undefined, 'merchant-heading'), illustration = node('img');
    illustration.src = artAsset(art, 'merchant-kit').src;illustration.alt = '';illustration.className = 'merchant-illustration';
    heading.append(facts([['可用金币', view.coins], ['可用废料', view.scrap], ['契约印记', `${view.seals} / 3`]]), illustration);content.append(heading);
    const offers = node('div', undefined, 'merchant-offers');
    for (const offer of view.merchant.offers) {
      const card = node('article', undefined, 'offer');card.dataset.product = offer.productId;
      const bought = !offer.availability.allowed && offer.availability.reason === 'already_purchased';
      const level = offer.productId === 'repair' ? bought ? '本次已修补' : '恢复 1 枚印记' : `等级 ${offer.level} / 2${offer.nextLevel ? ` → ${offer.nextLevel}` : ''}`;
      card.append(node('span', level, 'eyebrow'), node('h3', offer.label), node('p', offer.effect));
      card.append(node('p', offer.price ? `${offer.price.coins} 金币 + ${offer.price.scrap} 废料` : '已满级', 'price'));
      const buy = node('button', bought ? '本次已购' : offer.nextLevel === null ? '已完成' : '购买');buy.type = 'button';buy.id = `buy-${offer.productId}`;
      buy.disabled = !canOperate || !offer.availability.allowed;buy.setAttribute('aria-label', `购买${offer.label}`);
      buy.addEventListener('click', () => {
        if (!offer.price || !offer.availability.allowed) return;
        hooks.confirm(`购买${offer.label}`, `${offer.effect}\n消耗 ${offer.price.coins} 金币和 ${offer.price.scrap} 废料。\n购买后：${view.coins - offer.price.coins} 金币 / ${view.scrap - offer.price.scrap} 废料。\n${offer.productId === 'repair' ? `契约印记 ${view.seals} → ${Math.min(3, view.seals + 1)}。` : `${level}；本次不能再购买同一种商品。`}`,
          '确认购买', () => hooks.command({ type: 'buy', productId: offer.productId }));
      });
      card.append(buy);
      const reason = !canOperate ? '当前契约只可查看，请先恢复操作。' : !offer.availability.allowed ? explainError(offer.availability.reason) : '金币与废料将一起扣除。';
      card.append(node('p', reason, offer.availability.allowed && canOperate ? 'offer-note' : 'disabled-reason'));offers.append(card);
    }
    content.append(offers);
    addAction('phase-leave', '准备下一轮', () => hooks.confirm('离开行会商人', `将进入第 ${view.round + 1} 轮并领取三件新来料。\n本次未购买的商品不会保留，${view.nextMerchantRound ? `下一次商人在第 ${view.nextMerchantRound} 轮结算后到访。` : '这是最后一次商人来访。'}`,
      '离开并开炉', () => hooks.command({ type: 'leaveMerchant' })), true, true);
  } else {
    const receipt = getRunLedger(view), victory = view.phase === 'victory';
    title.textContent = victory ? '契约期完成' : '契约终止';
    description.textContent = victory ? '撑过十二轮，仍有印记即可完成契约期。每一次收手，都是自己的决定。' : `第 ${view.round} 轮印记耗尽，本次契约结束。账本已经保留，可以换一种节奏再来。`;
    const hero = node('div', undefined, 'ending-hero');hero.append(node('span', victory ? '✓ 完成' : '× 终止', `ink-stamp ${victory ? 'met' : 'missed'}`), sealStrip(),
      facts([['达标', `${view.stats.roundsMet} 轮`], ['违约', `${view.stats.roundsMissed} 轮`], ['剩余印记', `${view.seals} / 3`]]));content.append(hero);
    content.append(facts([['金币余额', view.coins], ['废料余额', view.scrap], ['最高阶', receipt.highestTier], ['破碎 / 损失估值', `${view.stats.brokenPieces} 件 / ${receipt.lost}`],
      ['累计交货', `${view.stats.coinsEarned} 金币`], ['升级与修补花费', `${view.stats.coinsSpent} 金币 / ${view.stats.scrapSpent} 废料`]], 'ending-totals'));
    const details = node('details', undefined, 'ending-ledger'), summary = node('summary', `展开本局 ${view.history.length} 轮账本与购买记录`);
    const table = node('table');table.setAttribute('aria-label', '逐轮订单账本');
    const head = node('thead'), header = node('tr');for (const label of ['轮次', '交货 / 配额', '结果', '印记']) { const cell = node('th', label);cell.scope = 'col';header.append(cell); }head.append(header);table.append(head);
    const body = node('tbody');for (const round of receipt.rounds) { const row = node('tr');for (const value of [round.round, `${round.delivered} / ${round.quota}`, round.metQuota ? '达标' : `违约 · 差 ${round.deficit}`, `${round.sealsBefore} → ${round.sealsAfter}`]) row.append(node('td', String(value)));body.append(row); }table.append(body);
    details.append(summary, table, node('h3', '商人与购买'));
    const purchases = node('ul');for (const p of receipt.purchases) purchases.append(node('li', `第 ${p.afterRound} 轮 · ${p.label}${p.product === 'repair' ? '（恢复 1 枚）' : ` ${p.level} 级`} · ${p.coins} 金币 + ${p.scrap} 废料`));
    details.append(purchases, ...(receipt.purchases.length ? [] : [node('p', '本局没有购买。')]));content.append(details);
    addAction('phase-replay', '同种子再战', () => hooks.restart(true), true, true);
    addAction('phase-new', '新契约', () => hooks.restart(false), false, true);
  }
  addAction('phase-menu', '返回菜单', hooks.menu);
  content.append(node('p', '进度会按当前保存状态保留，返回菜单不会重新领取货物或奖励。', 'small phase-save-hint'));
}
